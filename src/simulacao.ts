// Gerente: recebe o pedido, chama os fornecedores (bcb, focus) e o cozinheiro (calculos, projecao) e devolve o
// resultado. Não exibe e não trata erro: quem exibe (terminal ou página) decide como responder a ele.
// Os dois modos só diferem em DE ONDE vêm as taxas de cada mês: do passado (Banco Central) ou das expectativas
// (Focus). Daí para frente, a conta é a mesma (montarSimulacao).
import type { AnoMes, IdAplicacao, Pedido, Premissas, RegrasAplicacao, Simulacao } from "./types.ts";
import { taxasDiariasPorMes, taxasMensais, ultimaTaxa, ultimoMes } from "./bcb.ts";
import { expectativasAnuais, ipcaMensalEsperado } from "./focus.ts";
import { diasAteOResgate, diasPorResgate, inicioDaJanela, somarMeses } from "./datas.ts";
import {
  aplicadoMesAMes,
  desempenho,
  fatorParaTaxa,
  fatoresDiariosPorMes,
  fatoresMensais,
  inflacaoDoPeriodo,
  inflacaoMesAMes,
  listaDeAportes,
  regrasCdb,
  regrasLciLca,
  regrasPoupanca,
  regrasTesouroSelic,
  somar,
  taxasParaFator,
  trajetoria,
} from "./calculos.ts";
import {
  ipcaMesAMes,
  poupancaMesAMes,
  selicMesAMes,
  taxasDiariasProjetadas,
} from "./projecao.ts";
import { ErroPedido } from "./erros.ts";

const codIpca = 433;
const codPoup = 196;
const codCdi = 12;
const codSelic = 11;
const codMetaSelic = 432;
const codTr = 7811;

// Olhando para trás: 20 anos cobrem o período em que as regras de IR atuais valem (desde 2005)
export const mesesMaximo = 240;
// Projeção: o Focus vai até uns 4 anos à frente; depois disso a projeção repete a última expectativa
export const mesesMaximoProjecao = 60;
export const percentualMaximo = 300;

// As taxas de cada mês, no formato das séries do Banco Central (% ao mês; CDI e Selic diários por mês)
type TaxasDoPeriodo = {
  ipca: number[];
  poupanca: number[];
  cdi: number[][];
  selic: number[][];
};

function validar(pedido: Pedido): void {
  const { valor, meses, aporteMensal, percentualCdb, percentualLciLca, modo } = pedido;
  const limite = modo === "projecao" ? mesesMaximoProjecao : mesesMaximo;
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ErroPedido("O valor aplicado precisa ser maior que zero.");
  }
  if (!Number.isInteger(meses) || meses < 1 || meses > limite) {
    throw new ErroPedido(`O prazo precisa ser um número inteiro de meses, de 1 a ${limite}.`);
  }
  if (!Number.isFinite(aporteMensal) || aporteMensal < 0) {
    throw new ErroPedido("O depósito mensal não pode ser negativo. Use 0 se não quiser depósitos.");
  }
  for (const percentual of [percentualCdb, percentualLciLca]) {
    if (!Number.isFinite(percentual) || percentual <= 0 || percentual > percentualMaximo) {
      throw new ErroPedido(`O percentual do CDI precisa estar entre 1% e ${percentualMaximo}%.`);
    }
  }
}

// `hoje` só existe para os testes poderem fixar a data; na página, é o dia de hoje
export async function simular(pedido: Pedido, hoje = new Date()): Promise<Simulacao> {
  validar(pedido);
  return pedido.modo === "projecao" ? projetar(pedido, hoje) : olharParaTras(pedido);
}

async function olharParaTras(pedido: Pedido): Promise<Simulacao> {
  // O IPCA sai com atraso, então o último mês dele define o fim do período de todas as séries
  const fim = await ultimoMes(codIpca);
  const inicio = inicioDaJanela(fim, pedido.meses);

  const [ipca, poupanca, cdi, selic] = await Promise.all([
    taxasMensais(codIpca, inicio, fim),
    taxasMensais(codPoup, inicio, fim),
    taxasDiariasPorMes(codCdi, inicio, fim),
    taxasDiariasPorMes(codSelic, inicio, fim),
  ]);
  return montarSimulacao(pedido, inicio, fim, { ipca, poupanca, cdi, selic }, null);
}

async function projetar(pedido: Pedido, hoje: Date): Promise<Simulacao> {
  // A projeção começa no dia 1º do mês que vem e dura os meses pedidos
  const mesAtual: AnoMes = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const inicio = somarMeses(mesAtual, 1);
  const fim = somarMeses(inicio, pedido.meses - 1);

  const [selicAtual, mesDaTr, selicFocus, ipcaFocus, ipcaMensalFocus] = await Promise.all([
    ultimaTaxa(codMetaSelic),
    ultimoMes(codTr),
    expectativasAnuais("Selic"),
    expectativasAnuais("IPCA"),
    ipcaMensalEsperado(),
  ]);
  const trUltimos12 = await taxasMensais(codTr, somarMeses(mesDaTr, -11), mesDaTr);
  const trMensal = somar(trUltimos12) / trUltimos12.length;

  const selicAnual = selicMesAMes(selicAtual, mesAtual, selicFocus.valores, inicio, pedido.meses);
  const ipca = ipcaMesAMes(ipcaMensalFocus.valores, ipcaFocus.valores, inicio, pedido.meses);
  const diarias = taxasDiariasProjetadas(selicAnual);

  const premissas: Premissas = {
    boletim: selicFocus.data,
    selicInicial: selicAnual[0] ?? selicAtual,
    selicFinal: selicAnual[selicAnual.length - 1] ?? selicAtual,
    ipcaAnual: fatorParaTaxa(taxasParaFator(ipca) ** (12 / pedido.meses)),
    trMensal,
  };

  return montarSimulacao(
    pedido,
    inicio,
    fim,
    { ipca, poupanca: poupancaMesAMes(selicAnual, trMensal), cdi: diarias, selic: diarias },
    premissas,
  );
}

function montarSimulacao(
  pedido: Pedido,
  inicio: AnoMes,
  fim: AnoMes,
  taxas: TaxasDoPeriodo,
  premissas: Premissas | null,
): Simulacao {
  const { valor, meses, aporteMensal, percentualCdb, percentualLciLca } = pedido;
  const aportes = listaDeAportes(valor, aporteMensal, meses);
  const dias = diasAteOResgate(inicio, fim);
  const diasMesAMes = diasPorResgate(inicio, fim);
  const fatoresIpca = fatoresMensais(taxas.ipca);
  const inflacao = inflacaoDoPeriodo(aportes, fatoresIpca);

  // Cada aplicação: id, nome, os fatores de cada mês e as regras fixas
  const cardapio: { id: IdAplicacao; nome: string; fatores: number[]; regras: RegrasAplicacao }[] = [
    { id: "poupanca", nome: "Poupança", fatores: fatoresMensais(taxas.poupanca), regras: regrasPoupanca },
    {
      id: "cdb",
      nome: `CDB ${percentualCdb}% do CDI`,
      fatores: fatoresDiariosPorMes(taxas.cdi, percentualCdb),
      regras: regrasCdb,
    },
    {
      id: "lciLca",
      nome: `LCI/LCA ${percentualLciLca}% do CDI`,
      fatores: fatoresDiariosPorMes(taxas.cdi, percentualLciLca),
      regras: regrasLciLca,
    },
    {
      id: "tesouroSelic",
      nome: "Tesouro Selic",
      fatores: fatoresDiariosPorMes(taxas.selic),
      regras: regrasTesouroSelic,
    },
  ];

  return {
    ...pedido,
    inicio,
    fim,
    premissas,
    ...inflacao,
    trajetoriaInflacao: inflacaoMesAMes(aportes, fatoresIpca),
    trajetoriaAplicado: aplicadoMesAMes(aportes),
    aplicacoes: cardapio.map(({ id, nome, fatores, regras }) => ({
      id,
      nome,
      ...desempenho(aportes, fatores, dias, regras, inflacao.montanteSobInflacao),
      trajetoria: trajetoria(aportes, fatores, diasMesAMes, regras),
    })),
  };
}
