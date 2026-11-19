// Types do documento, como o Registro, com export

type Registro = {
  data: string;
  valor: string;
};

type AnoMes = {
  ano: number;
  mes: number;
};

type IdAplicacao = "poupanca" | "cdb" | "lciLca" | "tesouroSelic";

// Olhando para trás (dados reais do passado) ou projeção futura (expectativas do Boletim Focus)
type Modo = "historico" | "projecao";

// O que o usuário pede
type Pedido = {
  modo: Modo;
  valor: number;
  meses: number;
  aporteMensal: number;
  percentualCdb: number; // % do CDI que o CDB paga (100 = 100% do CDI)
  percentualLciLca: number; // % do CDI que a LCI/LCA paga
};

// Regras fixas de cada aplicação (não vêm do Banco Central, ficam no código)
type RegrasAplicacao = {
  tributada: boolean; // paga IR e IOF sobre o rendimento?
  custodiaAnual: number; // taxa de custódia ao ano, como fração (0.002 = 0,20%)
  isencaoCustodia: number; // em R$: a custódia só incide sobre o saldo acima disso
  carenciaDias: number; // prazo mínimo antes de poder resgatar (0 = resgate livre)
};

// A escada: totalAplicado → + ganhoBruto → − impostos (IOF, IR, custódia) → ganhoLiquido → − inflação → ganhoReal
type Desempenho = {
  taxaBruta: number; // rendimento bruto sobre o total aplicado, em %
  ganhoBruto: number;
  iof: number;
  ir: number;
  custodia: number;
  impostos: number; // iof + ir + custodia
  ganhoLiquido: number;
  valorFinal: number; // total aplicado + ganho líquido
  ganhoReal: number; // valorFinal − montanteSobInflacao, em R$ de hoje
  taxaReal: number; // valorFinal / montanteSobInflacao − 1, em %
  emCarencia: number; // em R$: aportes que ainda não poderiam ser resgatados no fim
};

type ResultadoAplicacao = Desempenho & {
  id: IdAplicacao;
  nome: string;
  trajetoria: number[]; // valor líquido se resgatasse no fim de cada mês (posição 0 = fim do 1º mês)
};

type Inflacao = {
  totalAplicado: number;
  taxaInflacao: number; // IPCA acumulado do período inteiro, em %
  montanteSobInflacao: number; // a régua: cada aporte corrigido pelo IPCA desde o mês em que entrou
  correcaoInflacao: number; // montanteSobInflacao − totalAplicado
};

// As hipóteses de uma projeção, para mostrar ao usuário de onde vieram os números
type Premissas = {
  boletim: string; // data do Boletim Focus usado, aaaa-mm-dd
  selicInicial: number; // % ao ano, no 1º mês da projeção
  selicFinal: number; // % ao ano, no último mês
  ipcaAnual: number; // inflação esperada no período, convertida para % ao ano
  trMensal: number; // TR usada (média dos últimos 12 meses), % ao mês
};

type Simulacao = Inflacao &
  Pedido & {
    inicio: AnoMes;
    fim: AnoMes;
    premissas: Premissas | null; // null quando olha para trás (não há hipótese: são dados reais)
    aplicacoes: ResultadoAplicacao[];
    trajetoriaInflacao: number[]; // a régua no fim de cada mês
    trajetoriaAplicado: number[]; // total depositado até cada mês
  };

export type {
  Registro,
  AnoMes,
  IdAplicacao,
  Modo,
  Pedido,
  Premissas,
  RegrasAplicacao,
  Desempenho,
  ResultadoAplicacao,
  Inflacao,
  Simulacao,
};
