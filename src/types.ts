// Types do documento, como o Registro, com export

type Registro = {
  data: string;
  valor: string;
};

type AnoMes = {
  ano: number;
  mes: number;
};

type IdAplicacao = "poupanca";

// A escada: valor → + ganhoBruto → − impostos (IR, IOF, custódia) → ganhoLiquido → − inflação → ganhoReal
type ResultadoAplicacao = {
  id: IdAplicacao;
  nome: string;
  taxaBruta: number;
  ganhoBruto: number;
  impostos: number;
  ganhoLiquido: number;
  valorFinal: number;
  ganhoReal: number;
  taxaReal: number;
};

type Simulacao = {
  valor: number;
  meses: number;
  inicio: AnoMes;
  fim: AnoMes;
  taxaInflacao: number;
  montanteSobInflacao: number;
  correcaoInflacao: number;
  aplicacoes: ResultadoAplicacao[];
};

export type { Registro, AnoMes, IdAplicacao, ResultadoAplicacao, Simulacao };
