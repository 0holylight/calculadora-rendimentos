// Fornecedor: busca a série no Banco Central, valida o formato e converte data e valor (strings).
import type { AnoMes, Registro } from "./types.ts";
import { formatarMes, mesesEntre, somarMeses, ultimoDiaDoMes } from "./datas.ts";

const urlBase = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

// Séries diárias aceitam no máximo ~10 anos por consulta (acima disso a API responde HTTP 406)
const mesesPorConsultaDiaria = 60;

// Um mês tem pelo menos ~18 dias úteis. Menos que isso indica que a série está incompleta naquele mês.
const minimoDiasUteisNoMes = 15;

type Leitura = {
  anoMes: AnoMes;
  taxa: number;
};

function ehRegistro(item: unknown): item is Registro {
  return (
    typeof item === "object" &&
    item !== null &&
    "data" in item &&
    "valor" in item &&
    typeof item.data === "string" &&
    typeof item.valor === "string"
  );
}

function paraAnoMes(data: string, codigo: number): AnoMes {
  const partes = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(data);
  if (partes === null) {
    throw new Error(`Data inválida na série ${codigo}: "${data}"`);
  }
  return { ano: Number(partes[2]), mes: Number(partes[1]) };
}

function paraDataBcb(anoMes: AnoMes, dia = 1): string {
  return `${String(dia).padStart(2, "0")}/${formatarMes(anoMes)}`;
}

// O servidor do BCB às vezes responde HTTP 304 (sem corpo) para uma URL exata, mesmo sem pedido
// condicional: é um defeito do cache deles, que fica preso àquela combinação de parâmetros.
// Por isso cada busca recebe URLs alternativas que pedem os mesmos dados, tentadas em ordem.
async function buscarLeituras(urls: string[], codigo: number): Promise<Leitura[]> {
  for (const url of urls) {
    const response = await fetch(url);
    if (response.status === 304) {
      continue;
    }
    if (!response.ok) {
      throw new Error(
        `Erro ao buscar a série ${codigo} no Banco Central (HTTP ${response.status})`,
      );
    }
    return converterLeituras(await response.json(), codigo);
  }
  throw new Error(
    `O Banco Central não devolveu a série ${codigo} (HTTP 304 em todas as tentativas). Tente de novo em alguns minutos.`,
  );
}

function converterLeituras(result: unknown, codigo: number): Leitura[] {

  if (!Array.isArray(result)) {
    throw new Error(`A série ${codigo} não veio como lista`);
  }
  if (result.length === 0) {
    throw new Error(`A série ${codigo} veio vazia`);
  }
  if (!result.every(ehRegistro)) {
    throw new Error(`A série ${codigo} tem itens fora do formato { data, valor }`);
  }

  return result.map((registro) => {
    const taxa = Number(registro.valor);
    if (registro.valor.trim() === "" || !Number.isFinite(taxa)) {
      throw new Error(
        `Valor inválido na série ${codigo} em ${registro.data}: "${registro.valor}"`,
      );
    }
    return { anoMes: paraAnoMes(registro.data, codigo), taxa };
  });
}

export async function ultimoMes(codigo: number): Promise<AnoMes> {
  const leituras = await buscarLeituras(
    [1, 2, 3].map((n) => `${urlBase}.${codigo}/dados/ultimos/${n}?formato=json`),
    codigo,
  );
  // Com /ultimos/2 ou 3 vêm mais registros, e a ordem depende da série: fica com o mais recente
  const [ultima] = leituras.toSorted((a, b) => mesesEntre(a.anoMes, b.anoMes));
  if (ultima === undefined) {
    throw new Error(`A série ${codigo} não informou o último mês`);
  }
  return ultima.anoMes;
}

export async function taxasMensais(
  codigo: number,
  inicio: AnoMes,
  fim: AnoMes,
): Promise<number[]> {
  // Séries mensais têm um registro no dia 1º: dataFinal no dia 1, 2 ou 3 traz os mesmos dados
  const leituras = await buscarLeituras(
    [1, 2, 3].map(
      (dia) =>
        `${urlBase}.${codigo}/dados?formato=json&dataInicial=${paraDataBcb(inicio)}&dataFinal=${paraDataBcb(fim, dia)}`,
    ),
    codigo,
  );

  const ordenadas = leituras.toSorted((a, b) => mesesEntre(b.anoMes, a.anoMes));

  const esperados = mesesEntre(inicio, fim) + 1;
  const mesesCorretos = ordenadas.every(
    (leitura, posicao) => mesesEntre(inicio, leitura.anoMes) === posicao,
  );
  if (ordenadas.length !== esperados || !mesesCorretos) {
    throw new Error(
      `A série ${codigo} não cobre os ${esperados} meses de ${formatarMes(inicio)} a ${formatarMes(fim)} (veio ${ordenadas.length})`,
    );
  }

  return ordenadas.map((leitura) => leitura.taxa);
}

// Séries diárias (CDI, Selic): devolve as taxas de cada dia útil, agrupadas por mês.
// posicao 0 = mês do início, posicao 1 = mês seguinte... A conta (produto) fica com o calculos.ts.
export async function taxasDiariasPorMes(
  codigo: number,
  inicio: AnoMes,
  fim: AnoMes,
): Promise<number[][]> {
  const totalMeses = mesesEntre(inicio, fim) + 1;

  // Divide o período em pedaços que a API aceita e busca todos ao mesmo tempo
  const consultas: Promise<Leitura[]>[] = [];
  for (let desloc = 0; desloc < totalMeses; desloc += mesesPorConsultaDiaria) {
    const de = somarMeses(inicio, desloc);
    const ate = somarMeses(inicio, Math.min(desloc + mesesPorConsultaDiaria, totalMeses) - 1);
    // Alternativas: termina no último dia do mês ou avança até o dia 1º/2 do mês seguinte
    // (o que passar do mês "ate" é descartado no filter, porque pertence ao próximo pedaço)
    const seguinte = somarMeses(ate, 1);
    const finais = [paraDataBcb(ate, ultimoDiaDoMes(ate)), paraDataBcb(seguinte, 1), paraDataBcb(seguinte, 2)];
    consultas.push(
      buscarLeituras(
        finais.map(
          (dataFinal) =>
            `${urlBase}.${codigo}/dados?formato=json&dataInicial=${paraDataBcb(de)}&dataFinal=${dataFinal}`,
        ),
        codigo,
      ).then((leituras) =>
        leituras.filter((leitura) => mesesEntre(leitura.anoMes, ate) >= 0),
      ),
    );
  }
  const pedacos = await Promise.all(consultas);

  const porMes: number[][] = Array.from({ length: totalMeses }, () => []);
  for (const leitura of pedacos.flat()) {
    const doMes = porMes[mesesEntre(inicio, leitura.anoMes)];
    if (doMes === undefined) {
      throw new Error(`A série ${codigo} trouxe uma data fora do período: ${formatarMes(leitura.anoMes)}`);
    }
    doMes.push(leitura.taxa);
  }

  porMes.forEach((taxas, posicao) => {
    if (taxas.length < minimoDiasUteisNoMes) {
      throw new Error(
        `A série ${codigo} está incompleta em ${formatarMes(somarMeses(inicio, posicao))} (${taxas.length} dias)`,
      );
    }
  });

  return porMes;
}
