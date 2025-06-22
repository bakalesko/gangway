import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// Function to read and clean base64 credentials
function getCleanedBase64Credentials(): string | undefined {
  try {
    // Try to read from base64.txt file
    if (fs.existsSync("base64.txt")) {
      const base64Content = fs.readFileSync("base64.txt", "utf8");
      // Clean the base64 content (remove all whitespace and special characters)
      const cleanedBase64 = base64Content.replace(/[^A-Za-z0-9+/=]/g, "");

      // Verify it's valid by trying to decode
      const decoded = Buffer.from(cleanedBase64, "base64").toString("utf8");
      JSON.parse(decoded); // This will throw if not valid JSON

      console.log("✅ Successfully loaded credentials from base64.txt");
      return cleanedBase64;
    }
  } catch (error) {
    console.warn(
      "⚠️ Could not load credentials from base64.txt:",
      error.message,
    );
  }

  return undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load credentials for development
  const credentials = getCleanedBase64Credentials();

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Make credentials available to the API functions
      "process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64": credentials
        ? `"${credentials}"`
        : "undefined",
      "process.env.NODE_ENV": `"${mode}"`,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
            router: ["react-router-dom"],
            ui: [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-dialog",
            ],
            icons: ["lucide-react"],
            query: ["@tanstack/react-query"],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});
