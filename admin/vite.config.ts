import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://resultbotapi.entrancetricks.com",
        changeOrigin: true,
      },
    },
  },
  build: {
    // Deploy the contents of admin/dist to the botpanel subdomain document root
    outDir: "dist",
    emptyOutDir: true,
  },
});
