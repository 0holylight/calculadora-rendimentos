// Faixas típicas de mercado, para quem não sabe se "100% do CDI" é muito ou pouco.
// NÃO são uma média oficial: não existe série pública e atualizada disso (a do Banco Central, 28663, parou em
// jan/2024). São faixas aproximadas de ofertas para pessoa física, conferidas em notícias.
// Revisão a cada 3 meses: um workflow do GitHub abre uma issue para lembrar (.github/workflows/lembrete-referencias.yml).
// Ao revisar, atualize também o revisadoEm.
import type { AnoMes } from "./types.ts";
import { mesesEntre } from "./datas.ts";

export const faixasDeMercado = {
  revisadoEm: { ano: 2026, mes: 11 } satisfies AnoMes,
  cdb: { minimo: 90, maximo: 120 }, // grandes bancos na parte de baixo; bancos médios e digitais, mais acima
  lciLca: { minimo: 85, maximo: 95 },
};

// Depois deste prazo sem revisão, a página avisa que a referência pode estar desatualizada
export const validadeEmMeses = 6;

export function referenciaDesatualizada(hoje: AnoMes, revisadoEm: AnoMes = faixasDeMercado.revisadoEm): boolean {
  return mesesEntre(revisadoEm, hoje) > validadeEmMeses;
}
