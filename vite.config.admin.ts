import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Build target dla admin.trasa.travel - osobny bundle z tego samego repo.
// Web-only (NIE trafia do Capacitor native), bez PWA/service-workera (na panelu
// operacyjnym szkodliwy), bez componentTagger/localApiPlugin (niepotrzebne).
// Wejscie: admin.html -> src/admin/main.tsx. Alias @ wspoldzieli src/ z apka.
export default defineConfig({
  base: "/",
  server: {
    host: "0.0.0.0",
    port: 8081,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-admin",
    rollupOptions: {
      input: path.resolve(__dirname, "admin.html"),
    },
  },
});
