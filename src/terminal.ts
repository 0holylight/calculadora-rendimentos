// Salão do terminal: pede a simulação, exibe com toFixed e trata o erro.
// Uso: npm run terminal -- [valor] [meses] [aporteMensal] [% CDI do CDB] [% CDI da LCI/LCA] [historico|projecao]
// (padrão: 1000 12 0 100 90 historico)
import type { Pedido } from "./types.ts";
import { simular } from "./simulacao.ts";
import { formatarMes } from "./datas.ts";

async function exibirNoTerminal(pedido: Pedido): Promise<void> {
  try {
    const simulacao = await simular(pedido);

    console.log(`
      ${simulacao.premissas === null ? "Período" : "Projeção"}: ${formatarMes(simulacao.inicio)} a ${formatarMes(simulacao.fim)}${
        simulacao.premissas === null
          ? " (último IPCA disponível)"
          : ` (Focus de ${simulacao.premissas.boletim}: Selic ${simulacao.premissas.selicInicial.toFixed(2)}% → ${simulacao.premissas.selicFinal.toFixed(2)}%, IPCA ${simulacao.premissas.ipcaAnual.toFixed(2)}% a.a.)`
      }
      Aplicado: R$${simulacao.valor} + R$${simulacao.aporteMensal}/mês = R$${simulacao.totalAplicado.toFixed(2)}
      Inflação do período: ${simulacao.taxaInflacao.toFixed(2)}%
      Para manter o poder de compra, precisaria chegar a R$${simulacao.montanteSobInflacao.toFixed(2)}
      `);

    for (const aplicacao of simulacao.aplicacoes) {
      console.log(`
      ${aplicacao.nome}
        Rendimento bruto: R$${aplicacao.ganhoBruto.toFixed(2)} (${aplicacao.taxaBruta.toFixed(2)}%)
        IOF: R$${aplicacao.iof.toFixed(2)}  IR: R$${aplicacao.ir.toFixed(2)}  Custódia: R$${aplicacao.custodia.toFixed(2)}
        Valor final: R$${aplicacao.valorFinal.toFixed(2)}
        Ganho real: R$${aplicacao.ganhoReal.toFixed(2)} (${aplicacao.taxaReal.toFixed(2)}%)
        Em carência no fim: R$${aplicacao.emCarencia.toFixed(2)}
      `);
    }
  } catch (e) {
    console.log(e);
    process.exitCode = 1;
  }
}

const [valor = "1000", meses = "12", aporte = "0", cdb = "100", lci = "90", modo = "historico"] =
  process.argv.slice(2);
exibirNoTerminal({
  modo: modo === "projecao" ? "projecao" : "historico",
  valor: Number(valor),
  meses: Number(meses),
  aporteMensal: Number(aporte),
  percentualCdb: Number(cdb),
  percentualLciLca: Number(lci),
});
