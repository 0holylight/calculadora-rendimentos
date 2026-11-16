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
  // Dinheiro X Fator = Como o Dinheiro se transformou diante das condições do período.
  const transformado = valor * fator;
  return transformado;
}

// BASE DE CÁLCULO APLICAÇAO (valor × fatorPoup − valor x referênciaDeGanho) -> 1, IPCA
export function ganhoSobreReferencia(valor: number, fatorAplicacao: number, fatorReferencia: number): number {
  const ganho = ((valor * fatorAplicacao) - (valor * fatorReferencia));
  return ganho;
}

