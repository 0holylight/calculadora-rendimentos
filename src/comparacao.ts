// "O custo de deixar na poupança": a diferença entre a melhor alternativa e a poupança.
// Só entra na comparação o que poderia ser sacado inteiro no fim (sem carência).
// Usado pela página e pela imagem de compartilhar, para as duas mostrarem sempre o mesmo número.
import type { ResultadoAplicacao } from "./types.ts";

export type CustoDaPoupanca = {
  melhor: ResultadoAplicacao;
  diferenca: number; // em R$: quanto a melhor alternativa teria a mais que a poupança
};

// null quando não há poupança na lista ou quando nenhuma alternativa rendeu mais que ela
export function custoDaPoupanca(aplicacoes: ResultadoAplicacao[]): CustoDaPoupanca | null {
  const poupanca = aplicacoes.find((aplicacao) => aplicacao.id === "poupanca");
  const [melhor] = aplicacoes
    .filter((aplicacao) => aplicacao.id !== "poupanca" && aplicacao.emCarencia === 0)
    .toSorted((a, b) => b.valorFinal - a.valorFinal);
  if (poupanca === undefined || melhor === undefined) {
    return null;
  }
  const diferenca = melhor.valorFinal - poupanca.valorFinal;
  return diferenca >= 0.005 ? { melhor, diferenca } : null;
}
