// Fornecedor: busca a série no Banco Central, valida o formato e converte data e valor (strings).
import type { AnoMes, Registro } from "./types.ts";
import { formatarMes, mesesEntre } from "./datas.ts";

const urlBase = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

type Leitura = {
  anoMes: AnoMes;
  taxa: number;
};

function ehRegistro(item: unknown): item is Registro {
  return (
    typeof item === "object" &&
    item !== null &&
    "data" in item &&
    "valor" in item &&
    typeof item.data === "string" &&
    typeof item.valor === "string"
  );
}

function paraAnoMes(data: string, codigo: number): AnoMes {
  const partes = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(data);
  if (partes === null) {
    throw new Error(`Data inválida na série ${codigo}: "${data}"`);
  }
  return { ano: Number(partes[2]), mes: Number(partes[1]) };
}

function paraDataBcb(anoMes: AnoMes): string {
  return `01/${formatarMes(anoMes)}`;
}

async function buscarLeituras(url: string, codigo: number): Promise<Leitura[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Erro ao buscar a série ${codigo} no Banco Central (HTTP ${response.status})`,
    );
  }

  const result: unknown = await response.json();

  if (!Array.isArray(result)) {
    throw new Error(`A série ${codigo} não veio como lista`);
  }
  if (result.length === 0) {
    throw new Error(`A série ${codigo} veio vazia`);
  }
  if (!result.every(ehRegistro)) {
    throw new Error(`A série ${codigo} tem itens fora do formato { data, valor }`);
  }

  return result.map((registro) => {
    const taxa = Number(registro.valor);
    if (registro.valor.trim() === "" || !Number.isFinite(taxa)) {
      throw new Error(
        `Valor inválido na série ${codigo} em ${registro.data}: "${registro.valor}"`,
      );
    }
    return { anoMes: paraAnoMes(registro.data, codigo), taxa };
  });
}

export async function ultimoMes(codigo: number): Promise<AnoMes> {
  const leituras = await buscarLeituras(
    `${urlBase}.${codigo}/dados/ultimos/1?formato=json`,
    codigo,
  );
  const [ultima] = leituras;
  if (ultima === undefined) {
    throw new Error(`A série ${codigo} não informou o último mês`);
  }
  return ultima.anoMes;
}

export async function taxasMensais(
  codigo: number,
  inicio: AnoMes,
  fim: AnoMes,
): Promise<number[]> {
  const leituras = await buscarLeituras(
    `${urlBase}.${codigo}/dados?formato=json&dataInicial=${paraDataBcb(inicio)}&dataFinal=${paraDataBcb(fim)}`,
    codigo,
  );

  const ordenadas = leituras.toSorted((a, b) => mesesEntre(b.anoMes, a.anoMes));

  const esperados = mesesEntre(inicio, fim) + 1;
  const mesesCorretos = ordenadas.every(
    (leitura, posicao) => mesesEntre(inicio, leitura.anoMes) === posicao,
  );
  if (ordenadas.length !== esperados || !mesesCorretos) {
    throw new Error(
      `A série ${codigo} não cobre os ${esperados} meses de ${formatarMes(inicio)} a ${formatarMes(fim)} (veio ${ordenadas.length})`,
    );
  }

  return ordenadas.map((leitura) => leitura.taxa);
}
