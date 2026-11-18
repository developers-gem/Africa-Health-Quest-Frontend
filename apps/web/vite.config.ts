import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173, strictPort: true },
  // "hidden": maps are generated for error tracking but not referenced by the bundles; the deploy step uploads
  // them to the error tracker and excludes *.map from the public bucket.
  build: { sourcemap: "hidden", target: "es2022" },
});
