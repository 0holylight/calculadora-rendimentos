// Fornecedor 2: as expectativas do mercado (Boletim Focus), na API Olinda do Banco Central.
// Mesmo papel do bcb.ts: busca, valida o formato (o JSON chega como unknown) e devolve só números.
// Usa sempre o boletim mais recente: a consulta vem ordenada por data, e ficam só as linhas da data mais nova.
import type { AnoMes } from "./types.ts";
import { ErroBancoCentral } from "./erros.ts";

const urlBase = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata";

export type ExpectativaAnual = { ano: number; mediana: number };
export type ExpectativaMensal = { anoMes: AnoMes; mediana: number };
export type Boletim<T> = { data: string; valores: T[] }; // data no formato aaaa-mm-dd

type Linha = { Data: string; DataReferencia: string; Mediana: number };

function ehLinha(item: unknown): item is Linha {
  return (
    typeof item === "object" &&
    item !== null &&
    "Data" in item &&
    "DataReferencia" in item &&
    "Mediana" in item &&
    typeof item.Data === "string" &&
    typeof item.DataReferencia === "string" &&
    typeof item.Mediana === "number" &&
    Number.isFinite(item.Mediana)
  );
}

// Cache de 15 minutos, como no bcb.ts (o Focus só muda uma vez por semana)
const validadeDoCache = 15 * 60 * 1000;
const cache = new Map<string, { guardadoEm: number; linhas: Promise<readonly Linha[]> }>();

function consultar(recurso: string, filtro: string): Promise<readonly Linha[]> {
  const url =
    `${urlBase}/${recurso}?$format=json&$top=60&$orderby=Data%20desc` +
    `&$select=Data,DataReferencia,Mediana&$filter=${encodeURIComponent(filtro)}`;
  const guardado = cache.get(url);
  if (guardado !== undefined && Date.now() - guardado.guardadoEm < validadeDoCache) {
    return guardado.linhas;
  }
  const linhas = buscar(url, recurso);
  cache.set(url, { guardadoEm: Date.now(), linhas });
  linhas.catch(() => cache.delete(url)); // busca que falhou não fica guardada
  return linhas;
}

async function buscar(url: string, recurso: string): Promise<Linha[]> {
  const response = await fetch(url).catch((causa: unknown) => {
    throw new ErroBancoCentral(`Sem conexão com o Boletim Focus (${recurso})`, { cause: causa });
  });
  if (!response.ok) {
    throw new ErroBancoCentral(`Erro ao buscar o Boletim Focus (${recurso}, HTTP ${response.status})`);
  }
  const corpo: unknown = await response.json().catch((causa: unknown) => {
    throw new ErroBancoCentral(`O Boletim Focus (${recurso}) não veio em JSON`, { cause: causa });
  });
  if (typeof corpo !== "object" || corpo === null || !("value" in corpo) || !Array.isArray(corpo.value)) {
    throw new ErroBancoCentral(`O Boletim Focus (${recurso}) veio fora do formato`);
  }
  const linhas: unknown[] = corpo.value;
  if (linhas.length === 0) {
    throw new ErroBancoCentral(`O Boletim Focus (${recurso}) veio vazio`);
  }
  if (!linhas.every(ehLinha)) {
    throw new ErroBancoCentral(`O Boletim Focus (${recurso}) tem linhas fora do formato`);
  }
  return linhas;
}

// Só as linhas do boletim mais recente (a lista já vem da data mais nova para a mais antiga)
function maisRecente(linhas: readonly Linha[]): { data: string; linhas: Linha[] } {
  const data = linhas[0]?.Data ?? "";
  return { data, linhas: linhas.filter((linha) => linha.Data === data) };
}

// Mediana esperada para o fim de cada ano (Selic) ou para o ano inteiro (IPCA)
export async function expectativasAnuais(indicador: "Selic" | "IPCA"): Promise<Boletim<ExpectativaAnual>> {
  const { data, linhas } = maisRecente(
    await consultar("ExpectativasMercadoAnuais", `Indicador eq '${indicador}' and baseCalculo eq 0`),
  );
  const valores = linhas
    .map((linha) => ({ ano: Number(linha.DataReferencia), mediana: linha.Mediana }))
    .filter((valor) => Number.isInteger(valor.ano))
    .toSorted((a, b) => a.ano - b.ano);
  if (valores.length === 0) {
    throw new ErroBancoCentral(`O Boletim Focus não trouxe expectativas anuais de ${indicador}`);
  }
  return { data, valores };
}

// IPCA esperado mês a mês (o Focus cobre cerca de 2 anos à frente)
export async function ipcaMensalEsperado(): Promise<Boletim<ExpectativaMensal>> {
  const { data, linhas } = maisRecente(
    await consultar("ExpectativaMercadoMensais", "Indicador eq 'IPCA' and baseCalculo eq 0"),
  );
  const valores: ExpectativaMensal[] = [];
  for (const linha of linhas) {
    const partes = /^(\d{2})\/(\d{4})$/.exec(linha.DataReferencia);
    if (partes !== null) {
      valores.push({ anoMes: { ano: Number(partes[2]), mes: Number(partes[1]) }, mediana: linha.Mediana });
    }
  }
  return { data, valores };
}
