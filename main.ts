// imports do bcb.ts
import { dadosExtraidos } from "./bcb.ts";
// imports do calculos.ts
import { taxasParaFator, fatorParaTaxa, aplicarFator, ganhoSobreReferencia } from "./calculos.ts";

async function processarInput(valor: number, tempo: number): Promise<number> {
  const codIpca = 433;
  const codPoup = 196;

  try {
    // IPCA

    const ipcaMensal = await dadosExtraidos(codIpca, tempo); // Vetor de números extraidos do BACEN
    const fatorAcumuladoIpca = taxasParaFator(ipcaMensal); // Multiplicacao acumulada de valores do periodo
    const taxaPeriodoIpca = fatorParaTaxa(fatorAcumuladoIpca); // Transforma fator em taxa
    const taxaIpca = taxaPeriodoIpca.toFixed(2); // Arredonda exibição das casas.

    // POUPANÇA

    const poupMensal = await dadosExtraidos(codPoup, tempo);
    const fatorAcumuladoPoup = taxasParaFator(poupMensal);
    const taxaPeriodoPoup = fatorParaTaxa(fatorAcumuladoPoup);
    const taxaPoup = taxaPeriodoPoup.toFixed(2);

    const performanceInflacao = aplicarFator(valor, fatorAcumuladoIpca);
    // const performanceBruta =
    //   transformarValor(valor, fatorAcumuladoPoup) - valor;
    // const performanceReal =
    //   transformarValor(valor, fatorAcumuladoPoup) - performanceInflacao;
    const performanceBruta =
      ganhoSobreReferencia(valor, fatorAcumuladoPoup, 1);
    const performanceReal =
      ganhoSobreReferencia(valor, fatorAcumuladoPoup, fatorAcumuladoIpca);

    console.log(
      taxaIpca,
      taxaPoup,
      performanceInflacao,
      performanceBruta,
      performanceReal,
    );
  } catch (e) {
    console.log(e);
  }

  return 1;
}

processarInput(1000, 6);

// Imports das funções, chamam em um try-catch, e dá console.log
