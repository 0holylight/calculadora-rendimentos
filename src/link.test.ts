import { describe, expect, test } from "vitest";
import { camposPadrao, camposParaPedido, parametrosParaCampos, pedidoParaParametros } from "./link.ts";

const pedido = { valor: 500, meses: 12, aporteMensal: 200, percentualCdb: 100, percentualLciLca: 90 };

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

  test("link sem valor ou meses não é uma simulação", () => {
    expect(parametrosParaCampos(new URLSearchParams(""))).toBeNull();
    expect(parametrosParaCampos(new URLSearchParams("valor=500"))).toBeNull();
  });

  test("parâmetro que não é número fica com o padrão", () => {
    const campos = parametrosParaCampos(new URLSearchParams("valor=500&meses=12&aporte=abc&cdb="));
    expect(campos).toEqual({ ...camposPadrao, valor: "500", meses: "12" });
  });
});
