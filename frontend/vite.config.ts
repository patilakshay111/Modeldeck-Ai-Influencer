import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 explicitly. Vite's default `localhost` resolves to ::1 on
    // Windows, which leaves 127.0.0.1 refusing connections — a browser that
    // tries IPv4 first then fails. Pinning to 127.0.0.1 makes the address
    // predictable for every client on the host.
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      // The studio talks to the API on its own origin in development, so the
      // browser never needs a CORS preflight for its own requests.
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/media": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
