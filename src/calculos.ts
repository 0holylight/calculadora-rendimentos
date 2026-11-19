// Cozinheiro: contas puras (só números entram e saem) e as regras fixas de cada aplicação.
import type { Desempenho, Inflacao, RegrasAplicacao } from "./types.ts";

// ---------- Regras fixas ----------

export const regrasPoupanca: RegrasAplicacao = {
  tributada: false, // isenta de IR para pessoa física
  custodiaAnual: 0,
  isencaoCustodia: 0,
  carenciaDias: 0,
};

export const regrasCdb: RegrasAplicacao = {
  tributada: true,
  custodiaAnual: 0, // a maioria dos bancos não cobra custódia de CDB
  isencaoCustodia: 0,
  carenciaDias: 0, // considera CDB de liquidez diária
};

export const regrasLciLca: RegrasAplicacao = {
  tributada: false, // isenta de IR para pessoa física (e, pela carência, nunca paga IOF)
  custodiaAnual: 0,
  isencaoCustodia: 0,
  carenciaDias: 270, // regra do CMN de 2024: LCA com carência mínima de 9 meses (a LCI pode ser maior)
};

export const regrasTesouroSelic: RegrasAplicacao = {
  tributada: true,
  custodiaAnual: 0.002, // taxa da B3: 0,20% ao ano
  isencaoCustodia: 10_000, // no Tesouro Selic, só o que passar de R$ 10 mil paga custódia
  carenciaDias: 0,
};

// IR regressivo sobre o rendimento, pelos dias corridos entre a aplicação e o resgate
export function aliquotaIr(dias: number): number {
  if (dias <= 180) return 0.225;
  if (dias <= 360) return 0.2;
  if (dias <= 720) return 0.175;
  return 0.15;
}

// IOF sobre o rendimento, para resgate antes de 30 dias (tabela do Decreto 6.306/2007)
const tabelaIof = [
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20,
  16, 13, 10, 6, 3,
];

export function aliquotaIof(dias: number): number {
  if (dias < 1) return 1;
  return (tabelaIof[dias - 1] ?? 0) / 100;
}

// ---------- Taxas e fatores ----------

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

// Série mensal (IPCA, poupança): um fator por mês
export function fatoresMensais(taxas: number[]): number[] {
  return taxas.map((taxa) => taxasParaFator([taxa]));
}

// Série diária agrupada por mês (CDI, Selic): o fator de cada mês é o produto dos dias úteis dele.
// O percentual (ex.: 110% do CDI) multiplica a TAXA de cada dia, nunca o fator.
export function fatoresDiariosPorMes(taxasPorMes: number[][], percentual = 100): number[] {
  return taxasPorMes.map((taxasDoMes) =>
    taxasParaFator(taxasDoMes.map((taxa) => (taxa * percentual) / 100)),
  );
}

// Para cada mês i: quanto o dinheiro que entra no início do mês i cresce até o fim do período.
// É o produto dos fatores de i até o último mês, calculado de trás para frente.
export function fatoresAteOFim(fatores: number[]): number[] {
  const resultado: number[] = new Array<number>(fatores.length);
  let acumulado = 1;
  for (let i = fatores.length - 1; i >= 0; i--) {
    acumulado = acumulado * (fatores[i] ?? 1);
    resultado[i] = acumulado;
  }
  return resultado;
}

// ---------- Aportes ----------

// O valor inicial entra no 1º mês; o aporte mensal entra no início de cada mês seguinte
export function listaDeAportes(valor: number, aporteMensal: number, meses: number): number[] {
  return Array.from({ length: meses }, (_, i) => (i === 0 ? valor : aporteMensal));
}

export function somar(valores: number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}

// Soma de cada aporte multiplicado pelo quanto ele cresce até o fim
function corrigirAportes(aportes: number[], fatores: number[]): number {
  const ateOFim = fatoresAteOFim(fatores);
  return somar(aportes.map((aporte, i) => aporte * (ateOFim[i] ?? 1)));
}

function conferirTamanhos(aportes: number[], ...listas: number[][]): void {
  for (const lista of listas) {
    if (lista.length !== aportes.length) {
      throw new Error(`Listas de tamanhos diferentes: ${aportes.length} aportes e ${lista.length} meses`);
    }
  }
}

// ---------- Inflação (a régua) ----------

export function inflacaoDoPeriodo(aportes: number[], fatoresIpca: number[]): Inflacao {
  conferirTamanhos(aportes, fatoresIpca);
  const totalAplicado = somar(aportes);
  const montanteSobInflacao = corrigirAportes(aportes, fatoresIpca);
  return {
    totalAplicado,
    taxaInflacao: fatorParaTaxa(fatoresAteOFim(fatoresIpca)[0] ?? 1),
    montanteSobInflacao,
    correcaoInflacao: montanteSobInflacao - totalAplicado,
  };
}

// ---------- Uma aplicação, do bruto ao real ----------

// Cada aporte tem o próprio prazo, então IOF e IR são calculados aporte por aporte.
// A custódia é cobrada mês a mês sobre o saldo bruto que passar da isenção.
export function desempenho(
  aportes: number[],
  fatores: number[],
  diasAteOResgate: number[],
  regras: RegrasAplicacao,
  montanteSobInflacao: number,
): Desempenho {
  conferirTamanhos(aportes, fatores, diasAteOResgate);

  const totalAplicado = somar(aportes);
  const ateOFim = fatoresAteOFim(fatores);

  let ganhoBruto = 0;
  let iof = 0;
  let ir = 0;
  let emCarencia = 0;
  aportes.forEach((aporte, i) => {
    const rendimento = aporte * ((ateOFim[i] ?? 1) - 1);
    const dias = diasAteOResgate[i] ?? 0;
    ganhoBruto += rendimento;
    if (dias < regras.carenciaDias) {
      emCarencia += aporte;
    }
    if (regras.tributada && rendimento > 0) {
      const iofAporte = rendimento * aliquotaIof(dias);
      iof += iofAporte;
      ir += (rendimento - iofAporte) * aliquotaIr(dias); // o IR incide sobre o rendimento já sem o IOF
    }
  });

  let custodia = 0;
  let saldo = 0;
  aportes.forEach((aporte, i) => {
    saldo = (saldo + aporte) * (fatores[i] ?? 1);
    custodia += (Math.max(0, saldo - regras.isencaoCustodia) * regras.custodiaAnual) / 12;
  });

  const impostos = iof + ir + custodia;
  const ganhoLiquido = ganhoBruto - impostos;
  const valorFinal = totalAplicado + ganhoLiquido;

  return {
    taxaBruta: fatorParaTaxa((totalAplicado + ganhoBruto) / totalAplicado),
    ganhoBruto,
    iof,
    ir,
    custodia,
    impostos,
    ganhoLiquido,
    valorFinal,
    ganhoReal: valorFinal - montanteSobInflacao,
    taxaReal: fatorParaTaxa(valorFinal / montanteSobInflacao), // Fisher: (1 + líquido) / (1 + inflação)
    emCarencia,
  };
}

// ---------- Mês a mês (para o gráfico) ----------

// Total depositado até o fim de cada mês
export function aplicadoMesAMes(aportes: number[]): number[] {
  return aportes.map((_, k) => somar(aportes.slice(0, k + 1)));
}

// A régua no fim de cada mês: os aportes feitos até ali, corrigidos pelo IPCA até ali
export function inflacaoMesAMes(aportes: number[], fatoresIpca: number[]): number[] {
  conferirTamanhos(aportes, fatoresIpca);
  return aportes.map((_, k) => corrigirAportes(aportes.slice(0, k + 1), fatoresIpca.slice(0, k + 1)));
}

// O valor líquido se o resgate fosse no fim de cada mês (com o IR e o IOF daquele prazo).
// diasPorResgate[k] traz os dias de cada aporte até o resgate depois do mês k (vem do datas.ts).
export function trajetoria(
  aportes: number[],
  fatores: number[],
  diasPorResgate: number[][],
  regras: RegrasAplicacao,
): number[] {
  conferirTamanhos(aportes, fatores, diasPorResgate.map(() => 0));
  return diasPorResgate.map(
    (dias, k) =>
      desempenho(aportes.slice(0, k + 1), fatores.slice(0, k + 1), dias, regras, 1).valorFinal,
  );
}
