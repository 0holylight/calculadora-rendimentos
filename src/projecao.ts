// Contas puras da projeção: transformam as expectativas do Focus em taxas mês a mês, no mesmo formato que
// o Banco Central entrega para o passado. Assim o resto do motor (IR, aportes, inflação, gráfico) é o mesmo.
import type { AnoMes } from "./types.ts";
import { mesesEntre, somarMeses } from "./datas.ts";
import type { ExpectativaAnual, ExpectativaMensal } from "./focus.ts";

// O CDI (e a Selic "over", que o Tesouro Selic acompanha) fica ~0,10 p.p. ao ano abaixo da meta da Selic
export const spreadCdi = 0.1;
// 12 meses × 21 dias úteis = 252, a base de dias úteis do ano
export const diasUteisPorMes = 21;
// Acima desta Selic, a poupança rende 0,5% ao mês + TR; abaixo, 70% da Selic + TR
export const limiteRegraPoupanca = 8.5;

// Taxa ao ano → taxa ao mês equivalente (em %)
export function anualParaMensal(taxaAnual: number): number {
  return ((1 + taxaAnual / 100) ** (1 / 12) - 1) * 100;
}

// Meta da Selic (% ao ano) em cada mês da projeção: uma linha reta entre os pontos conhecidos, que são a meta de
// hoje e a mediana do Focus para o fim de cada ano. Depois do último ano do Focus, fica no último valor.
export function selicMesAMes(
  selicAtual: number,
  mesAtual: AnoMes,
  anuais: ExpectativaAnual[],
  inicio: AnoMes,
  meses: number,
): number[] {
  const pontos = [
    { indice: 0, valor: selicAtual },
    ...anuais
      .map((anual) => ({ indice: mesesEntre(mesAtual, { ano: anual.ano, mes: 12 }), valor: anual.mediana }))
      .filter((ponto) => ponto.indice > 0),
  ];
  const ultimo = pontos[pontos.length - 1] ?? { indice: 0, valor: selicAtual };

  return Array.from({ length: meses }, (_, k) => {
    const indice = mesesEntre(mesAtual, somarMeses(inicio, k));
    const posicao = pontos.findIndex((ponto) => ponto.indice >= indice);
    const depois = pontos[posicao];
    const antes = pontos[posicao - 1];
    if (depois === undefined) return ultimo.valor;
    if (antes === undefined) return depois.valor;
    return antes.valor + ((depois.valor - antes.valor) * (indice - antes.indice)) / (depois.indice - antes.indice);
  });
}

// IPCA (% ao mês) em cada mês: a expectativa mensal do Focus quando existe; senão, a anual daquele ano dividida
// em 12 meses iguais; depois do último ano do Focus, a última anual.
export function ipcaMesAMes(
  mensais: ExpectativaMensal[],
  anuais: ExpectativaAnual[],
  inicio: AnoMes,
  meses: number,
): number[] {
  const porMes = new Map(mensais.map((mensal) => [`${mensal.anoMes.ano}-${mensal.anoMes.mes}`, mensal.mediana]));
  const porAno = new Map(anuais.map((anual) => [anual.ano, anual.mediana]));
  const ultimaAnual = anuais[anuais.length - 1]?.mediana ?? 0;

  return Array.from({ length: meses }, (_, k) => {
    const mes = somarMeses(inicio, k);
    return porMes.get(`${mes.ano}-${mes.mes}`) ?? anualParaMensal(porAno.get(mes.ano) ?? ultimaAnual);
  });
}

// CDI (ou Selic over) diário de cada mês, no formato das séries diárias do Banco Central: 21 dias úteis por mês
export function taxasDiariasProjetadas(selicAnual: number[]): number[][] {
  return selicAnual.map((selic) => {
    const diaria = ((1 + (selic - spreadCdi) / 100) ** (1 / 252) - 1) * 100;
    return Array.from({ length: diasUteisPorMes }, () => diaria);
  });
}

// Rendimento da poupança (% ao mês), pela regra em vigor desde 2012
export function poupancaMesAMes(selicAnual: number[], trMensal: number): number[] {
  return selicAnual.map((selic) => {
    const base = selic > limiteRegraPoupanca ? 0.5 : anualParaMensal(0.7 * selic);
    return ((1 + base / 100) * (1 + trMensal / 100) - 1) * 100;
  });
}
