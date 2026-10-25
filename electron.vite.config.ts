import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { proChunkOf, proMinifyPlugin } from "./scripts/pro-chunk";

// Inject CSP meta theo môi trường (Constitution I / R7). file:// prod không kích hoạt onHeadersReceived
// đáng tin, nên meta tag là cơ chế chuẩn cho bản đóng gói.
// - dev: nới ws/http localhost cho HMR Vite.
// - prod: chặt — không network client-side (mọi network đi qua main qua IPC).
function cspPlugin(): Plugin {
  // media-src iv-media: → cho <audio> phát file audio gốc qua giao thức main (049). Chỉ media-src (thẻ
  // <audio> nằm dưới media-src, KHÔNG phải connect-src) — renderer không fetch("iv-media://") ở đâu nên
  // giữ connect-src tối thiểu (Constitution I / web/security.md: CSP tối thiểu cần thiết).
  const DEV =
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* http://localhost:*; media-src 'self' iv-media:; img-src 'self' data: iv-media:; font-src 'self'";
  const PROD =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self' iv-media:; img-src 'self' data: iv-media:; font-src 'self'; object-src 'none'; base-uri 'self'";
  return {
    name: "sourcecraft-csp",
    transformIndexHtml(html, ctx) {
      const csp = ctx.server ? DEV : PROD;
      return html.replace(
        "<!--CSP-->",
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

// 3 target: main (Node) / preload / renderer (React). Ranh giới bảo mật ở BrowserWindow (src/main/index.ts).
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/main/index.ts"),
          // 186: utilityProcess nhận dạng tiếng nói cho Ghi cuộc họp (tách khỏi việc ghi audio ở main).
          "asr-worker": resolve(
            "src/main/services/meeting-capture/asr-worker.ts",
          ),
        },
        // 248: mã src/main/pro/ (bản Pro chép đè lúc release) ở chunk riêng, chỉ chunk đó minify + không sourcemap.
        output: { manualChunks: proChunkOf },
      },
    },
    plugins: [proMinifyPlugin()],
    resolve: { alias: { "@shared": resolve("src/shared") } },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve("src/preload/index.ts") },
        // sandbox:true ⇒ preload PHẢI là CommonJS (Electron không hỗ trợ ESM preload khi sandbox bật).
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
    resolve: { alias: { "@shared": resolve("src/shared") } },
  },
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: { input: { index: resolve("src/renderer/index.html") } },
    },
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
        "@renderer": resolve("src/renderer"),
      },
    },
    plugins: [react(), cspPlugin()],
  },
});
