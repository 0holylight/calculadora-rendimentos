// Gráfico do ganho real mês a mês: quanto cada aplicação estava acima (ou abaixo) da inflação
// se o dinheiro fosse resgatado naquele mês. A linha do zero é o "empate" com a inflação.
import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import type { AnoMes, IdAplicacao, Simulacao } from "./types.ts";
import { somarMeses } from "./datas.ts";
import { formatarMesCurto, formatarReais, formatarReaisEixo } from "./formatos.ts";

type Serie = { id: IdAplicacao; nome: string; valores: number[] };

const margem = { topo: 20, direita: 16, base: 32, esquerda: 72 };

// Passo "redondo" (1, 2, 2,5 ou 5 vezes uma potência de 10) para o eixo ter ~4 marcas
function marcasDoEixo(minimo: number, maximo: number): number[] {
  const bruto = (maximo - minimo) / 4 || 1;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo =
    [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((candidato) => candidato >= bruto) ?? 10 * potencia;
  const marcas: number[] = [];
  for (let v = Math.floor(minimo / passo) * passo; v <= maximo + passo / 2; v += passo) {
    marcas.push(Math.round(v * 100) / 100);
  }
  return marcas;
}

// Largura real da área do gráfico. Mede uma vez antes da primeira pintura (useLayoutEffect, para não
// aparecer um gráfico do tamanho errado) e depois acompanha as mudanças de tamanho (ResizeObserver).
function useLargura<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(720);
  useLayoutEffect(() => {
    const elemento = ref.current;
    if (elemento === null) return;
    setLargura(elemento.getBoundingClientRect().width);
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada !== undefined) setLargura(entrada.contentRect.width);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return [ref, largura];
}

export function GraficoGanhoReal({
  simulacao,
  ativa,
  aoSelecionar,
}: {
  simulacao: Simulacao;
  ativa: IdAplicacao;
  aoSelecionar: (id: IdAplicacao) => void;
}) {
  const [caixa, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);

  // Ponto 0 = dia do primeiro depósito (ganho zero). Ponto j = resgate no dia 1º do mês j.
  const datas: AnoMes[] = Array.from({ length: simulacao.meses + 1 }, (_, j) =>
    somarMeses(simulacao.inicio, j),
  );
  const series: Serie[] = simulacao.aplicacoes.map((aplicacao) => ({
    id: aplicacao.id,
    nome: aplicacao.nome,
    valores: [
      0,
      ...aplicacao.trajetoria.map((valor, k) => valor - (simulacao.trajetoriaInflacao[k] ?? valor)),
    ],
  }));

  const todos = series.flatMap((serie) => serie.valores);
  const marcas = marcasDoEixo(Math.min(0, ...todos), Math.max(0, ...todos));
  const yMin = marcas[0] ?? 0;
  const yMax = marcas[marcas.length - 1] ?? 1;
  const compacto = Math.max(Math.abs(yMin), Math.abs(yMax)) >= 10_000;

  const altura = largura < 560 ? 230 : 250;
  const larguraUtil = Math.max(largura - margem.esquerda - margem.direita, 10);
  const alturaUtil = altura - margem.topo - margem.base;
  const ultimo = datas.length - 1;
  const x = (j: number) => margem.esquerda + (ultimo === 0 ? 0 : (j / ultimo) * larguraUtil);
  const y = (v: number) => margem.topo + ((yMax - v) / (yMax - yMin || 1)) * alturaUtil;

  const caminho = (valores: number[]) =>
    valores.map((v, j) => `${j === 0 ? "M" : "L"}${x(j).toFixed(1)},${y(v).toFixed(1)}`).join("");

  // Rótulos de data: no máximo ~6, sempre incluindo o primeiro e o último
  const quantosRotulos = Math.min(ultimo, largura < 560 ? 3 : 6);
  const rotulos = Array.from(
    new Set(
      Array.from({ length: quantosRotulos + 1 }, (_, i) =>
        Math.round((i / Math.max(quantosRotulos, 1)) * ultimo),
      ),
    ),
  );

  const serieAtiva = series.find((serie) => serie.id === ativa) ?? series[0];
  const valorFinalAtivo = serieAtiva?.valores[ultimo] ?? 0;

  function apontar(evento: PointerEvent<SVGRectElement>) {
    const retangulo = evento.currentTarget.getBoundingClientRect();
    const proporcao = (evento.clientX - retangulo.left) / retangulo.width;
    setFoco(Math.min(ultimo, Math.max(0, Math.round(proporcao * ultimo))));
  }

  function teclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
      evento.preventDefault();
      const passo = evento.key === "ArrowRight" ? 1 : -1;
      setFoco((atual) => Math.min(ultimo, Math.max(0, (atual ?? (passo > 0 ? -1 : ultimo + 1)) + passo)));
    } else if (evento.key === "Escape") {
      setFoco(null);
    }
  }

  const dataFoco = foco === null ? undefined : datas[foco];
  const tooltipNaDireita = foco !== null && x(foco) < largura / 2;

  return (
    <section className="grafico revelar" aria-labelledby="grafico-titulo">
      <header className="grafico-topo">
        <div>
          <h3 id="grafico-titulo">Ganho real mês a mês</h3>
          <p>
            {simulacao.premissas === null
              ? "Se você sacasse em cada mês, já com impostos. Abaixo do zero, perdeu da inflação."
              : "Se você sacar em cada mês, já com impostos (projeção). Abaixo do zero, perde da inflação."}
          </p>
        </div>
        <ul className="grafico-legenda" aria-label="Escolha a aplicação em destaque">
          {series.map((serie) => (
            <li key={serie.id}>
              <button type="button" aria-pressed={serie.id === ativa} onClick={() => aoSelecionar(serie.id)}>
                <span className="grafico-chave" aria-hidden="true" />
                {serie.nome}
              </button>
            </li>
          ))}
          <li className="grafico-legenda-zero">
            <span className="grafico-chave grafico-chave-zero" aria-hidden="true" />
            R$ 0 = empate com a inflação
          </li>
        </ul>
      </header>

      <div
        ref={caixa}
        className="grafico-area"
        tabIndex={0}
        role="img"
        aria-label={`Gráfico de linhas do ganho real de ${series.length} aplicações ao longo de ${simulacao.meses} meses. Use as setas para percorrer os meses.`}
        onKeyDown={teclar}
        onBlur={() => setFoco(null)}
      >
        <svg width={largura} height={altura} aria-hidden="true">
          {marcas.map((marca) => (
            <g key={marca}>
              <line
                className={marca === 0 ? "grafico-zero" : "grafico-grade"}
                x1={margem.esquerda}
                x2={margem.esquerda + larguraUtil}
                y1={y(marca)}
                y2={y(marca)}
              />
              <text
                className="grafico-eixo"
                x={margem.esquerda - 10}
                y={y(marca)}
                dy="0.32em"
                textAnchor="end"
              >
                {formatarReaisEixo(marca, compacto)}
              </text>
            </g>
          ))}

          {rotulos.map((j) => {
            const data = datas[j];
            if (data === undefined) return null;
            return (
              <text
                key={j}
                className="grafico-eixo"
                x={x(j)}
                y={altura - 8}
                textAnchor={j === 0 ? "start" : j === ultimo ? "end" : "middle"}
              >
                {formatarMesCurto(data)}
              </text>
            );
          })}

          {serieAtiva !== undefined && (
            <path
              className="grafico-lavagem"
              d={`${caminho(serieAtiva.valores)}L${x(ultimo)},${y(0)}L${x(0)},${y(0)}Z`}
            />
          )}

          {series
            .filter((serie) => serie.id !== ativa)
            .map((serie) => (
              <path key={serie.id} className="grafico-linha" d={caminho(serie.valores)} />
            ))}
          {serieAtiva !== undefined && (
            <>
              <path className="grafico-linha grafico-linha-ativa" d={caminho(serieAtiva.valores)} />
              <circle className="grafico-ponto" cx={x(ultimo)} cy={y(valorFinalAtivo)} r={4.5} />
              <text
                className="grafico-rotulo-final"
                x={x(ultimo) - 10}
                y={y(valorFinalAtivo) + (valorFinalAtivo >= 0 ? -12 : 20)}
                textAnchor="end"
              >
                {formatarReais(valorFinalAtivo)}
              </text>
            </>
          )}

          {foco !== null && (
            <g>
              <line
                className="grafico-mira"
                x1={x(foco)}
                x2={x(foco)}
                y1={margem.topo}
                y2={margem.topo + alturaUtil}
              />
              {series.map((serie) => (
                <circle
                  key={serie.id}
                  className={serie.id === ativa ? "grafico-ponto" : "grafico-ponto-apagado"}
                  cx={x(foco)}
                  cy={y(serie.valores[foco] ?? 0)}
                  r={serie.id === ativa ? 4.5 : 3.5}
                />
              ))}
            </g>
          )}

          <rect
            className="grafico-captura"
            x={margem.esquerda}
            y={margem.topo}
            width={larguraUtil}
            height={alturaUtil}
            onPointerMove={apontar}
            onPointerDown={apontar}
            onPointerLeave={() => setFoco(null)}
          />
        </svg>

        {foco !== null && dataFoco !== undefined && (
          <div
            className="grafico-dica"
            style={tooltipNaDireita ? { left: x(foco) + 14 } : { right: largura - x(foco) + 14 }}
          >
            <p className="grafico-dica-data">
              {foco === 0 ? "Início" : `Resgate em 1º de ${formatarMesCurto(dataFoco)}`}
            </p>
            <ul>
              {series
                .toSorted((a, b) => (b.valores[foco] ?? 0) - (a.valores[foco] ?? 0))
                .map((serie) => (
                  <li key={serie.id} data-ativa={serie.id === ativa}>
                    <span className="grafico-chave" aria-hidden="true" />
                    <strong>{formatarReais(serie.valores[foco] ?? 0)}</strong>
                    <span>{serie.nome}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      <details className="grafico-tabela">
        <summary>Ver os números mês a mês</summary>
        <div className="grafico-tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th scope="col">Resgate em</th>
                {series.map((serie) => (
                  <th key={serie.id} scope="col">
                    {serie.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datas.slice(1).map((data, k) => (
                <tr key={k}>
                  <th scope="row">{formatarMesCurto(data)}</th>
                  {series.map((serie) => (
                    <td key={serie.id}>{formatarReais(serie.valores[k + 1] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
