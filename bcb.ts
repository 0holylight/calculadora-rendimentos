// Fetch, response.ok, .json, map, export que recebe o código da série.
import type { Registro } from "./types.ts";

export async function dadosExtraidos(
  codigo: number,
  tempo: number,
): Promise<Array<number>> {
  const fonteBcb = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/${tempo}?formato=json`;
  // Tempo conta registros, algumas execuções podem resultar nos ultimos 12 dias, outros, 12 meses.

  const response = await fetch(fonteBcb);
  if (!response.ok) {
    throw new Error(`Erro ao buscar as infos da base do Banco Central`);
  }
  const result = await response.json();

  const dadosConvertidos = result.map((registro: Registro) =>
    Number(registro.valor),
  );

  return dadosConvertidos;
}
