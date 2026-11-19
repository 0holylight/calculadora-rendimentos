// Salão do terminal: pede a simulação, exibe com toFixed e trata o erro.
// Na web, a página vai fazer este mesmo papel, importando o simular.
import { simular } from "./simulacao.ts";
import { formatarMes } from "./datas.ts";

async function exibirNoTerminal(valor: number, meses: number): Promise<void> {
  try {
    const simulacao = await simular(valor, meses);

    console.log(`
      Período: ${formatarMes(simulacao.inicio)} a ${formatarMes(simulacao.fim)} (último IPCA disponível) \n
      Inflação do período: ${simulacao.taxaInflacao.toFixed(2)}% \n
      R$${simulacao.valor} equivale a R$${simulacao.montanteSobInflacao.toFixed(2)} hoje
      `);

    for (const aplicacao of simulacao.aplicacoes) {
      console.log(`
      ${aplicacao.nome} rendeu: ${aplicacao.taxaBruta.toFixed(2)}% \n
      R$${simulacao.valor} obteve rendimento bruto de: R$${aplicacao.ganhoBruto.toFixed(2)} \n
      R$${simulacao.valor} obteve rendimento real: R$${aplicacao.ganhoReal.toFixed(2)} \n
      Taxa real da aplicação: ${aplicacao.taxaReal.toFixed(2)}%
      `);
    }
  } catch (e) {
    console.log(e);
    process.exitCode = 1;
  }
}

exibirNoTerminal(1000, 12);
