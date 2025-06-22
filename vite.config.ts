import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { localApiPlugin } from "./vite-local-api";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), ...(mode === "development" ? [localApiPlugin()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  define: {
    "process.env": process.env,
  },
}));
