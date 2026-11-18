// Types do documento, como o Registro, com export

type Registro = {
  data: string;
  valor: string;
};

type AnoMes = {
  ano: number;
  mes: number;
};

type ResultadoAplicacao = {
  nome: string;
  taxaBruta: number;
  ganhoBruto: number;
  ganhoReal: number;
  taxaReal: number;
};

type Simulacao = {
  valor: number;
  inicio: AnoMes;
  fim: AnoMes;
  taxaInflacao: number;
  montanteSobInflacao: number;
  aplicacoes: ResultadoAplicacao[];
};

export type { Registro, AnoMes, ResultadoAplicacao, Simulacao };
