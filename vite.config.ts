import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/webview",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/webview/main.tsx",
      output: {
        entryFileNames: "assets/main.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/main[extname]"
      }
    }
  }
});
