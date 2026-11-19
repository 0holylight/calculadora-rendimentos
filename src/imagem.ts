// Imagem para compartilhar (1080×1350, o formato vertical do WhatsApp/Instagram/LinkedIn).
// É desenhada do zero num <canvas>, em vez de "fotografar" a página: assim sai sempre igual,
// em qualquer aparelho, e só com o que importa para quem vê a imagem sem abrir o app.
import type { Simulacao } from "./types.ts";
import { custoDaPoupanca } from "./comparacao.ts";
import { formatarDataIso, formatarMesExtenso, formatarReais, formatarTaxa } from "./formatos.ts";

const largura = 1080;
const altura = 1350;
const margem = 88;

const cor = {
  fundo: "#06130f",
  texto: "#eef5f0",
  suave: "rgba(238, 245, 240, 0.72)",
  fraco: "rgba(238, 245, 240, 0.5)",
  borda: "rgba(238, 245, 240, 0.12)",
  painel: "rgba(5, 18, 14, 0.55)",
  verde: "#5fd394",
  verdeEscuro: "#1fa463",
  salvia: "#a9c79a",
  coral: "#e9967f",
};

const serifa = '"Instrument Serif", Georgia, serif';
const sans = 'Inter, system-ui, "Segoe UI", sans-serif';

// O canvas só usa uma fonte da web se ela já estiver carregada; aqui garantimos isso antes de desenhar
async function carregarFontes(): Promise<void> {
  await Promise.all([
    document.fonts.load(`400 80px ${serifa}`),
    document.fonts.load(`italic 400 80px ${serifa}`),
    document.fonts.load(`400 28px ${sans}`),
    document.fonts.load(`500 28px ${sans}`),
    document.fonts.load(`600 28px ${sans}`),
  ]);
}

function texto(
  ctx: CanvasRenderingContext2D,
  conteudo: string,
  x: number,
  y: number,
  fonte: string,
  cor: string,
  alinhamento: CanvasTextAlign = "left",
  espacamento = "0px",
): number {
  ctx.font = fonte;
  ctx.fillStyle = cor;
  ctx.textAlign = alinhamento;
  ctx.letterSpacing = espacamento;
  ctx.fillText(conteudo, x, y);
  const medida = ctx.measureText(conteudo).width;
  ctx.letterSpacing = "0px";
  return medida;
}

// Diminui a fonte até o texto caber na largura disponível
function caber(ctx: CanvasRenderingContext2D, conteudo: string, fonte: (px: number) => string, px: number, maximo: number): string {
  let tamanho = px;
  ctx.font = fonte(tamanho);
  while (ctx.measureText(conteudo).width > maximo && tamanho > 16) {
    tamanho -= 1;
    ctx.font = fonte(tamanho);
  }
  return fonte(tamanho);
}

function fundo(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = cor.fundo;
  ctx.fillRect(0, 0, largura, altura);

  // As mesmas manchas de luz da página: verde forte embaixo à direita, sálvia à esquerda
  const manchas: [number, number, number, string][] = [
    [1040, 1300, 820, "rgba(31, 164, 99, 0.55)"],
    [-80, 1050, 620, "rgba(169, 199, 154, 0.28)"],
    [300, -100, 700, "rgba(31, 110, 80, 0.35)"],
  ];
  for (const [x, y, raio, tom] of manchas) {
    const gradiente = ctx.createRadialGradient(x, y, 0, x, y, raio);
    gradiente.addColorStop(0, tom);
    gradiente.addColorStop(1, "rgba(6, 19, 15, 0)");
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, largura, altura);
  }

  // Granulado: um ladrilho de ruído aleatório repetido por cima, em modo "overlay" (como na página)
  const ladrilho = document.createElement("canvas");
  ladrilho.width = 256;
  ladrilho.height = 256;
  const ctxLadrilho = ladrilho.getContext("2d");
  if (ctxLadrilho !== null) {
    const pixels = ctxLadrilho.createImageData(256, 256);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const cinza = Math.random() * 255;
      pixels.data[i] = cinza;
      pixels.data[i + 1] = cinza;
      pixels.data[i + 2] = cinza;
      pixels.data[i + 3] = 255;
    }
    ctxLadrilho.putImageData(pixels, 0, 0);
    const padrao = ctx.createPattern(ladrilho, "repeat");
    if (padrao !== null) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = padrao;
      ctx.fillRect(0, 0, largura, altura);
      ctx.restore();
    }
  }
}

function painel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, preenchimento: string, contorno: string): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.fillStyle = preenchimento;
  ctx.fill();
  ctx.strokeStyle = contorno;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function endereco(): string {
  return `${window.location.host}${window.location.pathname}`.replace(/\/$/, "");
}

export async function desenharImagem(simulacao: Simulacao): Promise<Blob> {
  await carregarFontes();

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("O navegador não conseguiu criar a imagem");
  }
  ctx.textBaseline = "alphabetic";
  const util = largura - 2 * margem;

  fundo(ctx);

  // Cabeçalho: o título da página
  texto(ctx, "CALCULADORA DE RENDIMENTOS", margem, 128, `600 24px ${sans}`, cor.salvia, "left", "4px");
  texto(ctx, "Quanto meu dinheiro", margem, 222, `400 88px ${serifa}`, cor.texto);
  const rende = texto(ctx, "rende ", margem, 312, `400 88px ${serifa}`, cor.texto);
  texto(ctx, "de verdade?", margem + rende, 312, `italic 400 88px ${serifa}`, cor.salvia);

  // O pedido e o período
  const comAportes = simulacao.aporteMensal > 0 && simulacao.meses > 1;
  const { premissas } = simulacao;
  const futuro = premissas !== null;
  const prazo = simulacao.meses === 1 ? "1 mês" : `${simulacao.meses} meses`;
  const pedido =
    (comAportes
      ? `${formatarReais(simulacao.valor)} + ${formatarReais(simulacao.aporteMensal)} por mês, durante ${prazo}`
      : `${formatarReais(simulacao.valor)} aplicados durante ${prazo}`) + (futuro ? " (projeção)" : "");
  texto(ctx, pedido, margem, 392, caber(ctx, pedido, (px) => `500 ${px}px ${sans}`, 34, util), cor.texto);
  const periodo =
    `${futuro ? "Projeção de" : "De"} ${formatarMesExtenso(simulacao.inicio)} a ${formatarMesExtenso(simulacao.fim)}` +
    (premissas !== null
      ? ` · Boletim Focus de ${formatarDataIso(premissas.boletim)}`
      : comAportes
        ? ` · ${formatarReais(simulacao.totalAplicado)} investidos`
        : "");
  texto(ctx, periodo, margem, 438, caber(ctx, periodo, (px) => `400 ${px}px ${sans}`, 26, util), cor.fraco);

  // Destaque: o custo de deixar na poupança
  const custo = custoDaPoupanca(simulacao.aplicacoes);
  const topoDestaque = 486;
  if (custo !== null) {
    painel(ctx, margem, topoDestaque, util, 232, "rgba(233, 150, 127, 0.09)", "rgba(233, 150, 127, 0.35)");
    texto(ctx, "O CUSTO DE DEIXAR NA POUPANÇA", margem + 40, topoDestaque + 62, `600 24px ${sans}`, cor.coral, "left", "3px");
    texto(ctx, formatarReais(custo.diferenca), margem + 36, topoDestaque + 162, `400 108px ${serifa}`, cor.texto);
    const legenda = `a menos que em ${custo.melhor.nome}, já descontados os impostos`;
    texto(ctx, legenda, margem + 40, topoDestaque + 206, caber(ctx, legenda, (px) => `400 ${px}px ${sans}`, 26, util - 80), cor.suave);
  } else {
    painel(ctx, margem, topoDestaque, util, 232, cor.painel, cor.borda);
    texto(ctx, "NESTE PERÍODO", margem + 40, topoDestaque + 62, `600 24px ${sans}`, cor.salvia, "left", "3px");
    texto(ctx, "A poupança foi a melhor", margem + 36, topoDestaque + 152, `400 76px ${serifa}`, cor.texto);
    texto(ctx, "nenhuma outra opção rendeu mais", margem + 40, topoDestaque + 200, `400 26px ${sans}`, cor.suave);
  }

  // Placar: o rendimento real de cada aplicação, do maior para o menor
  const topoPlacar = 786;
  texto(ctx, "RENDIMENTO REAL (DEPOIS DE IMPOSTOS E INFLAÇÃO)", margem, topoPlacar, `600 22px ${sans}`, cor.salvia, "left", "3px");
  const ordenadas = simulacao.aplicacoes.toSorted((a, b) => b.taxaReal - a.taxaReal);
  const maior = Math.max(...ordenadas.map((aplicacao) => Math.abs(aplicacao.taxaReal)), 0.01);
  ordenadas.forEach((aplicacao, i) => {
    const y = topoPlacar + 62 + i * 80;
    const positivo = aplicacao.taxaReal >= 0;
    const nome = aplicacao.nome + (aplicacao.emCarencia > 0 ? " *" : "");
    texto(ctx, nome, margem, y, `${i === 0 ? 600 : 500} 32px ${sans}`, i === 0 ? cor.texto : cor.suave);
    const largTaxa = texto(ctx, formatarTaxa(aplicacao.taxaReal), largura - margem, y, `600 32px ${sans}`, positivo ? cor.verde : cor.coral, "right");
    texto(ctx, formatarReais(aplicacao.valorFinal), largura - margem - largTaxa - 24, y, `400 24px ${sans}`, cor.fraco, "right");

    // Trilho e barra proporcional
    ctx.beginPath();
    ctx.roundRect(margem, y + 18, util, 10, 5);
    ctx.fillStyle = "rgba(238, 245, 240, 0.08)";
    ctx.fill();
    const barra = Math.max((Math.abs(aplicacao.taxaReal) / maior) * util, 10);
    const gradiente = ctx.createLinearGradient(margem, 0, margem + barra, 0);
    gradiente.addColorStop(0, positivo ? cor.verdeEscuro : cor.coral);
    gradiente.addColorStop(1, positivo ? cor.verde : cor.coral);
    ctx.beginPath();
    ctx.roundRect(margem, y + 18, barra, 10, 5);
    ctx.fillStyle = gradiente;
    ctx.fill();
  });

  // Inflação em uma linha
  const yInflacao = topoPlacar + 62 + ordenadas.length * 80 + 12;
  const fim = formatarMesExtenso(simulacao.fim);
  const inflacao = futuro
    ? `Inflação esperada de ${formatarTaxa(simulacao.taxaInflacao)}: ${comAportes ? `os ${formatarReais(simulacao.totalAplicado)} depositados` : `${formatarReais(simulacao.valor)} de hoje`} equivalerão a ${formatarReais(simulacao.montanteSobInflacao)} em ${fim}.`
    : `Inflação de ${formatarTaxa(simulacao.taxaInflacao)}: ${comAportes ? `os ${formatarReais(simulacao.totalAplicado)} depositados` : `${formatarReais(simulacao.valor)} de ${formatarMesExtenso(simulacao.inicio)}`} equivalem a ${formatarReais(simulacao.montanteSobInflacao)} hoje.`;
  texto(ctx, inflacao, margem, yInflacao, caber(ctx, inflacao, (px) => `400 ${px}px ${sans}`, 26, util), cor.suave);

  // Rodapé
  ctx.fillStyle = cor.borda;
  ctx.fillRect(margem, altura - 138, util, 2);
  texto(ctx, `Faça a sua simulação: ${endereco()}`, margem, altura - 84, caber(ctx, `Faça a sua simulação: ${endereco()}`, (px) => `600 ${px}px ${sans}`, 26, util), cor.verde);
  const carencia = simulacao.aplicacoes.some((a) => a.emCarencia > 0) ? " * parte ainda em carência." : "";
  const aviso = futuro
    ? `Expectativas do Focus (Banco Central).${carencia} Estimativa, não é promessa.`
    : `Dados do Banco Central.${carencia} Simulação do passado, não é recomendação.`;
  texto(ctx, aviso, margem, altura - 46, caber(ctx, aviso, (px) => `400 ${px}px ${sans}`, 22, util), cor.fraco);

  return new Promise((resolver, rejeitar) => {
    canvas.toBlob((blob) => {
      if (blob === null) rejeitar(new Error("O navegador não conseguiu gerar o PNG"));
      else resolver(blob);
    }, "image/png");
  });
}
