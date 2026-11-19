// Contas puras com meses. Trabalha com { ano, mes } em vez de Date para fugir de fuso horário e do mês/dia do JS.
import type { AnoMes } from "./types.ts";

const msPorDia = 24 * 60 * 60 * 1000;

function paraIndice(anoMes: AnoMes): number {
  return anoMes.ano * 12 + (anoMes.mes - 1);
}

function deIndice(indice: number): AnoMes {
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

// Dia 1º do mês, em milissegundos UTC (sem fuso), só para contar dias
function primeiroDiaUtc(anoMes: AnoMes): number {
  return Date.UTC(anoMes.ano, anoMes.mes - 1, 1);
}

export function somarMeses(anoMes: AnoMes, meses: number): AnoMes {
  return deIndice(paraIndice(anoMes) + meses);
}

export function inicioDaJanela(fim: AnoMes, meses: number): AnoMes {
  return somarMeses(fim, -(meses - 1));
}

export function mesesEntre(inicio: AnoMes, fim: AnoMes): number {
  return paraIndice(fim) - paraIndice(inicio);
}

export function formatarMes(anoMes: AnoMes): string {
  return `${String(anoMes.mes).padStart(2, "0")}/${anoMes.ano}`;
}

// Dia 0 do mês seguinte = último dia deste mês (o Date.UTC faz a volta sozinho)
export function ultimoDiaDoMes(anoMes: AnoMes): number {
  return new Date(Date.UTC(anoMes.ano, anoMes.mes, 0)).getUTCDate();
}

// Dias corridos entre o dia 1º de dois meses
export function diasCorridos(inicio: AnoMes, fim: AnoMes): number {
  return Math.round((primeiroDiaUtc(fim) - primeiroDiaUtc(inicio)) / msPorDia);
}

// Para cada mês da janela: quantos dias corridos o aporte feito no dia 1º daquele mês fica aplicado,
// até o resgate no dia 1º do mês seguinte ao fim. O IR e o IOF dependem desse número.
export function diasAteOResgate(inicio: AnoMes, fim: AnoMes): number[] {
  const resgate = somarMeses(fim, 1);
  const meses = mesesEntre(inicio, fim) + 1;
  return Array.from({ length: meses }, (_, i) => diasCorridos(somarMeses(inicio, i), resgate));
}

// Para cada mês k da janela: os dias de cada aporte (0..k) se o resgate fosse no dia 1º do mês seguinte a k.
// É o que a trajetória mês a mês precisa para calcular o IR "se eu tivesse sacado ali".
export function diasPorResgate(inicio: AnoMes, fim: AnoMes): number[][] {
  const meses = mesesEntre(inicio, fim) + 1;
  return Array.from({ length: meses }, (_, k) => diasAteOResgate(inicio, somarMeses(inicio, k)));
}
