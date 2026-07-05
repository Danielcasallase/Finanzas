import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANTE: cambia "raiz" por el nombre exacto de tu repositorio en GitHub
// (Ajustes > general del repo, o la URL github.com/tuusuario/ESTE-NOMBRE).
// Si vas a usar un dominio propio o una "user/organization page"
// (tuusuario.github.io sin subcarpeta), deja base: "/".
export default defineConfig({
  plugins: [react()],
  base: "/Finanzas/",
});
