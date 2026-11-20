import { describe, expect, test } from "vitest";
import { camposPadrao, camposParaPedido, parametrosParaCampos, pedidoParaParametros } from "./link.ts";

const pedido = {
  modo: "historico" as const,
  valor: 500,
  meses: 12,
  aporteMensal: 200,
  percentualCdb: 100,
  percentualLciLca: 90,
};

describe("link compartilhável", () => {
  test("só os campos diferentes do padrão entram no link (valor e meses sempre)", () => {
    expect(pedidoParaParametros(pedido).toString()).toBe("valor=500&meses=12&aporte=200");
    expect(pedidoParaParametros({ ...pedido, aporteMensal: 0, percentualCdb: 110 }).toString()).toBe(
      "valor=500&meses=12&cdb=110",
    );
  });

  test("ida e volta: o pedido que sai no link é o mesmo que volta dele", () => {
    const campos = parametrosParaCampos(pedidoParaParametros(pedido));
    expect(campos).not.toBeNull();
    if (campos !== null) {
      expect(camposParaPedido(campos)).toEqual(pedido);
    }
  });

  test("o modo projeção vai para o link; o padrão (olhando para trás) fica de fora", () => {
    expect(pedidoParaParametros({ ...pedido, modo: "projecao" }).toString()).toBe(
      "modo=projecao&valor=500&meses=12&aporte=200",
    );
    expect(parametrosParaCampos(new URLSearchParams("modo=projecao&valor=1&meses=2"))?.modo).toBe("projecao");
    expect(parametrosParaCampos(new URLSearchParams("modo=xyz&valor=1&meses=2"))?.modo).toBe("historico");
  });

  test("link sem valor ou meses não é uma simulação", () => {
    expect(parametrosParaCampos(new URLSearchParams(""))).toBeNull();
    expect(parametrosParaCampos(new URLSearchParams("valor=500"))).toBeNull();
  });

  test("parâmetro que não é número fica com o padrão", () => {
    const campos = parametrosParaCampos(new URLSearchParams("valor=500&meses=12&aporte=abc&cdb="));
    expect(campos).toEqual({ ...camposPadrao, valor: "500", meses: "12" });
  });
});
