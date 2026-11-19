// Porta de entrada da página: encontra a <div id="root"> do index.html e desenha o App dentro dela.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./estilos.css";

const raiz = document.getElementById("root");
if (raiz === null) {
  throw new Error('Não achei a <div id="root"> no index.html');
}

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
