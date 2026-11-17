export function taxasParaFator(taxas: number[]): number {
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

export function aplicarFator(valor: number, fator: number): number {
  const transformado = valor * fator;
  return transformado;
}

export function ganhoSobreReferencia(
  valor: number,
  fatorAplicacao: number,
  fatorReferencia: number,
): number {
  const ganho = valor * fatorAplicacao - valor * fatorReferencia;
  return ganho;
}

export function fatorReal(
  fatorAplicacao: number,
  fatorReferencia: number,
): number {
  const real = fatorAplicacao / fatorReferencia;
  return real;
}
