// Gerente: recebe o pedido (valor e meses), chama o fornecedor (bcb) e o cozinheiro (calculos) e devolve o resultado.
// Não faz contas, não exibe e não trata erro: quem exibe (terminal ou página) decide como responder a ele.
import type { ResultadoAplicacao, Simulacao } from "./types.ts";
import { taxasMensais, ultimoMes } from "./bcb.ts";
import { inicioDaJanela } from "./datas.ts";
import {
  taxasParaFator,
  fatorParaTaxa,
  aplicarFator,
  ganhoSobreReferencia,
  fatorReal,
} from "./calculos.ts";

const codIpca = 433;
const codPoup = 196;

export async function simular(valor: number, meses: number): Promise<Simulacao> {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`Valor inválido: ${valor}`);
  }
  if (!Number.isInteger(meses) || meses < 1) {
    throw new Error(`Prazo inválido: ${meses} (use um número inteiro de meses)`);
  }

  // O IPCA sai com atraso, então o último mês dele define o fim do período das duas séries
  const fim = await ultimoMes(codIpca);
  const inicio = inicioDaJanela(fim, meses);

  const [ipcaMensal, poupMensal] = await Promise.all([
    taxasMensais(codIpca, inicio, fim),
    taxasMensais(codPoup, inicio, fim),
  ]);

  const fatorAcumuladoIpca = taxasParaFator(ipcaMensal);
  const fatorAcumuladoPoup = taxasParaFator(poupMensal);

  const ganhoBrutoPoup = ganhoSobreReferencia(valor, fatorAcumuladoPoup, 1);

  const poupanca: ResultadoAplicacao = {
    id: "poupanca",
    nome: "Poupança",
    taxaBruta: fatorParaTaxa(fatorAcumuladoPoup),
    ganhoBruto: ganhoBrutoPoup,
    impostos: 0, // isenta de IR para pessoa física e sem taxas
    ganhoLiquido: ganhoBrutoPoup, // sem impostos, líquido = bruto
    valorFinal: aplicarFator(valor, fatorAcumuladoPoup),
    ganhoReal: ganhoSobreReferencia(valor, fatorAcumuladoPoup, fatorAcumuladoIpca),
    taxaReal: fatorParaTaxa(fatorReal(fatorAcumuladoPoup, fatorAcumuladoIpca)),
  };

  return {
    valor,
    meses,
    inicio,
    fim,
    taxaInflacao: fatorParaTaxa(fatorAcumuladoIpca),
    montanteSobInflacao: aplicarFator(valor, fatorAcumuladoIpca),
    correcaoInflacao: ganhoSobreReferencia(valor, fatorAcumuladoIpca, 1),
    aplicacoes: [poupanca],
  };
}
