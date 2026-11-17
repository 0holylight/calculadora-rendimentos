// imports do bcb.ts
import { dadosExtraidos } from "./bcb.ts";
// imports do calculos.ts
import {
  taxasParaFator,
  fatorParaTaxa,
  aplicarFator,
  ganhoSobreReferencia,
  fatorReal,
} from "./calculos.ts";

async function processarInput(valor: number, tempo: number): Promise<number> {
  const codIpca = 433;
  const codPoup = 196;

  try {
    // IPCA

    const ipcaMensal = await dadosExtraidos(codIpca, tempo); // Vetor de números extraidos do BACEN
    const fatorAcumuladoIpca = taxasParaFator(ipcaMensal); // Multiplicacao acumulada de valores do periodo
    const taxaPeriodoIpca = fatorParaTaxa(fatorAcumuladoIpca); // Transforma fator em taxa

    // POUPANÇA

    const poupMensal = await dadosExtraidos(codPoup, tempo);
    const fatorAcumuladoPoup = taxasParaFator(poupMensal);
    const taxaPeriodoPoup = fatorParaTaxa(fatorAcumuladoPoup);

    const montanteSobInflacaoPeriodo = aplicarFator(valor, fatorAcumuladoIpca);
    const ganhoBruto = ganhoSobreReferencia(valor, fatorAcumuladoPoup, 1);
    const ganhoReal = ganhoSobreReferencia(
      valor,
      fatorAcumuladoPoup,
      fatorAcumuladoIpca,
    );
    const fatorRealPoup = fatorReal(fatorAcumuladoPoup, fatorAcumuladoIpca);
    const taxaRealPoup = fatorParaTaxa(fatorRealPoup);

    console.log(`
      Inflação do período: ${taxaPeriodoIpca.toFixed(2)}% \n
      Poupança rendeu: ${taxaPeriodoPoup.toFixed(2)}% \n
      R$${valor} equivale a R$${montanteSobInflacaoPeriodo.toFixed(2)} hoje \n
      R$${valor} obteve rendimento bruto de: R$${ganhoBruto.toFixed(2)} \n
      R$${valor} obteve rendimento real: R$${ganhoReal.toFixed(2)} \n
      Taxa real da aplicação: ${taxaRealPoup.toFixed(2)}%
      `);
  } catch (e) {
    console.log(e);
    return 1;
  }

  // ### TODO ###
  // - O return 0 e 1 (catch) é uma solução provisória para garantir que a função retorne um número
  // Ao finalizar todo o main.ts, saberei o que dar de retorno nela, que eu ainda não visualizei

  return 0;
}

processarInput(1000, 6);
