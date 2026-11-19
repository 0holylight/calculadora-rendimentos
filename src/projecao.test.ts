import { describe, expect, test } from "vitest";
import {
  anualParaMensal,
  ipcaMesAMes,
  poupancaMesAMes,
  selicMesAMes,
  taxasDiariasProjetadas,
} from "./projecao.ts";
import { taxasParaFator } from "./calculos.ts";

const nov26 = { ano: 2026, mes: 11 };
const dez26 = { ano: 2026, mes: 12 };

describe("projeção", () => {
  test("12% ao ano dá ~0,949% ao mês (composto, não 1%)", () => {
    expect(anualParaMensal(12)).toBeCloseTo(0.9489, 4);
    expect(taxasParaFator(Array(12).fill(anualParaMensal(12)))).toBeCloseTo(1.12, 10);
  });

  test("Selic: linha reta da meta de hoje até a mediana do fim de cada ano", () => {
    // hoje (nov/26) 14%; fim de 2026 14%; fim de 2027 12%: cai 2 p.p. em 12 meses
    const anuais = [
      { ano: 2026, mediana: 14 },
      { ano: 2027, mediana: 12 },
    ];
    const selic = selicMesAMes(14, nov26, anuais, dez26, 14);
    expect(selic[0]).toBeCloseTo(14, 10); // dez/26
    expect(selic[6]).toBeCloseTo(13, 10); // jun/27, metade do caminho
    expect(selic[12]).toBeCloseTo(12, 10); // dez/27
    expect(selic[13]).toBeCloseTo(12, 10); // depois do último ano, fica no último valor
  });

  test("IPCA: usa a expectativa mensal quando existe e a anual dividida em 12 quando não", () => {
    const mensais = [{ anoMes: dez26, mediana: 0.5 }];
    const anuais = [{ ano: 2027, mediana: 4 }];
    const ipca = ipcaMesAMes(mensais, anuais, dez26, 3);
    expect(ipca[0]).toBe(0.5);
    expect(ipca[1]).toBeCloseTo(anualParaMensal(4), 10);
    expect(ipca[2]).toBeCloseTo(anualParaMensal(4), 10);
  });

  test("CDI diário: 252 dias úteis rendem a Selic menos 0,10 p.p.", () => {
    const meses = taxasDiariasProjetadas(Array(12).fill(14));
    expect(meses).toHaveLength(12);
    expect(meses[0]).toHaveLength(21);
    expect(taxasParaFator(meses.flat())).toBeCloseTo(1.139, 10);
  });

  test("poupança: 0,5% + TR com Selic alta; 70% da Selic + TR com Selic baixa", () => {
    const [alta, baixa] = poupancaMesAMes([14, 8], 0.1);
    expect(alta).toBeCloseTo((1.005 * 1.001 - 1) * 100, 10);
    expect(baixa).toBeCloseTo(((1 + anualParaMensal(5.6) / 100) * 1.001 - 1) * 100, 10);
  });
});
