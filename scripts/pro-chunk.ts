import { transformWithEsbuild, type Plugin } from "vite";

// 248 — làm khó việc đọc mã Pro trong bản cài (docs/pro-repo-split-plan.md §3.2, §8): mã src/main/pro/ (bản Pro chép
// đè lúc release) tách thành MỘT chunk riêng và chỉ chunk đó được minify, không sourcemap. Phần còn lại của main giữ
// nguyên (dễ đọc log/stack lỗi).
// CHƯA dùng bytecode V8 (`build.bytecode` của electron-vite): plugin đó chỉ hỗ trợ output CommonJS, còn main build ra
// ESM ("type": "module"). Chuyển main sang CJS là thay đổi rộng ⇒ để sau (ghi ở kế hoạch, đợt 1).

export const PRO_CHUNK = "pro";
/** Mã core mà module Pro import (i18n, mã lỗi…) — tách khỏi chunk "pro" để không bị minify/giấu theo. */
export const PRO_CORE_CHUNK = "pro-core";

const PRO_DIR_RE = /[\\/]src[\\/]main[\\/]pro[\\/]/;

interface ChunkMeta {
  getModuleInfo(id: string): { readonly importers: readonly string[] } | null;
}

/**
 * manualChunks: module trong src/main/pro/ ⇒ chunk "pro". Rollup kéo MỌI phụ thuộc chưa gán của chunk thủ công vào
 * cùng chunk, nên module core được Pro import trực tiếp phải gán sang "pro-core" (kéo theo phụ thuộc của nó). Còn
 * lại để rollup tự chia như cũ.
 */
export function proChunkOf(id: string, meta: ChunkMeta): string | undefined {
  if (PRO_DIR_RE.test(id)) return PRO_CHUNK;
  const importers = meta.getModuleInfo(id)?.importers ?? [];
  return importers.some((i) => PRO_DIR_RE.test(i)) ? PRO_CORE_CHUNK : undefined;
}

/**
 * Minify riêng chunk "pro" (giữ tên export ESM) và bỏ sourcemap của nó. Chạy ở generateBundle — SAU mọi renderChunk,
 * vì plugin esbuild của Vite (renderChunk, enforce post) in lại mã và làm mất phần minify nếu làm sớm hơn.
 */
export function proMinifyPlugin(): Plugin {
  return {
    name: "sourcecraft-pro-minify",
    async generateBundle(_options, bundle) {
      for (const [fileName, out] of Object.entries(bundle)) {
        if (out.type !== "chunk" || out.name !== PRO_CHUNK) continue;
        const min = await transformWithEsbuild(out.code, fileName, {
          loader: "js",
          format: "esm",
          minify: true,
          legalComments: "none",
          sourcemap: false,
        });
        out.code = min.code;
        out.map = null;
        out.sourcemapFileName = null;
        delete bundle[`${fileName}.map`];
      }
    },
  };
}
