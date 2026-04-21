import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin, Connect } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

// Local dev handler for Vercel Edge Functions (not served by Vite natively)
function localApiPlugin(): Plugin {
  return {
    name: "local-api",
    configureServer(server) {
      server.middlewares.use(
        "/api/place-photo",
        async (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(req.url!, "http://localhost");
          const ref = url.searchParams.get("ref");
          const w = url.searchParams.get("w") ?? "800";
          const apiKey = process.env.GOOGLE_MAPS_API_KEY;
          if (!ref || !apiKey) {
            res.statusCode = 400;
            res.end("Missing ref or API key");
            return;
          }
          try {
            const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${w}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;
            const upstream = await fetch(googleUrl);
            if (!upstream.ok) {
              res.statusCode = upstream.status;
              res.end("Photo not found");
              return;
            }
            const buffer = await upstream.arrayBuffer();
            res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg");
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.end(Buffer.from(buffer));
          } catch (e) {
            res.statusCode = 500;
            res.end("Proxy error");
          }
        }
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "development" && localApiPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "trasa",
        short_name: "trasa",
        description: "Planuj trasy podróży z AI",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "pl",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
