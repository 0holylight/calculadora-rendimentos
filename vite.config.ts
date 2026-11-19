import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o site funciona em qualquer endereço, inclusive em
  // usuario.github.io/calculadora-rendimentos/ (GitHub Pages), sem fixar o nome do repositório.
  base: "./",
});
