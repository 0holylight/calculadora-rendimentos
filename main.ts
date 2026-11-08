// imports do bcb.ts
import { dadosExtraidos } from "./bcb.ts";
// imports do calculos.ts
import { calculoTaxas } from "./calculos.ts";

async function processarInput(valor: number, tempo: number): Promise<number> {
  // resgatar dados com o tempo inserido:
  // Taxa de IPCA acumulado

  const codIpca = 433;
  const codPoup = 196;

  try {
    const ipcaAcumulado = await dadosExtraidos(codIpca, tempo);
    const rentabilidadePoup = await dadosExtraidos(codPoup, 1);
    // Retorna a inflação acumulada dos ultimox x meses inseridos ali na função maior.
    const taxasAcumuladas = calculoTaxas(ipcaAcumulado);
    const valorFinal = taxasAcumuladas.toFixed(2);
    // Temos o IPCA acumulado com essa operação, e por fim, precisamos unir o calculo da Poupança
    console.log(ipcaAcumulado, rentabilidadePoup, taxasAcumuladas, valorFinal);
  } catch (e) {
    console.log(e);
  }

  async function processarPoupanca() {
    //
  }
  return 1;
}

processarInput(1000, 12);

// Imports das funções, chamam em um try-catch, e dá console.log
