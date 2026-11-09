export function calculoFator(taxas: number[]): number {
  let fator = 1;
  for (const taxaMes of taxas) {
    fator = fator * (1 + taxaMes / 100);
  }
  return fator;
}

export function fatorParaTaxa(fator: number): number {
  const percentual = (fator - 1) * 100;
  return percentual;
}

export function transformarValor(valor: number, fator: number): number {
  // Dinheiro X Fator = Como o Dinheiro se transformou diante das condições do período.
  const transformado = valor * fator;
  return transformado;
}
