// Salão da web: recebe o valor e o prazo pelo formulário, pede a simulação e mostra o resultado (ou o erro).
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { IdAplicacao, ResultadoAplicacao, Simulacao } from "./types.ts";
import { simular } from "./simulacao.ts";
import { formatarMesExtenso, formatarReais, formatarTaxa } from "./formatos.ts";
import { useContagem } from "./useContagem.ts";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "carregando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "pronto"; simulacao: Simulacao; rodada: number };

// Textos de cada aplicação. Se um IdAplicacao novo entrar no types.ts, o TS cobra o texto dele aqui.
const textos: Record<IdAplicacao, { descricao: string; notaImpostos: string }> = {
  poupanca: {
    descricao:
      "A aplicação mais conhecida do Brasil. Rende uma vez por mês, na data de aniversário do depósito.",
    notaImpostos: "isenta de IR e sem taxas",
  },
};

export function App() {
  const [valorDigitado, setValorDigitado] = useState("1000");
  const [mesesDigitados, setMesesDigitados] = useState("12");
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const rodada = useRef(0);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEstado({ tipo: "carregando" });

    try {
      const simulacao = await simular(Number(valorDigitado), Number(mesesDigitados));
      rodada.current += 1;
      setEstado({ tipo: "pronto", simulacao, rodada: rodada.current });
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro inesperado";
      setEstado({ tipo: "erro", mensagem });
    }
  }

  return (
    <>
      <div className="fundo" aria-hidden="true">
        <div className="fundo-luz" />
        <div className="fundo-grao" />
        <div className="fundo-grao fundo-grao-fino" />
      </div>

      <main className="pagina">
        <header className="cabecalho">
          <div className="modos">
            <span className="modo modo-ativo">Olhando para trás</span>
            <span className="modo" aria-disabled="true">
              Projeção futura <small>em breve</small>
            </span>
          </div>

          <h1>
            Quanto meu dinheiro rende <em>de verdade?</em>
          </h1>
          <p className="cabecalho-texto">
            Escolha um valor e um prazo. Com os dados oficiais do Banco Central, a gente mostra quanto
            ele teria rendido no passado recente e quanto disso foi ganho de verdade, depois de
            descontar a inflação.
          </p>
        </header>

        <form className="frase" onSubmit={enviar}>
          <p className="frase-texto">
            Se eu tivesse aplicado{" "}
            <label className="campo-inline">
              <span className="so-leitor">Valor investido em reais</span>
              <span className="prefixo">R$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                value={valorDigitado}
                style={{ width: `${Math.max(valorDigitado.length, 2) + 1}ch` }}
                onChange={(evento) => setValorDigitado(evento.target.value)}
              />
            </label>{" "}
            há{" "}
            <label className="campo-inline">
              <span className="so-leitor">Prazo em meses</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                required
                value={mesesDigitados}
                style={{ width: `${Math.max(mesesDigitados.length, 1) + 1}ch` }}
                onChange={(evento) => setMesesDigitados(evento.target.value)}
              />
            </label>{" "}
            meses…
          </p>

          <button type="submit" disabled={estado.tipo === "carregando"}>
            {estado.tipo === "carregando" ? "Consultando…" : "Ver quanto teria rendido"}
            <span className="seta" aria-hidden="true">
              →
            </span>
          </button>
        </form>

        {estado.tipo === "carregando" && <Carregando />}

        {estado.tipo === "erro" && (
          <p className="erro" role="alert">
            Não foi possível simular: {estado.mensagem}
          </p>
        )}

        {estado.tipo === "pronto" && (
          <Resultado key={estado.rodada} simulacao={estado.simulacao} />
        )}

        <footer className="rodape">
          <p>
            Fonte: Banco Central do Brasil (SGS), séries 433 (IPCA) e 196 (poupança). Esta é uma
            simulação do passado: rentabilidade passada não garante rentabilidade futura. A poupança
            é simulada com aniversário no dia 1º.
          </p>
        </footer>
      </main>
    </>
  );
}

function Carregando() {
  return (
    <section className="carregando" role="status">
      <p className="carregando-texto">Buscando os índices no Banco Central…</p>
      <div className="esqueleto">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function Resultado({ simulacao }: { simulacao: Simulacao }) {
  const ancora = useRef<HTMLElement>(null);

  useEffect(() => {
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ancora.current?.scrollIntoView({ behavior: semMovimento ? "auto" : "smooth", block: "start" });
  }, []);

  const inicio = formatarMesExtenso(simulacao.inicio);
  const fim = formatarMesExtenso(simulacao.fim);
  const prazo = simulacao.meses === 1 ? "1 mês" : `${simulacao.meses} meses`;

  return (
    <section ref={ancora} className="resultado">
      <div className="contexto revelar">
        <p className="sobretitulo">
          De {inicio} a {fim}
        </p>
        <h2 className="contexto-titulo">
          Veja no que <strong>{formatarReais(simulacao.valor)}</strong> teriam se transformado se
          você tivesse aplicado há {prazo}.
        </h2>

        <div className="inflacao">
          <p className="inflacao-numero">
            <span>Inflação do período</span>
            <strong>{formatarTaxa(simulacao.taxaInflacao)}</strong>
          </p>
          <p>
            Nesse tempo, os preços subiram {formatarTaxa(simulacao.taxaInflacao)} (IPCA). Para
            comprar o mesmo que {formatarReais(simulacao.valor)} compravam em {inicio}, você
            precisaria de <strong>{formatarReais(simulacao.montanteSobInflacao)}</strong> em {fim}.
          </p>
          <p>
            Esse é o valor que o seu dinheiro precisava alcançar só para não perder poder de compra.
            O que passar disso é ganho de verdade.
          </p>
        </div>
      </div>

      <div className="cards">
        {simulacao.aplicacoes.map((aplicacao) => (
          <CardAplicacao key={aplicacao.id} aplicacao={aplicacao} simulacao={simulacao} />
        ))}
      </div>
    </section>
  );
}

function CardAplicacao({
  aplicacao,
  simulacao,
}: {
  aplicacao: ResultadoAplicacao;
  simulacao: Simulacao;
}) {
  const ganhou = aplicacao.ganhoReal >= 0;
  const texto = textos[aplicacao.id];
  const valorFinal = useContagem(simulacao.valor, aplicacao.valorFinal, 1600, 400);
  const taxaReal = useContagem(0, aplicacao.taxaReal, 1400, 1300);

  return (
    <article className="card revelar" data-sinal={ganhou ? "positivo" : "negativo"}>
      <header className="card-topo">
        <h3>{aplicacao.nome}</h3>
        <p>{texto.descricao}</p>
      </header>

      <div className="valor-final">
        <span className="rotulo">Teria se tornado</span>
        <span className="valor-final-numero">{formatarReais(valorFinal)}</span>
      </div>

      <ol className="escada">
        <li>
          <span className="escada-rotulo">Valor investido</span>
          <span className="escada-valor">{formatarReais(simulacao.valor)}</span>
        </li>
        <li data-sinal="+">
          <span className="escada-rotulo">
            Rendimento bruto <small>{formatarTaxa(aplicacao.taxaBruta)} no período</small>
          </span>
          <span className="escada-valor">{formatarReais(aplicacao.ganhoBruto)}</span>
        </li>
        <li data-sinal="−">
          <span className="escada-rotulo">
            Impostos e taxas <small>{texto.notaImpostos}</small>
          </span>
          <span className="escada-valor">{formatarReais(aplicacao.impostos)}</span>
        </li>
        <li data-sinal="−">
          <span className="escada-rotulo">
            Inflação do período <small>o quanto os preços subiram, em reais</small>
          </span>
          <span className="escada-valor">{formatarReais(simulacao.correcaoInflacao)}</span>
        </li>
        <li data-sinal="=" className="escada-total">
          <span className="escada-rotulo">
            Ganho real <small>em reais de hoje</small>
          </span>
          <span className="escada-valor ganho-real">{formatarReais(aplicacao.ganhoReal)}</span>
        </li>
      </ol>

      <div className="real">
        <p className="real-linha">
          <span>Rendimento real</span>
          <span className="pontilhado" aria-hidden="true" />
          <strong className="real-numero">{formatarTaxa(taxaReal)}</strong>
        </p>
        <p className="real-texto">
          {ganhou
            ? `Durante esse período, o valor investido cresceu ${formatarTaxa(aplicacao.taxaReal)} além da inflação, já descontados impostos e taxas. Na prática, seu poder de compra aumentou.`
            : `Durante esse período, o valor investido rendeu menos que a inflação: o resultado real foi de ${formatarTaxa(aplicacao.taxaReal)}, já descontados impostos e taxas. Na prática, seu dinheiro perdeu poder de compra.`}
        </p>
      </div>
    </article>
  );
}
