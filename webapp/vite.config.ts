import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/webapp/",
  build: {
    outDir: path.resolve(__dirname, "../public/webapp"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { port: 5173 },
});
