import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/documents":    "http://localhost:8000",
      "/facts":        "http://localhost:8000",
      "/relationships":"http://localhost:8000",
    },
  },
});
