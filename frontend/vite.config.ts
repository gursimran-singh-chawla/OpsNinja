import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiOrigin = process.env.OPS_API_ORIGIN ?? "http://127.0.0.1:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": apiOrigin,
      "/socket.io": { target: apiOrigin, ws: true },
    },
  },
});
