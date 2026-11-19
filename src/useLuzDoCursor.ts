// Luz que segue o cursor e onda no clique, em todo elemento com o atributo data-luz (e tilt em quem também tem data-tilt).
// Inspirado no Magic Bento (React Bits), reescrito enxuto: o JS só calcula posições e o CSS desenha a luz.
import { useEffect } from "react";

const alcance = 160; // px: a borda começa a acender quando o cursor chega a essa distância do painel
const fora = -9999;
const inclinacaoMaxima = 10; // graus: quanto o painel com data-tilt inclina quando o cursor está na borda

export function useLuzDoCursor(): void {
  useEffect(() => {
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = fora;
    let y = fora;
    let quadro = 0;

    function atualizar() {
      quadro = 0;
      for (const painel of document.querySelectorAll<HTMLElement>("[data-luz]")) {
        const caixa = painel.getBoundingClientRect();
        const dx = Math.max(caixa.left - x, 0, x - caixa.right);
        const dy = Math.max(caixa.top - y, 0, y - caixa.bottom);
        const distancia = Math.hypot(dx, dy);

        painel.style.setProperty("--luz-x", `${x - caixa.left}px`);
        painel.style.setProperty("--luz-y", `${y - caixa.top}px`);
        painel.style.setProperty("--luz-perto", Math.max(0, 1 - distancia / alcance).toFixed(3));
        painel.style.setProperty("--luz-dentro", distancia === 0 ? "1" : "0");

        // Tilt: só em quem tem data-tilt. u e v vão de −0,5 a 0,5 (posição do cursor em relação ao centro).
        if (painel.dataset["tilt"] !== undefined) {
          const inclinar = distancia === 0 && !semMovimento;
          const u = (x - caixa.left) / caixa.width - 0.5;
          const v = (y - caixa.top) / caixa.height - 0.5;
          painel.style.setProperty("--tilt-x", `${inclinar ? -v * 2 * inclinacaoMaxima : 0}deg`);
          painel.style.setProperty("--tilt-y", `${inclinar ? u * 2 * inclinacaoMaxima : 0}deg`);
        }
      }
    }

    function agendar() {
      if (quadro === 0) {
        quadro = requestAnimationFrame(atualizar);
      }
    }

    function aoMover(evento: PointerEvent) {
      x = evento.clientX;
      y = evento.clientY;
      agendar();
    }

    function aoSair() {
      x = fora;
      y = fora;
      agendar();
    }

    function aoSoltar(evento: PointerEvent) {
      if (evento.pointerType !== "mouse") {
        aoSair(); // no toque não existe "cursor parado em cima", então a luz apaga ao soltar
      }
    }

    function aoClicar(evento: PointerEvent) {
      x = evento.clientX;
      y = evento.clientY;
      agendar();

      if (semMovimento || !(evento.target instanceof Element)) {
        return;
      }
      const painel = evento.target.closest<HTMLElement>("[data-luz]");
      if (painel === null) {
        return;
      }

      const caixa = painel.getBoundingClientRect();
      const px = x - caixa.left;
      const py = y - caixa.top;
      const raio = Math.hypot(Math.max(px, caixa.width - px), Math.max(py, caixa.height - py));

      const onda = document.createElement("span");
      onda.className = "onda";
      onda.style.left = `${px}px`;
      onda.style.top = `${py}px`;
      onda.style.setProperty("--onda-tamanho", `${raio * 2}px`);
      onda.addEventListener("animationend", () => onda.remove());
      painel.append(onda);
    }

    window.addEventListener("pointermove", aoMover, { passive: true });
    window.addEventListener("pointerdown", aoClicar, { passive: true });
    window.addEventListener("pointerup", aoSoltar, { passive: true });
    window.addEventListener("scroll", agendar, { passive: true, capture: true });
    document.documentElement.addEventListener("pointerleave", aoSair);

    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", aoMover);
      window.removeEventListener("pointerdown", aoClicar);
      window.removeEventListener("pointerup", aoSoltar);
      window.removeEventListener("scroll", agendar, { capture: true });
      document.documentElement.removeEventListener("pointerleave", aoSair);
    };
  }, []);
}
