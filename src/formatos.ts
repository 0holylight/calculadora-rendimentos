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

const mesCurto = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });

// "nov. de 25" vira "nov/25", para os rótulos do gráfico
export function formatarMesCurto(anoMes: AnoMes): string {
  const partes = mesCurto.formatToParts(new Date(anoMes.ano, anoMes.mes - 1, 1));
  const mes = partes.find((parte) => parte.type === "month")?.value.replace(".", "") ?? "";
  const ano = partes.find((parte) => parte.type === "year")?.value ?? "";
  return `${mes}/${ano}`;
}

const reaisCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const reaisInteiros = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

// Eixo do gráfico: "R$ 500" abaixo de 10 mil, "R$ 12 mil" a partir daí
export function formatarReaisEixo(valor: number, compacto: boolean): string {
  return compacto ? reaisCompacto.format(valor) : reaisInteiros.format(valor);
}
