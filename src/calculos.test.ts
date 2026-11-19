// Testes do cozinheiro: cada conta com números pequenos, que dá para conferir de cabeça.
import { describe, expect, test } from "vitest";
import {
  aliquotaIof,
  aliquotaIr,
  desempenho,
  diasDoPrazo,
  percentualEquivalenteCdb,
  fatorParaTaxa,
  fatoresAteOFim,
  fatoresDiariosPorMes,
  fatoresMensais,
  inflacaoDoPeriodo,
  listaDeAportes,
  regrasCdb,
  regrasLciLca,
  regrasPoupanca,
  regrasTesouroSelic,
  somar,
  taxasParaFator,
  trajetoria,
} from "./calculos.ts";

describe("taxas e fatores", () => {
  test("acumular é multiplicar: 1% + 1% = 2,01%", () => {
    expect(taxasParaFator([1, 1])).toBeCloseTo(1.0201, 10);
    expect(fatorParaTaxa(1.0201)).toBeCloseTo(2.01, 10);
  });

  test("lista vazia não rende nada", () => {
    expect(taxasParaFator([])).toBe(1);
  });

  test("série mensal vira um fator por mês", () => {
    expect(fatoresMensais([1, 2])).toEqual([1.01, 1.02]);
  });

  test("o fator do mês é o produto dos dias úteis", () => {
    const [fator] = fatoresDiariosPorMes([[0.05, 0.05, 0.05]]);
    expect(fator).toBeCloseTo(1.0005 ** 3, 12);
  });

  test("110% do CDI multiplica a TAXA de cada dia, não o fator", () => {
    const [fator] = fatoresDiariosPorMes([[1]], 110);
    expect(fator).toBeCloseTo(1.011, 12); // e não 1,01 × 1,1 = 1,111
  });

  test("fatoresAteOFim: quanto o dinheiro de cada mês cresce até o fim", () => {
    const [primeiro, segundo] = fatoresAteOFim([1.1, 1.2]);
    expect(primeiro).toBeCloseTo(1.32, 12);
    expect(segundo).toBeCloseTo(1.2, 12);
  });
});

describe("regras fixas", () => {
  test("IR regressivo muda de faixa nos dias 181, 361 e 721", () => {
    expect(aliquotaIr(180)).toBe(0.225);
    expect(aliquotaIr(181)).toBe(0.2);
    expect(aliquotaIr(360)).toBe(0.2);
    expect(aliquotaIr(361)).toBe(0.175);
    expect(aliquotaIr(720)).toBe(0.175);
    expect(aliquotaIr(721)).toBe(0.15);
  });

  test("IOF: 96% no 1º dia, 3% no 29º e zero a partir do 30º", () => {
    expect(aliquotaIof(1)).toBe(0.96);
    expect(aliquotaIof(29)).toBe(0.03);
    expect(aliquotaIof(30)).toBe(0);
    expect(aliquotaIof(400)).toBe(0);
  });
});

describe("taxa equivalente", () => {
  test("12 meses viram 365 dias e 6 meses, 183", () => {
    expect(diasDoPrazo(12)).toBe(365);
    expect(diasDoPrazo(6)).toBe(183);
  });

  test("LCI de 90% em 1 ano equivale a um CDB de ~109% (o CDB paga 17,5% de IR)", () => {
    expect(percentualEquivalenteCdb(90, 365)).toBeCloseTo(90 / 0.825, 10);
  });

  test("quanto menor o prazo, maior o IR, e maior o CDB equivalente", () => {
    expect(percentualEquivalenteCdb(90, 100)).toBeGreaterThan(percentualEquivalenteCdb(90, 800));
  });
});

describe("aportes e inflação", () => {
  test("o valor inicial entra no 1º mês e o aporte nos seguintes", () => {
    expect(listaDeAportes(1000, 100, 3)).toEqual([1000, 100, 100]);
    expect(somar([1000, 100, 100])).toBe(1200);
  });

  test("cada aporte é corrigido pelo IPCA a partir do mês em que entrou", () => {
    const inflacao = inflacaoDoPeriodo([1000, 100], [1.01, 1.02]);
    // 1000 × 1,01 × 1,02 + 100 × 1,02
    expect(inflacao.montanteSobInflacao).toBeCloseTo(1132.2, 10);
    expect(inflacao.totalAplicado).toBe(1100);
    expect(inflacao.correcaoInflacao).toBeCloseTo(32.2, 10);
    expect(inflacao.taxaInflacao).toBeCloseTo(3.02, 10);
  });

  test("listas de tamanhos diferentes são um defeito e param a conta", () => {
    expect(() => inflacaoDoPeriodo([1000, 100], [1.01])).toThrow("tamanhos diferentes");
  });
});

describe("desempenho de uma aplicação", () => {
  test("poupança: sem impostos, ganho real = valor final − régua", () => {
    const resultado = desempenho([1000], [1.1], [31], regrasPoupanca, 1050);
    expect(resultado.ganhoBruto).toBeCloseTo(100, 10);
    expect(resultado.impostos).toBe(0);
    expect(resultado.valorFinal).toBeCloseTo(1100, 10);
    expect(resultado.ganhoReal).toBeCloseTo(50, 10);
    expect(resultado.taxaReal).toBeCloseTo((1100 / 1050 - 1) * 100, 10);
  });

  test("CDB com 10 dias: IOF de 66% e IR de 22,5% sobre o que sobrou", () => {
    const resultado = desempenho([1000], [1.1], [10], regrasCdb, 1000);
    expect(resultado.iof).toBeCloseTo(66, 10);
    expect(resultado.ir).toBeCloseTo(34 * 0.225, 10);
    expect(resultado.ganhoLiquido).toBeCloseTo(100 - 66 - 7.65, 10);
  });

  test("CDB com 365 dias: IR de 17,5%, sem IOF", () => {
    const resultado = desempenho([1000], [1.1], [365], regrasCdb, 1000);
    expect(resultado.iof).toBe(0);
    expect(resultado.ir).toBeCloseTo(17.5, 10);
  });

  test("com aportes, cada um paga o IR do seu próprio prazo", () => {
    // 1º aporte: 800 dias, rende 21% (1,1 × 1,1) → 15% de IR sobre 210
    // 2º aporte: 200 dias, rende 10% → 20% de IR sobre 100
    const resultado = desempenho([1000, 1000], [1.1, 1.1], [800, 200], regrasCdb, 2000);
    expect(resultado.ganhoBruto).toBeCloseTo(310, 10);
    expect(resultado.ir).toBeCloseTo(210 * 0.15 + 100 * 0.2, 10);
  });

  test("Tesouro Selic: custódia só sobre o que passa de R$ 10 mil", () => {
    // Saldo parado em R$ 20 mil por 12 meses: 0,20% ao ano sobre R$ 10 mil = R$ 20
    const meses = 12;
    const aportes = listaDeAportes(20_000, 0, meses);
    const resultado = desempenho(aportes, Array(meses).fill(1), Array(meses).fill(400), regrasTesouroSelic, 20_000);
    expect(resultado.custodia).toBeCloseTo(20, 10);

    const pequeno = desempenho([9_000], [1], [400], regrasTesouroSelic, 9_000);
    expect(pequeno.custodia).toBe(0);
  });

  test("LCI/LCA: isenta de IR, e aportes com menos de 270 dias ficam em carência", () => {
    const resultado = desempenho([1000, 500], [1.1, 1.1], [300, 200], regrasLciLca, 1500);
    expect(resultado.ir).toBe(0);
    expect(resultado.iof).toBe(0);
    expect(resultado.emCarencia).toBe(500);
  });

  test("a trajetória tem um ponto por mês e termina no valor final", () => {
    const aportes = [1000, 100, 100];
    const fatores = [1.01, 1.01, 1.01];
    const diasPorResgate = [[30], [61, 31], [92, 62, 31]];
    const pontos = trajetoria(aportes, fatores, diasPorResgate, regrasCdb);
    const final = desempenho(aportes, fatores, [92, 62, 31], regrasCdb, 1);
    expect(pontos).toHaveLength(3);
    expect(pontos[2]).toBeCloseTo(final.valorFinal, 10);
  });
});
