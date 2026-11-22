import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist/client", chunkSizeWarningLimit: 1400 },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  publicDir: "public",
});
