// Testes das contas com meses e dias: viradas de ano e anos bissextos são onde as datas costumam quebrar.
import { describe, expect, test } from "vitest";
import {
  diasAteOResgate,
  diasCorridos,
  diasPorResgate,
  formatarMes,
  inicioDaJanela,
  mesesEntre,
  somarMeses,
  ultimoDiaDoMes,
} from "./datas.ts";

describe("meses", () => {
  test("somar meses atravessa a virada do ano nos dois sentidos", () => {
    expect(somarMeses({ ano: 2025, mes: 11 }, 2)).toEqual({ ano: 2026, mes: 1 });
    expect(somarMeses({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 });
    expect(somarMeses({ ano: 2026, mes: 10 }, -12)).toEqual({ ano: 2025, mes: 10 });
  });

  test("uma janela de 12 meses que termina em out/2026 começa em nov/2025", () => {
    expect(inicioDaJanela({ ano: 2026, mes: 10 }, 12)).toEqual({ ano: 2025, mes: 11 });
    expect(inicioDaJanela({ ano: 2026, mes: 10 }, 1)).toEqual({ ano: 2026, mes: 10 });
  });

  test("meses entre duas datas", () => {
    expect(mesesEntre({ ano: 2025, mes: 11 }, { ano: 2026, mes: 10 })).toBe(11);
    expect(mesesEntre({ ano: 2026, mes: 10 }, { ano: 2025, mes: 11 })).toBe(-11);
  });

  test("formata como mm/aaaa", () => {
    expect(formatarMes({ ano: 2026, mes: 3 })).toBe("03/2026");
  });
});

describe("dias", () => {
  test("fevereiro tem 29 dias em ano bissexto", () => {
    expect(ultimoDiaDoMes({ ano: 2024, mes: 2 })).toBe(29);
    expect(ultimoDiaDoMes({ ano: 2026, mes: 2 })).toBe(28);
    expect(ultimoDiaDoMes({ ano: 2026, mes: 12 })).toBe(31);
  });

  test("um ano tem 365 dias corridos, ou 366 se passar por um 29 de fevereiro", () => {
    expect(diasCorridos({ ano: 2025, mes: 11 }, { ano: 2026, mes: 11 })).toBe(365);
    expect(diasCorridos({ ano: 2024, mes: 1 }, { ano: 2025, mes: 1 })).toBe(366);
  });

  test("cada aporte conta os dias até o resgate, no dia 1º do mês seguinte ao fim", () => {
    // nov/25 → 01/02/26 = 30 + 31 + 31; dez/25 → 31 + 31; jan/26 → 31
    expect(diasAteOResgate({ ano: 2025, mes: 11 }, { ano: 2026, mes: 1 })).toEqual([92, 62, 31]);
  });

  test("a trajetória recebe os dias de cada resgate possível, mês a mês", () => {
    expect(diasPorResgate({ ano: 2025, mes: 11 }, { ano: 2026, mes: 1 })).toEqual([
      [30],
      [61, 31],
      [92, 62, 31],
    ]);
  });
});
