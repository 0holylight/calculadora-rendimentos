// Formatação para a tela, no padrão brasileiro. Só a exibição usa isto; as contas continuam com number.
import type { AnoMes } from "./types.ts";

const reais = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const duasCasas = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatarReais(valor: number): string {
  return reais.format(valor);
}

export function formatarTaxa(taxa: number): string {
  return `${duasCasas.format(taxa)}%`;
}

const mesPorExtenso = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

// O Date aqui só serve para o Intl escrever o nome do mês; as contas com meses continuam no datas.ts
export function formatarMesExtenso(anoMes: AnoMes): string {
  return mesPorExtenso.format(new Date(anoMes.ano, anoMes.mes - 1, 1));
}
