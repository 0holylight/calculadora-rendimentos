// Link compartilhável: o pedido vai para o endereço da página (?valor=1000&meses=12...) e volta dele.
// O link guarda o PEDIDO, não o resultado: quem abre vê a simulação refeita com os dados mais recentes.
import type { Modo, Pedido } from "./types.ts";

// Os campos do formulário, como texto (é assim que o React guarda o que foi digitado), mais o modo
export type Campos = {
  modo: Modo;
  valor: string;
  meses: string;
  aporte: string;
  cdb: string;
  lci: string;
};

export const camposPadrao: Campos = {
  modo: "historico",
  valor: "1000",
  meses: "12",
  aporte: "0",
  cdb: "100",
  lci: "90",
};

const numericos = ["valor", "meses", "aporte", "cdb", "lci"] as const;

// Monta "valor=1000&meses=12&aporte=200". Campos com o valor padrão ficam de fora, para o link ficar curto.
export function pedidoParaParametros(pedido: Pedido): URLSearchParams {
  const campos: Campos = {
    modo: pedido.modo,
    valor: String(pedido.valor),
    meses: String(pedido.meses),
    aporte: String(pedido.aporteMensal),
    cdb: String(pedido.percentualCdb),
    lci: String(pedido.percentualLciLca),
  };
  const parametros = new URLSearchParams();
  if (campos.modo !== camposPadrao.modo) {
    parametros.set("modo", campos.modo);
  }
  for (const nome of numericos) {
    if (nome === "valor" || nome === "meses" || campos[nome] !== camposPadrao[nome]) {
      parametros.set(nome, campos[nome]);
    }
  }
  return parametros;
}

// Lê o endereço. Devolve null se o link não traz uma simulação (sem valor e meses).
// Parâmetro que não é número é ignorado e fica com o padrão: a validação de verdade continua no simular.
export function parametrosParaCampos(parametros: URLSearchParams): Campos | null {
  if (!parametros.has("valor") || !parametros.has("meses")) {
    return null;
  }
  const campos: Campos = {
    ...camposPadrao,
    modo: parametros.get("modo") === "projecao" ? "projecao" : "historico",
  };
  for (const nome of numericos) {
    const texto = parametros.get(nome)?.trim();
    if (texto !== undefined && texto !== "" && Number.isFinite(Number(texto))) {
      campos[nome] = texto;
    }
  }
  return campos;
}

export function camposParaPedido(campos: Campos): Pedido {
  return {
    modo: campos.modo,
    valor: Number(campos.valor),
    meses: Number(campos.meses),
    aporteMensal: Number(campos.aporte),
    percentualCdb: Number(campos.cdb),
    percentualLciLca: Number(campos.lci),
  };
}
