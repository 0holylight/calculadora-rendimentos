// A projeção de ponta a ponta, com o Banco Central e o Focus de mentira e a data de hoje fixa (19/11/2026).
import { afterEach, describe, expect, test, vi } from "vitest";
import { simular } from "./simulacao.ts";

function json(dados: unknown): Response {
  return new Response(JSON.stringify(dados), { status: 200 });
}

const boletim = "2026-11-13";

function responder(url: string): Response {
  if (url.includes("bcdata.sgs.432")) return json([{ data: "01/11/2026", valor: "14.00" }]); // meta da Selic
  if (url.includes("bcdata.sgs.7811/dados/ultimos")) return json([{ data: "01/11/2026", valor: "0.1" }]); // TR
  if (url.includes("bcdata.sgs.7811/dados?")) {
    return json(
      Array.from({ length: 12 }, (_, i) => {
        const mes = ((10 + i) % 12) + 1; // dez/2025 a nov/2026
        const ano = mes === 12 ? 2025 : 2026;
        return { data: `01/${String(mes).padStart(2, "0")}/${ano}`, valor: "0.1" };
      }),
    );
  }
  if (url.includes("ExpectativasMercadoAnuais") && url.includes("'Selic'")) {
    return json({
      value: [
        { Data: boletim, DataReferencia: "2026", Mediana: 14 },
        { Data: boletim, DataReferencia: "2027", Mediana: 12 },
      ],
    });
  }
  if (url.includes("ExpectativasMercadoAnuais") && url.includes("'IPCA'")) {
    return json({
      value: [
        { Data: boletim, DataReferencia: "2026", Mediana: 5 },
        { Data: boletim, DataReferencia: "2027", Mediana: 4 },
      ],
    });
  }
  if (url.includes("ExpectativaMercadoMensais")) {
    return json({ value: [{ Data: boletim, DataReferencia: "12/2026", Mediana: 0.5 }] });
  }
  return new Response(null, { status: 404 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("projeção futura", () => {
  test("começa no mês que vem e usa as expectativas do Focus", async () => {
    vi.stubGlobal("fetch", (url: string) => Promise.resolve(responder(url)));
    const pedido = {
      modo: "projecao" as const,
      valor: 1000,
      meses: 12,
      aporteMensal: 0,
      percentualCdb: 100,
      percentualLciLca: 90,
    };
    const simulacao = await simular(pedido, new Date(2026, 10, 19));

    expect(simulacao.inicio).toEqual({ ano: 2026, mes: 12 });
    expect(simulacao.fim).toEqual({ ano: 2027, mes: 11 });
    expect(simulacao.premissas?.boletim).toBe(boletim);
    expect(simulacao.premissas?.selicInicial).toBeCloseTo(14, 10);
    // nov/27 está a 11/12 do caminho entre dez/26 (14%) e dez/27 (12%)
    expect(simulacao.premissas?.selicFinal).toBeCloseTo(14 - 2 * (11 / 12), 10);
    expect(simulacao.premissas?.trMensal).toBeCloseTo(0.1, 10);

    const poupanca = simulacao.aplicacoes.find((aplicacao) => aplicacao.id === "poupanca");
    // Selic acima de 8,5%: 0,5% ao mês + TR de 0,1%, por 12 meses
    expect(poupanca?.taxaBruta).toBeCloseTo(((1.005 * 1.001) ** 12 - 1) * 100, 8);

    const cdb = simulacao.aplicacoes.find((aplicacao) => aplicacao.id === "cdb");
    expect(cdb?.ir).toBeGreaterThan(0);
  });

  test("a projeção aceita no máximo 60 meses", async () => {
    vi.stubGlobal("fetch", (url: string) => Promise.resolve(responder(url)));
    const pedido = {
      modo: "projecao" as const,
      valor: 1000,
      meses: 61,
      aporteMensal: 0,
      percentualCdb: 100,
      percentualLciLca: 90,
    };
    await expect(simular(pedido)).rejects.toThrow("de 1 a 60");
  });
});
