// Salão da web: recebe o pedido pelo formulário, pede a simulação e mostra o resultado (ou o erro).
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, SubmitEvent, TouchEvent } from "react";
import type { IdAplicacao, ResultadoAplicacao, Simulacao } from "./types.ts";
import { mesesMaximo, percentualMaximo, simular } from "./simulacao.ts";
import { formatarMesExtenso, formatarReais, formatarTaxa } from "./formatos.ts";
import { useContagem } from "./useContagem.ts";
import { useLuzDoCursor } from "./useLuzDoCursor.ts";
import { GraficoGanhoReal } from "./Grafico.tsx";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "carregando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "pronto"; simulacao: Simulacao; rodada: number };

// Textos de cada aplicação. Se um IdAplicacao novo entrar no types.ts, o TS cobra o texto dele aqui.
const textos: Record<IdAplicacao, { curto: string; descricao: string; notaImpostos: string }> = {
  poupanca: {
    curto: "Poupança",
    descricao:
      "A aplicação mais conhecida do Brasil. Rende uma vez por mês, na data de aniversário do depósito.",
    notaImpostos: "isenta de IR e sem taxas",
  },
  cdb: {
    curto: "CDB",
    descricao:
      "Um empréstimo que você faz a um banco. Rende um percentual do CDI, a taxa que os bancos cobram entre si, e tem a garantia do FGC até R$ 250 mil.",
    notaImpostos: "IR sobre o rendimento, menor quanto mais tempo aplicado",
  },
  lciLca: {
    curto: "LCI/LCA",
    descricao:
      "Letras de crédito imobiliário ou do agronegócio, emitidas por bancos. Isentas de IR e com garantia do FGC, mas o dinheiro fica preso por pelo menos 9 meses.",
    notaImpostos: "isenta de IR",
  },
  tesouroSelic: {
    curto: "Tesouro Selic",
    descricao:
      "Um empréstimo que você faz ao governo federal. Acompanha a Selic, a taxa básica de juros, e é considerado o investimento mais seguro do país.",
    notaImpostos: "IR sobre o rendimento; custódia da B3 só acima de R$ 10 mil",
  },
};

// Linha pequena embaixo de "Impostos e taxas": o que foi cobrado, ou a nota da aplicação se nada foi
function detalheImpostos(aplicacao: ResultadoAplicacao): string {
  const partes = [
    { nome: "IR", valor: aplicacao.ir },
    { nome: "IOF", valor: aplicacao.iof },
    { nome: "custódia", valor: aplicacao.custodia },
  ].filter((parte) => parte.valor >= 0.005);
  if (partes.length === 0) {
    return textos[aplicacao.id].notaImpostos;
  }
  return partes.map((parte) => `${parte.nome} ${formatarReais(parte.valor)}`).join(" · ");
}

// Campo numérico dentro da frase; a largura acompanha o que foi digitado
function CampoInline({
  rotulo,
  prefixo,
  sufixo,
  valor,
  aoMudar,
  min,
  max,
  step,
  inteiro = false,
}: {
  rotulo: string;
  prefixo?: string;
  sufixo?: string;
  valor: string;
  aoMudar: (valor: string) => void;
  min: number;
  max?: number;
  step: number;
  inteiro?: boolean;
}) {
  return (
    <label className="campo-inline">
      <span className="so-leitor">{rotulo}</span>
      {prefixo !== undefined && <span className="prefixo">{prefixo}</span>}
      <input
        type="number"
        inputMode={inteiro ? "numeric" : "decimal"}
        min={min}
        max={max}
        step={step}
        required
        value={valor}
        style={{ width: `${Math.max(valor.length, 1) + 1}ch` }}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
      {sufixo !== undefined && <span className="prefixo">{sufixo}</span>}
    </label>
  );
}

export function App() {
  const [valorDigitado, setValorDigitado] = useState("1000");
  const [mesesDigitados, setMesesDigitados] = useState("12");
  const [aporteDigitado, setAporteDigitado] = useState("0");
  const [cdbDigitado, setCdbDigitado] = useState("100");
  const [lciDigitado, setLciDigitado] = useState("90");
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const rodada = useRef(0);
  useLuzDoCursor();

  async function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEstado({ tipo: "carregando" });

    try {
      const simulacao = await simular({
        valor: Number(valorDigitado),
        meses: Number(mesesDigitados),
        aporteMensal: Number(aporteDigitado),
        percentualCdb: Number(cdbDigitado),
        percentualLciLca: Number(lciDigitado),
      });
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
            Escolha um valor, um prazo e, se quiser, um depósito mensal. Com os dados oficiais do
            Banco Central, a gente compara poupança, CDB, LCI/LCA e Tesouro Selic no passado recente
            e mostra quanto foi ganho de verdade, depois de descontar impostos, taxas e inflação.
          </p>
        </header>

        <form className="frase" data-luz onSubmit={enviar}>
          <p className="frase-texto">
            Se eu tivesse aplicado{" "}
            <CampoInline
              rotulo="Valor investido em reais"
              prefixo="R$"
              valor={valorDigitado}
              aoMudar={setValorDigitado}
              min={0.01}
              step={0.01}
            />{" "}
            há{" "}
            <CampoInline
              rotulo="Prazo em meses"
              valor={mesesDigitados}
              aoMudar={setMesesDigitados}
              min={1}
              max={mesesMaximo}
              step={1}
              inteiro
            />{" "}
            meses, e mais{" "}
            <CampoInline
              rotulo="Aporte mensal em reais"
              prefixo="R$"
              valor={aporteDigitado}
              aoMudar={setAporteDigitado}
              min={0}
              step={0.01}
            />{" "}
            todo mês…
          </p>

          <button type="submit" disabled={estado.tipo === "carregando"}>
            {estado.tipo === "carregando" ? "Consultando…" : "Ver quanto teria rendido"}
            <span className="seta" aria-hidden="true">
              →
            </span>
          </button>

          <p className="frase-ajustes">
            Comparando com um CDB que paga{" "}
            <CampoInline
              rotulo="Percentual do CDI pago pelo CDB"
              sufixo="%"
              valor={cdbDigitado}
              aoMudar={setCdbDigitado}
              min={1}
              max={percentualMaximo}
              step={1}
              inteiro
            />{" "}
            do CDI e uma LCI/LCA que paga{" "}
            <CampoInline
              rotulo="Percentual do CDI pago pela LCI/LCA"
              sufixo="%"
              valor={lciDigitado}
              aoMudar={setLciDigitado}
              min={1}
              max={percentualMaximo}
              step={1}
              inteiro
            />{" "}
            do CDI.
          </p>
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
            Fonte: Banco Central do Brasil (SGS), séries 433 (IPCA), 196 (poupança), 12 (CDI) e 11
            (Selic). Esta é uma simulação do passado: rentabilidade passada não garante rentabilidade
            futura. Simplificações: todos os depósitos entram no dia 1º do mês e o resgate é no dia
            1º do mês seguinte ao último IPCA; o CDB tem liquidez diária; a LCI/LCA tem carência de
            9 meses (270 dias) por depósito; o Tesouro Selic rende a Selic do dia, sem ágio ou
            deságio no preço; a custódia é calculada mês a mês; as regras atuais de IR, IOF, custódia
            e carência valem para o período todo.
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
  const [ativa, setAtiva] = useState<IdAplicacao>("poupanca");

  useEffect(() => {
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ancora.current?.scrollIntoView({ behavior: semMovimento ? "auto" : "smooth", block: "start" });
  }, []);

  const inicio = formatarMesExtenso(simulacao.inicio);
  const fim = formatarMesExtenso(simulacao.fim);
  const prazo = simulacao.meses === 1 ? "1 mês" : `${simulacao.meses} meses`;
  const comAportes = simulacao.aporteMensal > 0 && simulacao.meses > 1;

  return (
    <>
      <section ref={ancora} className="resultado">
        <div className="contexto revelar">
          <p className="sobretitulo">
            De {inicio} a {fim}
          </p>
          {comAportes ? (
            <h2 className="contexto-titulo">
              Veja no que <strong>{formatarReais(simulacao.valor)}</strong>, mais{" "}
              <strong>{formatarReais(simulacao.aporteMensal)}</strong> por mês, teriam se
              transformado em {prazo}.
            </h2>
          ) : (
            <h2 className="contexto-titulo">
              Veja no que <strong>{formatarReais(simulacao.valor)}</strong> teriam se transformado
              se você tivesse aplicado há {prazo}.
            </h2>
          )}

          <CustoDaPoupanca aplicacoes={simulacao.aplicacoes} aoSelecionar={setAtiva} />

          <div className="inflacao">
            <p className="inflacao-numero">
              <span>Inflação do período</span>
              <strong>{formatarTaxa(simulacao.taxaInflacao)}</strong>
            </p>
            {comAportes ? (
              <p>
                Nesse tempo, os preços subiram {formatarTaxa(simulacao.taxaInflacao)} (IPCA). Você
                teria depositado <strong>{formatarReais(simulacao.totalAplicado)}</strong> ao todo,
                e cada depósito perde poder de compra a partir do mês em que entra. Para comprar o
                mesmo que esse dinheiro comprava quando foi depositado, você precisaria de{" "}
                <strong>{formatarReais(simulacao.montanteSobInflacao)}</strong> em {fim}.
              </p>
            ) : (
              <p>
                Nesse tempo, os preços subiram {formatarTaxa(simulacao.taxaInflacao)} (IPCA). Para
                comprar o mesmo que {formatarReais(simulacao.valor)} compravam em {inicio}, você
                precisaria de <strong>{formatarReais(simulacao.montanteSobInflacao)}</strong> em{" "}
                {fim}.
              </p>
            )}
            <p>
              Esse é o valor que o seu dinheiro precisava alcançar só para não perder poder de
              compra. O que passar disso é ganho de verdade.
            </p>
          </div>

          <Placar aplicacoes={simulacao.aplicacoes} />
        </div>

        <Carrossel
          simulacao={simulacao}
          ativa={ativa}
          aoSelecionar={setAtiva}
        />
      </section>

      <GraficoGanhoReal simulacao={simulacao} ativa={ativa} aoSelecionar={setAtiva} />
    </>
  );
}

// A frase que faz a pessoa agir: quanto ela deixou na mesa por ficar na poupança.
// Só compara com aplicações que poderiam ser resgatadas inteiras no fim (sem carência).
function CustoDaPoupanca({
  aplicacoes,
  aoSelecionar,
}: {
  aplicacoes: ResultadoAplicacao[];
  aoSelecionar: (id: IdAplicacao) => void;
}) {
  const poupanca = aplicacoes.find((aplicacao) => aplicacao.id === "poupanca");
  const [melhor] = aplicacoes
    .filter((aplicacao) => aplicacao.id !== "poupanca" && aplicacao.emCarencia === 0)
    .toSorted((a, b) => b.valorFinal - a.valorFinal);
  if (poupanca === undefined || melhor === undefined) {
    return null;
  }

  const diferenca = melhor.valorFinal - poupanca.valorFinal;
  if (diferenca < 0.005) {
    return (
      <div className="custo custo-neutro">
        <p className="custo-texto">
          Neste período, a poupança rendeu tanto quanto ou mais que as outras opções. Isso acontece
          quando os juros estão baixos.
        </p>
      </div>
    );
  }

  return (
    <div className="custo">
      <p className="custo-rotulo">O custo de deixar na poupança</p>
      <p className="custo-numero">{formatarReais(diferenca)}</p>
      <p className="custo-texto">
        É quanto você teria a mais investindo em {melhor.nome} no mesmo período, já descontados os
        impostos.{" "}
        <button type="button" className="link" onClick={() => aoSelecionar(melhor.id)}>
          Ver {textos[melhor.id].curto} →
        </button>
      </p>
    </div>
  );
}

// Comparação rápida: as aplicações ordenadas pelo rendimento real, com uma barra proporcional
function Placar({ aplicacoes }: { aplicacoes: ResultadoAplicacao[] }) {
  const ordenadas = aplicacoes.toSorted((a, b) => b.taxaReal - a.taxaReal);
  const maior = Math.max(...aplicacoes.map((aplicacao) => Math.abs(aplicacao.taxaReal)), 0.01);

  return (
    <div className="placar">
      <p className="placar-titulo">Quem rendeu mais de verdade</p>
      <ol>
        {ordenadas.map((aplicacao) => (
          <li key={aplicacao.id} data-sinal={aplicacao.taxaReal >= 0 ? "positivo" : "negativo"}>
            <span className="placar-nome">
              {aplicacao.nome}
              {aplicacao.emCarencia > 0 && (
                <span className="placar-carencia" title="Parte dos depósitos ainda em carência">
                  *
                </span>
              )}
            </span>
            <span className="placar-trilho" aria-hidden="true">
              <span
                className="placar-barra"
                style={{ width: `${(Math.abs(aplicacao.taxaReal) / maior) * 100}%` }}
              />
            </span>
            <span className="placar-numero">
              {formatarTaxa(aplicacao.taxaReal)} <small>{formatarReais(aplicacao.ganhoReal)}</small>
            </span>
          </li>
        ))}
      </ol>
      <p className="placar-nota">
        Rendimento real: depois de impostos, taxas e inflação.
        {aplicacoes.some((aplicacao) => aplicacao.emCarencia > 0) &&
          " * Parte do dinheiro ainda estaria em carência e não poderia ser sacada no fim do período."}
      </p>
    </div>
  );
}

// Um card por vez: as abas escolhem a aplicação; setas, teclado e deslizar no celular também
function Carrossel({
  simulacao,
  ativa,
  aoSelecionar,
}: {
  simulacao: Simulacao;
  ativa: IdAplicacao;
  aoSelecionar: (id: IdAplicacao) => void;
}) {
  const aplicacoes = simulacao.aplicacoes;
  const indice = Math.max(
    0,
    aplicacoes.findIndex((aplicacao) => aplicacao.id === ativa),
  );
  const toqueInicial = useRef<number | null>(null);
  const abas = useRef<(HTMLButtonElement | null)[]>([]);

  function irPara(novo: number, focarAba = false) {
    const total = aplicacoes.length;
    const destino = ((novo % total) + total) % total;
    const aplicacao = aplicacoes[destino];
    if (aplicacao === undefined) return;
    aoSelecionar(aplicacao.id);
    if (focarAba) abas.current[destino]?.focus();
  }

  function teclarNasAbas(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "ArrowRight") irPara(indice + 1, true);
    else if (evento.key === "ArrowLeft") irPara(indice - 1, true);
    else if (evento.key === "Home") irPara(0, true);
    else if (evento.key === "End") irPara(aplicacoes.length - 1, true);
    else return;
    evento.preventDefault();
  }

  function comecarToque(evento: TouchEvent<HTMLDivElement>) {
    toqueInicial.current = evento.changedTouches[0]?.clientX ?? null;
  }

  function terminarToque(evento: TouchEvent<HTMLDivElement>) {
    const inicioX = toqueInicial.current;
    const fimX = evento.changedTouches[0]?.clientX;
    toqueInicial.current = null;
    if (inicioX === null || fimX === undefined) return;
    const distancia = fimX - inicioX;
    if (Math.abs(distancia) > 50) irPara(indice + (distancia < 0 ? 1 : -1));
  }

  return (
    <div className="carrossel revelar">
      <div className="abas" role="tablist" aria-label="Aplicações" onKeyDown={teclarNasAbas}>
        {aplicacoes.map((aplicacao, i) => (
          <button
            key={aplicacao.id}
            ref={(elemento) => {
              abas.current[i] = elemento;
            }}
            type="button"
            role="tab"
            id={`aba-${aplicacao.id}`}
            aria-selected={i === indice}
            aria-controls={`painel-${aplicacao.id}`}
            tabIndex={i === indice ? 0 : -1}
            className="aba"
            data-sinal={aplicacao.taxaReal >= 0 ? "positivo" : "negativo"}
            onClick={() => irPara(i)}
          >
            <span className="aba-nome">{textos[aplicacao.id].curto}</span>
            <span className="aba-taxa">{formatarTaxa(aplicacao.taxaReal)}</span>
          </button>
        ))}
      </div>

      <div className="carrossel-janela" onTouchStart={comecarToque} onTouchEnd={terminarToque}>
        {aplicacoes.map((aplicacao, i) => (
          <CardAplicacao
            key={aplicacao.id}
            aplicacao={aplicacao}
            simulacao={simulacao}
            posicao={i < indice ? "antes" : i > indice ? "depois" : "atual"}
          />
        ))}
      </div>

      <div className="carrossel-controles">
        <button type="button" className="seta-carrossel" onClick={() => irPara(indice - 1)}>
          <span aria-hidden="true">←</span>
          <span className="so-leitor">Aplicação anterior</span>
        </button>
        <span className="carrossel-posicao">
          {indice + 1} de {aplicacoes.length}
        </span>
        <button type="button" className="seta-carrossel" onClick={() => irPara(indice + 1)}>
          <span aria-hidden="true">→</span>
          <span className="so-leitor">Próxima aplicação</span>
        </button>
      </div>
    </div>
  );
}

function CardAplicacao({
  aplicacao,
  simulacao,
  posicao,
}: {
  aplicacao: ResultadoAplicacao;
  simulacao: Simulacao;
  posicao: "antes" | "atual" | "depois";
}) {
  const ganhou = aplicacao.ganhoReal >= 0;
  const texto = textos[aplicacao.id];
  const valorFinal = useContagem(simulacao.totalAplicado, aplicacao.valorFinal, 1600, 400);
  const taxaReal = useContagem(0, aplicacao.taxaReal, 1400, 1300);

  return (
    <article
      className="card"
      id={`painel-${aplicacao.id}`}
      role="tabpanel"
      aria-labelledby={`aba-${aplicacao.id}`}
      inert={posicao !== "atual"}
      data-posicao={posicao}
      data-luz
      data-tilt={aplicacao.id === "poupanca" || undefined}
      data-sinal={ganhou ? "positivo" : "negativo"}
    >
      <header className="card-topo">
        <h3>{aplicacao.nome}</h3>
        <p>{texto.descricao}</p>
      </header>

      <div className="valor-final">
        <span className="rotulo">Teria se tornado</span>
        <span className="valor-final-numero">{formatarReais(valorFinal)}</span>
      </div>

      {aplicacao.emCarencia > 0 && (
        <p className="aviso" role="note">
          <span aria-hidden="true">⚠</span>
          <span>
            <strong>Atenção:</strong> {formatarReais(aplicacao.emCarencia)} dos depósitos ainda
            estariam em carência no fim do período, porque a LCI/LCA exige pelo menos 9 meses antes
            do resgate. O valor mostrado é quanto eles valeriam, mas ainda não daria para sacar.
          </span>
        </p>
      )}

      <ol className="escada">
        <li>
          <span className="escada-rotulo">Total investido</span>
          <span className="escada-valor">{formatarReais(simulacao.totalAplicado)}</span>
        </li>
        <li data-sinal="+">
          <span className="escada-rotulo">
            Rendimento bruto <small>{formatarTaxa(aplicacao.taxaBruta)} sobre o total investido</small>
          </span>
          <span className="escada-valor">{formatarReais(aplicacao.ganhoBruto)}</span>
        </li>
        <li data-sinal="−">
          <span className="escada-rotulo">
            Impostos e taxas <small>{detalheImpostos(aplicacao)}</small>
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
