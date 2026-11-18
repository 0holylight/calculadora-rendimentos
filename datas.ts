// Contas puras com meses. Trabalha com { ano, mes } em vez de Date para fugir de fuso horário e do mês/dia do JS.
import type { AnoMes } from "./types.ts";

function paraIndice(anoMes: AnoMes): number {
  return anoMes.ano * 12 + (anoMes.mes - 1);
}

function deIndice(indice: number): AnoMes {
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

export function inicioDaJanela(fim: AnoMes, meses: number): AnoMes {
  return deIndice(paraIndice(fim) - (meses - 1));
}

export function mesesEntre(inicio: AnoMes, fim: AnoMes): number {
  return paraIndice(fim) - paraIndice(inicio);
}

export function formatarMes(anoMes: AnoMes): string {
  return `${String(anoMes.mes).padStart(2, "0")}/${anoMes.ano}`;
}
