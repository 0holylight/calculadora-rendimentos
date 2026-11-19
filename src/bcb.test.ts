// Testes do fornecedor com um Banco Central de mentira: o fetch é trocado por uma função que responde
// o que o teste quiser (304, lista vazia, valor em branco...). Assim os testes não dependem da internet.
// Cada teste usa um código de série diferente, porque o cache do bcb.ts guarda as buscas entre os testes.
import { afterEach, describe, expect, test, vi } from "vitest";
import { taxasDiariasPorMes, taxasMensais, ultimoMes } from "./bcb.ts";
import { ErroBancoCentral, ErroPedido } from "./erros.ts";
import { simular } from "./simulacao.ts";

type Registro = { data: string; valor: string | number };

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), { status });
}

function fingirBancoCentral(responder: (url: string) => Response | Promise<Response>) {
  const falso = vi.fn((url: string) => Promise.resolve(responder(url)));
  vi.stubGlobal("fetch", falso);
  return falso;
}

const nov25 = { ano: 2025, mes: 11 };
const dez25 = { ano: 2025, mes: 12 };
const jan26 = { ano: 2026, mes: 1 };

const tresMeses: Registro[] = [
  { data: "01/01/2026", valor: "0.3" },
  { data: "01/12/2025", valor: "0.2" },
  { data: "01/11/2025", valor: "0.1" },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("taxasMensais", () => {
  test("converte texto em número e ordena do mês mais antigo para o mais novo", async () => {
    fingirBancoCentral(() => json(tresMeses));
    expect(await taxasMensais(9001, nov25, jan26)).toEqual([0.1, 0.2, 0.3]);
  });

  test("HTTP 304 sem corpo: tenta a URL alternativa", async () => {
    const falso = fingirBancoCentral((url) =>
      url.includes("dataFinal=01/") ? new Response(null, { status: 304 }) : json(tresMeses),
    );
    expect(await taxasMensais(9002, nov25, jan26)).toEqual([0.1, 0.2, 0.3]);
    expect(falso).toHaveBeenCalledTimes(2);
  });

  test("HTTP 304 em todas as tentativas vira ErroBancoCentral", async () => {
    fingirBancoCentral(() => new Response(null, { status: 304 }));
    await expect(taxasMensais(9003, nov25, jan26)).rejects.toThrow(ErroBancoCentral);
  });

  test("HTTP 500 vira ErroBancoCentral com o status na mensagem", async () => {
    fingirBancoCentral(() => json({}, 500));
    await expect(taxasMensais(9004, nov25, jan26)).rejects.toThrow("HTTP 500");
  });

  test("sem internet vira ErroBancoCentral", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(taxasMensais(9005, nov25, jan26)).rejects.toThrow(ErroBancoCentral);
  });

  test("lista vazia é erro", async () => {
    fingirBancoCentral(() => json([]));
    await expect(taxasMensais(9006, nov25, jan26)).rejects.toThrow("veio vazia");
  });

  test('valor em branco é erro (Number("") daria 0 sem avisar)', async () => {
    fingirBancoCentral(() => json([{ data: "01/11/2025", valor: " " }]));
    await expect(taxasMensais(9007, nov25, nov25)).rejects.toThrow("Valor inválido");
  });

  test("valor que chega como número, e não como texto, está fora do formato", async () => {
    fingirBancoCentral(() => json([{ data: "01/11/2025", valor: 0.1 }]));
    await expect(taxasMensais(9008, nov25, nov25)).rejects.toThrow("fora do formato");
  });

  test("um mês faltando é erro (o acumulado sairia errado sem aviso)", async () => {
    fingirBancoCentral(() => json([tresMeses[0], tresMeses[2]]));
    await expect(taxasMensais(9009, nov25, jan26)).rejects.toThrow("não cobre");
  });

  test("a mesma busca repetida usa o cache e não vai ao Banco Central de novo", async () => {
    const falso = fingirBancoCentral(() => json(tresMeses));
    await taxasMensais(9010, nov25, jan26);
    await taxasMensais(9010, nov25, jan26);
    expect(falso).toHaveBeenCalledTimes(1);
  });

  test("uma busca que falhou não fica no cache", async () => {
    fingirBancoCentral(() => json({}, 500));
    await expect(taxasMensais(9011, nov25, jan26)).rejects.toThrow();
    fingirBancoCentral(() => json(tresMeses));
    expect(await taxasMensais(9011, nov25, jan26)).toEqual([0.1, 0.2, 0.3]);
  });
});

describe("ultimoMes", () => {
  test("fica com o registro mais recente, qualquer que seja a ordem", async () => {
    fingirBancoCentral(() => json([tresMeses[2], tresMeses[0]]));
    expect(await ultimoMes(9012)).toEqual(jan26);
  });
});

describe("taxasDiariasPorMes", () => {
  function diasUteis(mes: number, ano: number, quantos: number): Registro[] {
    return Array.from({ length: quantos }, (_, i) => ({
      data: `${String(i + 1).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`,
      valor: "0.05",
    }));
  }

  test("agrupa os dias úteis por mês", async () => {
    fingirBancoCentral(() => json([...diasUteis(11, 2025, 20), ...diasUteis(12, 2025, 21)]));
    const porMes = await taxasDiariasPorMes(9013, nov25, dez25);
    expect(porMes.map((dias) => dias.length)).toEqual([20, 21]);
  });

  test("descarta os dias do mês seguinte que vêm na URL alternativa", async () => {
    fingirBancoCentral(() => json([...diasUteis(11, 2025, 20), ...diasUteis(12, 2025, 2)]));
    const porMes = await taxasDiariasPorMes(9014, nov25, nov25);
    expect(porMes.map((dias) => dias.length)).toEqual([20]);
  });

  test("um mês com poucos dias indica série incompleta", async () => {
    fingirBancoCentral(() => json([...diasUteis(11, 2025, 20), ...diasUteis(12, 2025, 5)]));
    await expect(taxasDiariasPorMes(9015, nov25, dez25)).rejects.toThrow("incompleta");
  });
});

describe("simular", () => {
  test("pedido inválido vira ErroPedido antes de qualquer busca", async () => {
    const falso = fingirBancoCentral(() => json([]));
    const pedido = { valor: 0, meses: 12, aporteMensal: 0, percentualCdb: 100, percentualLciLca: 90 };
    await expect(simular(pedido)).rejects.toThrow(ErroPedido);
    await expect(simular({ ...pedido, valor: 1000, meses: 1.5 })).rejects.toThrow("número inteiro");
    await expect(simular({ ...pedido, valor: 1000, aporteMensal: -1 })).rejects.toThrow("negativo");
    expect(falso).not.toHaveBeenCalled();
  });
});
