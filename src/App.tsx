// Salão da web: recebe o pedido pelo formulário, pede a simulação e mostra o resultado (ou o erro).
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, SubmitEvent, TouchEvent } from "react";
import type { IdAplicacao, Modo, ResultadoAplicacao, Simulacao } from "./types.ts";
import { mesesMaximo, mesesMaximoProjecao, percentualMaximo, simular } from "./simulacao.ts";
import { formatarDataIso, formatarMesExtenso, formatarReais, formatarTaxa } from "./formatos.ts";
import { useContagem } from "./useContagem.ts";
import { useLuzDoCursor } from "./useLuzDoCursor.ts";
import { GraficoGanhoReal } from "./Grafico.tsx";
import { ErroBancoCentral, ErroPedido } from "./erros.ts";
import { custoDaPoupanca } from "./comparacao.ts";
import { desenharImagem } from "./imagem.ts";
import { faixasDeMercado, referenciaDesatualizada } from "./referencias.ts";
import { aliquotaIr, diasDoPrazo, percentualEquivalenteCdb } from "./calculos.ts";
import type { Campos } from "./link.ts";
import { camposPadrao, camposParaPedido, parametrosParaCampos, pedidoParaParametros } from "./link.ts";

type Estado =
  | { tipo: "inicial" }
  | { tipo: "carregando" }
  | { tipo: "erro"; titulo: string; detalhe: string | null }
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

// Traduz o erro para quem nunca investiu. O detalhe técnico fica guardado num "ver detalhes".
function explicarErro(e: unknown): { titulo: string; detalhe: string | null } {
  if (e instanceof ErroPedido) {
    return { titulo: e.message, detalhe: null };
  }
  if (e instanceof ErroBancoCentral) {
    return {
      titulo:
        "O Banco Central não respondeu como esperado. Isso costuma ser passageiro: tente de novo em alguns minutos.",
      detalhe: e.message,
    };
  }
  return {
    titulo: "Algo deu errado do nosso lado. Tente de novo; se continuar, recarregue a página.",
    detalhe: e instanceof Error ? e.message : String(e),
  };
}

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
  // Se a página foi aberta por um link compartilhado (?valor=...&meses=...), o formulário começa preenchido
  const [doLink] = useState(() => parametrosParaCampos(new URLSearchParams(window.location.search)));
  const inicial = doLink ?? camposPadrao;
  const [valorDigitado, setValorDigitado] = useState(inicial.valor);
  const [mesesDigitados, setMesesDigitados] = useState(inicial.meses);
  const [aporteDigitado, setAporteDigitado] = useState(inicial.aporte);
  const [cdbDigitado, setCdbDigitado] = useState(inicial.cdb);
  const [lciDigitado, setLciDigitado] = useState(inicial.lci);
  const [modo, setModo] = useState<Modo>(inicial.modo);
  const futuro = modo === "projecao";
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const rodada = useRef(0);
  useLuzDoCursor();

  async function executar(campos: Campos) {
    setEstado({ tipo: "carregando" });

    try {
      const simulacao = await simular(camposParaPedido(campos));
      rodada.current += 1;
      setEstado({ tipo: "pronto", simulacao, rodada: rodada.current });
      // O endereço passa a descrever esta simulação (sem recarregar a página): é ele que vira o link
      window.history.replaceState(null, "", `${window.location.pathname}?${pedidoParaParametros(simulacao)}`);
    } catch (e) {
      console.error(e);
      setEstado({ tipo: "erro", ...explicarErro(e) });
    }
  }

  function camposAtuais(modoEscolhido: Modo): Campos {
    return {
      modo: modoEscolhido,
      valor: valorDigitado,
      meses: mesesDigitados,
      aporte: aporteDigitado,
      cdb: cdbDigitado,
      lci: lciDigitado,
    };
  }

  function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    void executar(camposAtuais(modo));
  }

  // Trocar de modo com um resultado na tela já refaz a simulação no outro modo
  function trocarModo(novo: Modo) {
    if (novo === modo) return;
    setModo(novo);
    if (estado.tipo === "pronto" || estado.tipo === "erro") void executar(camposAtuais(novo));
  }

  // Link compartilhado: já abre com a simulação feita
  useEffect(() => {
    if (doLink !== null) void executar(doLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só uma vez, ao abrir a página
  }, []);

  return (
    <>
      <div className="fundo" aria-hidden="true">
        <div className="fundo-luz" />
        <div className="fundo-grao" />
        <div className="fundo-grao fundo-grao-fino" />
      </div>

      <main className="pagina">
        <header className="cabecalho">
          <div className="modos" role="group" aria-label="Tipo de simulação">
            <button
              type="button"
              className={`modo${futuro ? "" : " modo-ativo"}`}
              aria-pressed={!futuro}
              onClick={() => trocarModo("historico")}
            >
              Olhando para trás
            </button>
            <button
              type="button"
              className={`modo${futuro ? " modo-ativo" : ""}`}
              aria-pressed={futuro}
              onClick={() => trocarModo("projecao")}
            >
              Projeção futura
            </button>
          </div>

          <h1>
            Quanto meu dinheiro rende <em>de verdade?</em>
          </h1>
          <p className="cabecalho-texto">
            {futuro
              ? "Escolha um valor, um prazo e, se quiser, um depósito mensal. Com as expectativas do mercado (Boletim Focus, do Banco Central), a gente projeta quanto poupança, CDB, LCI/LCA e Tesouro Selic devem render daqui para a frente, depois de descontar impostos, taxas e inflação."
              : "Escolha um valor, um prazo e, se quiser, um depósito mensal. Com os dados oficiais do Banco Central, a gente compara poupança, CDB, LCI/LCA e Tesouro Selic no passado recente e mostra quanto foi ganho de verdade, depois de descontar impostos, taxas e inflação."}
          </p>
        </header>

        <form className="frase" data-luz onSubmit={enviar}>
          <p className="frase-texto">
            {futuro ? "Se eu aplicar" : "Se eu tivesse aplicado"}{" "}
            <CampoInline
              rotulo="Valor investido em reais"
              prefixo="R$"
              valor={valorDigitado}
              aoMudar={setValorDigitado}
              min={0.01}
              step={0.01}
            />{" "}
            {futuro ? "hoje, por" : "há"}{" "}
            <CampoInline
              rotulo="Prazo em meses"
              valor={mesesDigitados}
              aoMudar={setMesesDigitados}
              min={1}
              max={futuro ? mesesMaximoProjecao : mesesMaximo}
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
            {estado.tipo === "carregando"
              ? "Consultando…"
              : futuro
                ? "Ver quanto deve render"
                : "Ver quanto teria rendido"}
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

          <Referencias meses={mesesDigitados} lci={lciDigitado} />
        </form>

        {estado.tipo === "carregando" && <Carregando />}

        {estado.tipo === "erro" && (
          <div className="erro" role="alert">
            <p>{estado.titulo}</p>
            {estado.detalhe !== null && (
              <details>
                <summary>Detalhes técnicos</summary>
                <code>{estado.detalhe}</code>
              </details>
            )}
          </div>
        )}

        {estado.tipo === "pronto" && <Resultado key={estado.rodada} simulacao={estado.simulacao} />}

        <footer className="rodape">
          <p className="rodape-aviso">
            <strong>Ferramenta educativa, não é recomendação de investimento.</strong> Os resultados mostram o
            passado ou uma estimativa do futuro e servem para comparar opções. Antes de investir, confira as
            taxas, os prazos e as garantias com o seu banco ou corretora.
          </p>
          <p>
            Fonte: Banco Central do Brasil (SGS), séries 433 (IPCA), 196 (poupança), 12 (CDI) e 11 (Selic).
            Esta é uma simulação do passado: rentabilidade passada não garante rentabilidade futura.
            Simplificações: todos os depósitos entram no dia 1º do mês e o resgate é no dia 1º do mês seguinte
            ao último IPCA; o CDB tem liquidez diária; a LCI/LCA tem carência de 9 meses (270 dias) por
            depósito; o Tesouro Selic rende a Selic do dia, sem ágio ou deságio no preço; a custódia é
            calculada mês a mês; as regras atuais de IR, IOF, custódia e carência valem para o período todo.
          </p>
          <p>
            Na projeção futura: expectativas medianas do Boletim Focus (Banco Central) para a Selic e o IPCA;
            a Selic segue em linha reta até a expectativa de fim de cada ano; o CDI e a Selic do Tesouro ficam
            0,10 ponto abaixo da meta; a TR repete a média dos últimos 12 meses; depois do último ano do
            Focus, valem as últimas expectativas. É uma estimativa, não uma promessa.
          </p>
        </footer>
      </main>
    </>
  );
}

// Embaixo dos percentuais: o que é uma taxa comum no mercado, e quanto a LCI/LCA digitada vale em "CDB".
// A equivalência acompanha o que está digitado, antes mesmo de simular.
function Referencias({ meses, lci }: { meses: string; lci: string }) {
  const { cdb, lciLca, revisadoEm } = faixasDeMercado;
  const agora = new Date();
  const desatualizada = referenciaDesatualizada({ ano: agora.getFullYear(), mes: agora.getMonth() + 1 });
  const prazo = Number(meses);
  const isento = Number(lci);
  const valido =
    Number.isInteger(prazo) && prazo >= 1 && prazo <= mesesMaximo && Number.isFinite(isento) && isento > 0;
  const dias = diasDoPrazo(prazo);

  return (
    <div className="referencias">
      <p>
        <strong>
          Referência de {formatarMesExtenso(revisadoEm)}
          {desatualizada ? " (pode estar desatualizada)" : ""}:
        </strong>{" "}
        CDBs costumam pagar de {cdb.minimo}% a {cdb.maximo}% do CDI (os de grandes bancos ficam na parte de
        baixo) e LCI/LCA, de {lciLca.minimo}% a {lciLca.maximo}%. São faixas típicas, não uma média oficial:
        confira as taxas no app do seu banco ou corretora.
      </p>
      {valido && (
        <p>
          Neste prazo, uma LCI/LCA de {isento}% do CDI equivale a um CDB de{" "}
          <strong>≈ {Math.round(percentualEquivalenteCdb(isento, dias))}% do CDI</strong>, porque o CDB paga{" "}
          {(aliquotaIr(dias) * 100).toLocaleString("pt-BR")}% de IR sobre o rendimento.
        </p>
      )}
    </div>
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

  const aplicacoes = simulacao.aplicacoes;
  const indice = Math.max(
    0,
    aplicacoes.findIndex((aplicacao) => aplicacao.id === ativa),
  );

  // Anda pelas aplicações em círculo (depois da última vem a primeira)
  function irPara(novo: number) {
    const total = aplicacoes.length;
    const aplicacao = aplicacoes[((novo % total) + total) % total];
    if (aplicacao !== undefined) setAtiva(aplicacao.id);
  }

  return (
    <section ref={ancora} className="resultado">
      <Resumo simulacao={simulacao} ativa={ativa} aoSelecionar={setAtiva} />
      <Abas aplicacoes={aplicacoes} indice={indice} irPara={irPara} />
      <div className="painel">
        <GraficoGanhoReal simulacao={simulacao} ativa={ativa} aoSelecionar={setAtiva} />
        <Carrossel simulacao={simulacao} indice={indice} irPara={irPara} />
      </div>
    </section>
  );
}

// O topo do resultado: o período, o pedido e três números (poupança × aba, inflação e a régua)
function Resumo({
  simulacao,
  ativa,
  aoSelecionar,
}: {
  simulacao: Simulacao;
  ativa: IdAplicacao;
  aoSelecionar: (id: IdAplicacao) => void;
}) {
  const inicio = formatarMesExtenso(simulacao.inicio);
  const fim = formatarMesExtenso(simulacao.fim);
  const prazo = simulacao.meses === 1 ? "1 mês" : `${simulacao.meses} meses`;
  const comAportes = simulacao.aporteMensal > 0 && simulacao.meses > 1;
  const { premissas } = simulacao;
  const futuro = premissas !== null;

  return (
    <header className="resumo revelar">
      <div className="resumo-topo">
        <p className="sobretitulo">
          {futuro ? "Projeção de" : "De"} {inicio} a {fim}
        </p>
        <Compartilhar simulacao={simulacao} />
      </div>
      <div className={`resumo-cabeca${futuro ? " resumo-cabeca-dupla" : ""}`}>
        <h2 className="resumo-titulo">
          <strong>{formatarReais(simulacao.valor)}</strong>
          {comAportes && (
            <>
              {" "}
              + <strong>{formatarReais(simulacao.aporteMensal)}</strong> por mês
            </>
          )}{" "}
          durante {prazo}
          {comAportes && (
            <span className="resumo-total">
              {" "}
              · {formatarReais(simulacao.totalAplicado)} investidos ao todo
            </span>
          )}
        </h2>

        {premissas !== null && (
          // As hipóteses da projeção ficam ao lado do título, em destaque: sem elas, o número não tem contexto
          <div className="premissas">
            <p className="premissas-rotulo">
              Premissas da projeção
              <span>Boletim Focus de {formatarDataIso(premissas.boletim)} · estimativa, não promessa</span>
            </p>
            <dl className="premissas-dados">
              <div>
                <dt>Selic</dt>
                <dd>
                  {formatarTaxa(premissas.selicInicial)} → {formatarTaxa(premissas.selicFinal)}{" "}
                  <small>ao ano</small>
                </dd>
              </div>
              <div>
                <dt>Inflação</dt>
                <dd>
                  {formatarTaxa(premissas.ipcaAnual)} <small>ao ano</small>
                </dd>
              </div>
              <div>
                <dt>TR</dt>
                <dd>
                  {formatarTaxa(premissas.trMensal)} <small>ao mês</small>
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <div className="resumo-numeros">
        <ComparacaoComPoupanca aplicacoes={simulacao.aplicacoes} ativa={ativa} aoSelecionar={aoSelecionar} />

        <div className="numero">
          <p className="numero-rotulo">
            {futuro ? "Inflação esperada" : "Inflação do período"}
            <button
              type="button"
              className="ajuda"
              popoverTarget="explica-inflacao"
              aria-label="O que é a inflação do período?"
            >
              ?
            </button>
          </p>
          <p className="numero-valor numero-inflacao">{formatarTaxa(simulacao.taxaInflacao)}</p>
          <p className="numero-texto">
            {futuro ? "o quanto os preços devem subir (IPCA)" : "o quanto os preços subiram (IPCA)"}
          </p>
        </div>

        <div className="numero">
          <p className="numero-rotulo">
            {futuro ? "Seu dinheiro vai precisar virar" : "Seu dinheiro precisava virar"}
          </p>
          <p className="numero-valor">{formatarReais(simulacao.montanteSobInflacao)}</p>
          <p className="numero-texto">
            {futuro
              ? comAportes
                ? `Os ${formatarReais(simulacao.totalAplicado)} que você vai depositar equivalerão a ${formatarReais(simulacao.montanteSobInflacao)} em ${fim}.`
                : `${formatarReais(simulacao.valor)} de hoje equivalerão a ${formatarReais(simulacao.montanteSobInflacao)} em ${fim}.`
              : comAportes
                ? `Os ${formatarReais(simulacao.totalAplicado)} que você depositou equivalem a ${formatarReais(simulacao.montanteSobInflacao)} hoje.`
                : `${formatarReais(simulacao.valor)} de ${inicio} equivalem a ${formatarReais(simulacao.montanteSobInflacao)} hoje.`}
          </p>
        </div>
      </div>

      <div id="explica-inflacao" className="explicacao" popover="auto">
        <p className="explicacao-titulo">
          {futuro ? "Inflação esperada" : "Inflação do período"}: {formatarTaxa(simulacao.taxaInflacao)}
        </p>
        {futuro ? (
          <p>
            Pelas expectativas do mercado, os preços devem subir {formatarTaxa(simulacao.taxaInflacao)} (IPCA)
            até {fim}. Cada depósito perde poder de compra a partir do mês em que entra. Para comprar em {fim}{" "}
            o mesmo que esse dinheiro compra quando é depositado, você vai precisar de{" "}
            <strong>{formatarReais(simulacao.montanteSobInflacao)}</strong>.
          </p>
        ) : comAportes ? (
          <p>
            Nesse tempo, os preços subiram {formatarTaxa(simulacao.taxaInflacao)} (IPCA). Você teria
            depositado <strong>{formatarReais(simulacao.totalAplicado)}</strong> ao todo, e cada depósito
            perde poder de compra a partir do mês em que entra. Para comprar o mesmo que esse dinheiro
            comprava quando foi depositado, você precisaria de{" "}
            <strong>{formatarReais(simulacao.montanteSobInflacao)}</strong> em {fim}.
          </p>
        ) : (
          <p>
            Nesse tempo, os preços subiram {formatarTaxa(simulacao.taxaInflacao)} (IPCA). Para comprar o mesmo
            que {formatarReais(simulacao.valor)} compravam em {inicio}, você precisaria de{" "}
            <strong>{formatarReais(simulacao.montanteSobInflacao)}</strong> em {fim}.
          </p>
        )}
        <p>
          Esse é o valor que o seu dinheiro precisava alcançar só para não perder poder de compra. O que
          passar disso é ganho de verdade.
        </p>
        <button type="button" className="link" popoverTarget="explica-inflacao" popoverTargetAction="hide">
          Entendi
        </button>
      </div>
    </header>
  );
}

// Os dois jeitos de compartilhar: o link (refaz a simulação) e a imagem (resumo pronto para mandar).
// O link é sempre copiado (só o endereço). A imagem, no celular (tela de toque), abre o menu de
// compartilhar do sistema (WhatsApp etc.); no computador, é baixada.
function Compartilhar({ simulacao }: { simulacao: Simulacao }) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const celular = window.matchMedia("(pointer: coarse)").matches;

  useEffect(() => {
    if (aviso === null) return;
    const espera = window.setTimeout(() => setAviso(null), 2500);
    return () => window.clearTimeout(espera);
  }, [aviso]);

  function enderecoDoLink(): string {
    return `${window.location.origin}${window.location.pathname}?${pedidoParaParametros(simulacao)}`;
  }

  // Copia só o endereço, sem texto junto, em qualquer aparelho: assim ele pode ser colado direto no navegador
  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(enderecoDoLink());
      setAviso("Link copiado!");
    } catch {
      setAviso("Não deu para copiar: use o endereço da barra do navegador.");
    }
  }

  async function compartilharImagem() {
    setGerando(true);
    try {
      const imagem = await desenharImagem(simulacao);
      const arquivo = new File([imagem], "simulacao-rendimentos.png", { type: "image/png" });
      if (celular && navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], text: enderecoDoLink() });
        return;
      }
      const url = URL.createObjectURL(imagem);
      const link = document.createElement("a");
      link.href = url;
      link.download = arquivo.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAviso("Imagem baixada!");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error(e);
      setAviso("Não deu para gerar a imagem.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="compartilhar">
      <span className="compartilhar-aviso" role="status">
        {aviso}
      </span>
      <button
        type="button"
        className="botao-secundario"
        disabled={gerando}
        onClick={() => void compartilharImagem()}
      >
        {gerando ? "Gerando…" : celular ? "Compartilhar imagem" : "Baixar imagem"}
      </button>
      <button type="button" className="botao-secundario" onClick={() => void copiarLink()}>
        Copiar link
      </button>
    </div>
  );
}

// Compara a aplicação da aba com a poupança. Na aba da poupança, compara com a melhor alternativa
// que poderia ser sacada inteira no fim (sem carência): é o "custo de deixar na poupança".
function ComparacaoComPoupanca({
  aplicacoes,
  ativa,
  aoSelecionar,
}: {
  aplicacoes: ResultadoAplicacao[];
  ativa: IdAplicacao;
  aoSelecionar: (id: IdAplicacao) => void;
}) {
  const poupanca = aplicacoes.find((aplicacao) => aplicacao.id === "poupanca");
  if (poupanca === undefined) return null;

  if (ativa === "poupanca") {
    const custo = custoDaPoupanca(aplicacoes);
    if (custo === null) {
      return (
        <div className="numero" data-tom="neutro">
          <p className="numero-rotulo">Poupança</p>
          <p className="numero-valor">Foi a melhor</p>
          <p className="numero-texto">nenhuma outra opção rendeu mais neste período</p>
        </div>
      );
    }
    const { melhor, diferenca } = custo;
    return (
      <div className="numero" data-tom="custo">
        <p className="numero-rotulo">O custo de deixar na poupança</p>
        <p className="numero-valor">{formatarReais(diferenca)}</p>
        <p className="numero-texto">
          a menos que em {melhor.nome}, a melhor opção.{" "}
          <button type="button" className="link" onClick={() => aoSelecionar(melhor.id)}>
            Ver {textos[melhor.id].curto} →
          </button>
        </p>
      </div>
    );
  }

  const atual = aplicacoes.find((aplicacao) => aplicacao.id === ativa);
  if (atual === undefined) return null;
  const diferenca = atual.valorFinal - poupanca.valorFinal;
  const carencia = atual.emCarencia > 0 ? " Parte ainda estaria em carência." : "";

  if (diferenca >= 0.005) {
    return (
      <div className="numero" data-tom="vantagem">
        <p className="numero-rotulo">{textos[atual.id].curto} × poupança</p>
        <p className="numero-valor">+{formatarReais(diferenca)}</p>
        <p className="numero-texto">a mais que na poupança, já descontados os impostos.{carencia}</p>
      </div>
    );
  }
  return (
    <div className="numero" data-tom="custo">
      <p className="numero-rotulo">{textos[atual.id].curto} × poupança</p>
      <p className="numero-valor">−{formatarReais(Math.abs(diferenca))}</p>
      <p className="numero-texto">a menos que na poupança neste período.{carencia}</p>
    </div>
  );
}

// As abas escolhem a aplicação e já mostram o rendimento real de cada uma (fazem o papel de placar)
function Abas({
  aplicacoes,
  indice,
  irPara,
}: {
  aplicacoes: ResultadoAplicacao[];
  indice: number;
  irPara: (novo: number) => void;
}) {
  const abas = useRef<(HTMLButtonElement | null)[]>([]);
  const melhor = aplicacoes.toSorted((a, b) => b.taxaReal - a.taxaReal)[0];

  function irEFocar(novo: number) {
    const total = aplicacoes.length;
    irPara(novo);
    abas.current[((novo % total) + total) % total]?.focus();
  }

  function teclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "ArrowRight") irEFocar(indice + 1);
    else if (evento.key === "ArrowLeft") irEFocar(indice - 1);
    else if (evento.key === "Home") irEFocar(0);
    else if (evento.key === "End") irEFocar(aplicacoes.length - 1);
    else return;
    evento.preventDefault();
  }

  return (
    <div className="abas revelar" role="tablist" aria-label="Aplicações" onKeyDown={teclar}>
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
          <span className="aba-taxa">
            {formatarTaxa(aplicacao.taxaReal)} real
            {aplicacao.id === melhor?.id && <span className="aba-melhor"> · maior ganho</span>}
            {aplicacao.emCarencia > 0 && (
              <span className="aba-carencia" title="Parte dos depósitos ainda em carência">
                {" "}
                *
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

// Um card por vez. No celular, também dá para deslizar o dedo ou usar as setas embaixo.
function Carrossel({
  simulacao,
  indice,
  irPara,
}: {
  simulacao: Simulacao;
  indice: number;
  irPara: (novo: number) => void;
}) {
  const aplicacoes = simulacao.aplicacoes;
  const toqueInicial = useRef<number | null>(null);

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
        <span className="rotulo">{simulacao.premissas === null ? "Teria se tornado" : "Deve se tornar"}</span>
        <div className="valor-final-linha">
          <span className="valor-final-numero">{formatarReais(valorFinal)}</span>
          <span
            className="valor-final-delta"
            data-sinal={aplicacao.ganhoLiquido >= 0 ? "positivo" : "negativo"}
          >
            {aplicacao.ganhoLiquido >= 0 ? "+" : "−"}
            {formatarReais(Math.abs(aplicacao.ganhoLiquido))} <small>líquido</small>
          </span>
        </div>
      </div>

      {aplicacao.emCarencia > 0 && (
        <p className="aviso" role="note">
          <span aria-hidden="true">⚠</span>
          <span>
            <strong>{formatarReais(aplicacao.emCarencia)} ainda sem poder sacar:</strong> carência mínima de 9
            meses.
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
            Rendimento bruto <small>{formatarTaxa(aplicacao.taxaBruta)}</small>
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
          <span className="escada-rotulo">Inflação do período</span>
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
          {simulacao.premissas === null
            ? ganhou
              ? `Seu poder de compra cresceu ${formatarTaxa(aplicacao.taxaReal)} além da inflação, já descontados impostos e taxas.`
              : `Rendeu menos que a inflação: seu poder de compra caiu ${formatarTaxa(Math.abs(aplicacao.taxaReal))}, já descontados impostos e taxas.`
            : ganhou
              ? `Seu poder de compra deve crescer ${formatarTaxa(aplicacao.taxaReal)} além da inflação, já descontados impostos e taxas.`
              : `Deve render menos que a inflação: seu poder de compra cairia ${formatarTaxa(Math.abs(aplicacao.taxaReal))}, já descontados impostos e taxas.`}
        </p>
      </div>
    </article>
  );
}
