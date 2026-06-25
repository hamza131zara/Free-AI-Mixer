import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/account": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/project-library": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/provider-settings": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "^/credits/": {
  target: "http://127.0.0.1:8787",
  changeOrigin: true,
}, 
      "/exports": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});