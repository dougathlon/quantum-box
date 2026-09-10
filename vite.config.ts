import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    rollupOptions: {
      input: { main: "index.html", controller: "controller-setup.html" },
    },
    sourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 4188,
    strictPort: true,
  },
});
