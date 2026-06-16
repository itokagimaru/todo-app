import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages のプロジェクトページ配信を想定し、本番ビルド時のみ base を /todo-app/ にする。
// dev / preview ではルート(/)で配信し、Preview MCP などからアクセスしやすくする。
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/todo-app/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Todo",
        short_name: "Todo",
        description: "カテゴリ整理・GitHub同期のTodoアプリ",
        lang: "ja",
        theme_color: "#3B82F6",
        background_color: "#0a0a0a",
        display: "standalone",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: { port: 3000, strictPort: true },
}));
