// Gerente: recebe o pedido, chama o fornecedor (bcb) e o cozinheiro (calculos) e devolve o resultado.
// Não faz contas, não exibe e não trata erro: quem exibe (terminal ou página) decide como responder a ele.
import type { IdAplicacao, Pedido, RegrasAplicacao, Simulacao } from "./types.ts";
import { taxasDiariasPorMes, taxasMensais, ultimoMes } from "./bcb.ts";
import { diasAteOResgate, diasPorResgate, inicioDaJanela } from "./datas.ts";
import {
  aplicadoMesAMes,
  desempenho,
  fatoresDiariosPorMes,
  fatoresMensais,
  inflacaoDoPeriodo,
  inflacaoMesAMes,
  listaDeAportes,
  regrasCdb,
  regrasLciLca,
  regrasPoupanca,
  regrasTesouroSelic,
  trajetoria,
} from "./calculos.ts";
import { ErroPedido } from "./erros.ts";

const codIpca = 433;
const codPoup = 196;
const codCdi = 12;
const codSelic = 11;

// 20 anos: cobre o período em que as regras de IR atuais valem (desde 2005)
export const mesesMaximo = 240;
export const percentualMaximo = 300;

function validar(pedido: Pedido): void {
  const { valor, meses, aporteMensal, percentualCdb, percentualLciLca } = pedido;
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ErroPedido("O valor aplicado precisa ser maior que zero.");
  }
  if (!Number.isInteger(meses) || meses < 1 || meses > mesesMaximo) {
    throw new ErroPedido(`O prazo precisa ser um número inteiro de meses, de 1 a ${mesesMaximo}.`);
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

export async function simular(pedido: Pedido): Promise<Simulacao> {
  validar(pedido);
  const { valor, meses, aporteMensal, percentualCdb, percentualLciLca } = pedido;

  // O IPCA sai com atraso, então o último mês dele define o fim do período de todas as séries
  const fim = await ultimoMes(codIpca);
  const inicio = inicioDaJanela(fim, meses);

  const [ipca, poupanca, cdi, selic] = await Promise.all([
    taxasMensais(codIpca, inicio, fim),
    taxasMensais(codPoup, inicio, fim),
    taxasDiariasPorMes(codCdi, inicio, fim),
    taxasDiariasPorMes(codSelic, inicio, fim),
  ]);

  const aportes = listaDeAportes(valor, aporteMensal, meses);
  const dias = diasAteOResgate(inicio, fim);
  const diasMesAMes = diasPorResgate(inicio, fim);
  const fatoresIpca = fatoresMensais(ipca);
  const inflacao = inflacaoDoPeriodo(aportes, fatoresIpca);

  // Cada aplicação: id, nome, os fatores de cada mês e as regras fixas
  const cardapio: { id: IdAplicacao; nome: string; fatores: number[]; regras: RegrasAplicacao }[] = [
    { id: "poupanca", nome: "Poupança", fatores: fatoresMensais(poupanca), regras: regrasPoupanca },
    {
      id: "cdb",
      nome: `CDB ${percentualCdb}% do CDI`,
      fatores: fatoresDiariosPorMes(cdi, percentualCdb),
      regras: regrasCdb,
    },
    {
      id: "lciLca",
      nome: `LCI/LCA ${percentualLciLca}% do CDI`,
      fatores: fatoresDiariosPorMes(cdi, percentualLciLca),
      regras: regrasLciLca,
    },
    {
      id: "tesouroSelic",
      nome: "Tesouro Selic",
      fatores: fatoresDiariosPorMes(selic),
      regras: regrasTesouroSelic,
    },
  ];

  return {
    ...pedido,
    inicio,
    fim,
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
