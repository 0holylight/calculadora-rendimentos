// Fornecedor: busca a série no Banco Central, valida o formato e converte valor (string) em número.
import type { Registro } from "./types.ts";

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

export async function dadosExtraidos(
  codigo: number,
  tempo: number,
): Promise<number[]> {
  const fonteBcb = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/${tempo}?formato=json`;
  // Tempo conta registros, algumas execuções podem resultar nos ultimos 12 dias, outros, 12 meses.

  const response = await fetch(fonteBcb);
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
    return taxa;
  });
}
