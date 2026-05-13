import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/practice-app/",
  plugins: [reactRefresh()],
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(configDir, "src/main.jsx"),
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "assets/app.css";
          }
          return "assets/[name][extname]";
        }
      }
    }
  }
});
