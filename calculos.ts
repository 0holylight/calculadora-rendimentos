export function calculoTaxas(taxas: number[]): number {

  let fator = 1
  for (const taxaMes of taxas) {
    fator = fator * (1 + taxaMes / 100)
  }
  const valorAcumulado = ((fator - 1) * 100)
  return valorAcumulado
}
