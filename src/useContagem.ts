// Anima um número de `de` até `ate` (efeito contador). Só serve à tela: o valor de verdade não muda.
import { useEffect, useState } from "react";

export function useContagem(de: number, ate: number, duracaoMs: number, atrasoMs: number): number {
  const [atual, setAtual] = useState(de);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAtual(ate);
      return;
    }

    const comeco = performance.now() + atrasoMs;
    let quadro = 0;

    function passo(agora: number) {
      const progresso = Math.min(Math.max((agora - comeco) / duracaoMs, 0), 1);
      const suavizado = 1 - (1 - progresso) ** 3; // começa rápido e desacelera no fim
      setAtual(de + (ate - de) * suavizado);
      if (progresso < 1) {
        quadro = requestAnimationFrame(passo);
      }
    }

    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [de, ate, duracaoMs, atrasoMs]);

  return atual;
}
