// Conferência com gabaritos oficiais: compara o que o app calcula com séries do Banco Central que já vêm
// acumuladas (ou mensais, calculadas por outro caminho). Usa a internet de verdade, por isso fica fora do
// `npm test` e do deploy. Uso: npm run conferir
import { simular } from "../src/simulacao.ts";
import { taxasMensais } from "../src/bcb.ts";
import { taxasParaFator, fatorParaTaxa } from "../src/calculos.ts";
import { formatarMes } from "../src/datas.ts";

type Conferencia = { nome: string; app: number; gabarito: number; tolerancia: number };

// As séries mensais oficiais têm 2 casas decimais, então cada mês pode diferir até 0,005 p.p. do valor
// exato calculado com as taxas diárias. A tolerância cresce com o número de meses.
function tolerancia(meses: number): number {
  return Math.max(0.01, 0.005 * meses);
}

async function conferirJanela(meses: number): Promise<Conferencia[]> {
  const simulacao = await simular({
    valor: 1000,
    meses,
    aporteMensal: 0,
    percentualCdb: 100,
    percentualLciLca: 90,
  });
  const { inicio, fim } = simulacao;
  const cdb = simulacao.aplicacoes.find((aplicacao) => aplicacao.id === "cdb");
  const tesouro = simulacao.aplicacoes.find((aplicacao) => aplicacao.id === "tesouroSelic");
  if (cdb === undefined || tesouro === undefined) {
    throw new Error("A simulação não trouxe o CDB ou o Tesouro Selic");
  }

  const [cdiMensal, selicMensal] = await Promise.all([
    taxasMensais(4391, inicio, fim), // CDI acumulado no mês (% a.m.)
    taxasMensais(4390, inicio, fim), // Selic acumulada no mês (% a.m.)
  ]);

  const periodo = `${formatarMes(inicio)} a ${formatarMes(fim)}`;
  const conferencias: Conferencia[] = [
    {
      nome: `CDI, ${periodo} (série 4391)`,
      app: cdb.taxaBruta,
      gabarito: fatorParaTaxa(taxasParaFator([...cdiMensal])),
      tolerancia: tolerancia(meses),
    },
    {
      nome: `Selic, ${periodo} (série 4390)`,
      app: tesouro.taxaBruta,
      gabarito: fatorParaTaxa(taxasParaFator([...selicMensal])),
      tolerancia: tolerancia(meses),
    },
  ];

  if (meses === 12) {
    const [ipca12] = await taxasMensais(13522, fim, fim); // IPCA acumulado em 12 meses (%)
    if (ipca12 !== undefined) {
      conferencias.push({
        nome: `IPCA 12 meses até ${formatarMes(fim)} (série 13522)`,
        app: simulacao.taxaInflacao,
        gabarito: ipca12,
        tolerancia: 0.01,
      });
    }
  }
  return conferencias;
}

async function main(): Promise<void> {
  try {
    const todas = (await Promise.all([12, 36, 120].map(conferirJanela))).flat();
    let falhas = 0;
    for (const { nome, app, gabarito, tolerancia: limite } of todas) {
      const diferenca = Math.abs(app - gabarito);
      const ok = diferenca <= limite;
      if (!ok) falhas += 1;
      console.log(
        `${ok ? "✅" : "❌"} ${nome}: app ${app.toFixed(2)}% · gabarito ${gabarito.toFixed(2)}% · diferença ${diferenca.toFixed(3)} p.p. (limite ${limite.toFixed(2)})`,
      );
    }
    console.log(falhas === 0 ? "\nTudo confere." : `\n${falhas} conferência(s) fora do limite.`);
    process.exitCode = falhas === 0 ? 0 : 1;
  } catch (e) {
    console.error("Não foi possível conferir:", e);
    process.exitCode = 1;
  }
}

main();
