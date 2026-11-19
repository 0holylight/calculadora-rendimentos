import { describe, expect, test } from "vitest";
import { referenciaDesatualizada } from "./referencias.ts";

const revisado = { ano: 2026, mes: 11 };

describe("validade das faixas de referência", () => {
  test("até 6 meses depois da revisão, a referência vale", () => {
    expect(referenciaDesatualizada({ ano: 2026, mes: 11 }, revisado)).toBe(false);
    expect(referenciaDesatualizada({ ano: 2027, mes: 5 }, revisado)).toBe(false);
  });

  test("a partir do 7º mês, a página avisa que pode estar desatualizada", () => {
    expect(referenciaDesatualizada({ ano: 2027, mes: 6 }, revisado)).toBe(true);
  });
});
