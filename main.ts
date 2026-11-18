// imports do bcb.ts
import { taxasMensais, ultimoMes } from "./bcb.ts";
import { formatarMes, inicioDaJanela } from "./datas.ts";
// imports do calculos.ts
import {
  taxasParaFator,
  fatorParaTaxa,
  aplicarFator,
  ganhoSobreReferencia,
  fatorReal,
} from "./calculos.ts";

async function processarInput(valor: number, meses: number): Promise<number> {
  const codIpca = 433;
  const codPoup = 196;

  try {
    // JANELA: o IPCA sai com atraso, então o último mês dele define o fim do período das duas séries

    const fim = await ultimoMes(codIpca);
    const inicio = inicioDaJanela(fim, meses);

    // IPCA

    const ipcaMensal = await taxasMensais(codIpca, inicio, fim); // Vetor de números extraidos do BACEN
    const fatorAcumuladoIpca = taxasParaFator(ipcaMensal); // Multiplicacao acumulada de valores do periodo
    const taxaPeriodoIpca = fatorParaTaxa(fatorAcumuladoIpca); // Transforma fator em taxa

    // POUPANÇA

    const poupMensal = await taxasMensais(codPoup, inicio, fim);
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
      Período: ${formatarMes(inicio)} a ${formatarMes(fim)} (último IPCA disponível) \n
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

processarInput(1000, 12);
