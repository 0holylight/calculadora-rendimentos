import { describe, expect, test } from "vitest";
import { custoDaPoupanca } from "./comparacao.ts";
import type { ResultadoAplicacao } from "./types.ts";

// Só os campos que a comparação usa importam; o resto fica zerado
function aplicacao(id: ResultadoAplicacao["id"], valorFinal: number, emCarencia = 0): ResultadoAplicacao {
  return {
    id,
    nome: id,
    valorFinal,
    emCarencia,
    taxaBruta: 0,
    ganhoBruto: 0,
    iof: 0,
    ir: 0,
    custodia: 0,
    impostos: 0,
    ganhoLiquido: 0,
    ganhoReal: 0,
    taxaReal: 0,
    trajetoria: [],
  };
}

describe("custo de deixar na poupança", () => {
  test("compara com a melhor alternativa", () => {
    const custo = custoDaPoupanca([
      aplicacao("poupanca", 1080),
      aplicacao("cdb", 1110),
      aplicacao("tesouroSelic", 1100),
    ]);
    expect(custo?.melhor.id).toBe("cdb");
    expect(custo?.diferenca).toBeCloseTo(30, 10);
  });

  test("ignora quem ainda está em carência", () => {
    const custo = custoDaPoupanca([
      aplicacao("poupanca", 1080),
      aplicacao("lciLca", 1200, 500),
      aplicacao("cdb", 1110),
    ]);
    expect(custo?.melhor.id).toBe("cdb");
  });

  test("se a poupança foi a melhor, não há custo", () => {
    expect(custoDaPoupanca([aplicacao("poupanca", 1100), aplicacao("cdb", 1090)])).toBeNull();
  });
});
