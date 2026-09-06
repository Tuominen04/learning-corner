import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server is only ever reached by the desktop shell's webview, never over a network.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { target: "es2022", sourcemap: true },
});
