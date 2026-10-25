import { describe, expect, it } from "vitest";
import type {
  NormalizedOutputOptions,
  OutputBundle,
  OutputChunk,
} from "rollup";
import {
  PRO_CHUNK,
  PRO_CORE_CHUNK,
  proChunkOf,
  proMinifyPlugin,
} from "../../scripts/pro-chunk";

// 248 — mã src/main/pro/ (bản Pro chép đè lúc release) tách riêng một chunk và chỉ chunk đó được minify, không
// sourcemap. Bytecode V8 (electron-vite) chưa dùng được vì main build ra ESM — xem docs/pro-repo-split-plan.md.

// Đồ thị import giả: id ⇒ danh sách module import nó.
function meta(importers: Record<string, string[]> = {}) {
  return {
    getModuleInfo: (id: string) => ({ importers: importers[id] ?? [] }),
  };
}

describe("proChunkOf", () => {
  it("module trong src/main/pro/ ⇒ chunk pro (POSIX + Windows)", () => {
    expect(proChunkOf("/repo/src/main/pro/index.ts", meta())).toBe(PRO_CHUNK);
    expect(proChunkOf("/repo/src/main/pro/tests/x.ts", meta())).toBe(PRO_CHUNK);
    expect(proChunkOf("C:\\repo\\src\\main\\pro\\index.ts", meta())).toBe(
      PRO_CHUNK,
    );
  });

  it("module core được Pro import trực tiếp ⇒ pro-core (không bị kéo vào chunk pro)", () => {
    const m = meta({
      "/repo/src/shared/i18n/index.ts": [
        "/repo/src/main/index.ts",
        "/repo/src/main/pro/index.ts",
      ],
      "C:\\repo\\src\\shared\\x.ts": ["C:\\repo\\src\\main\\pro\\a.ts"],
    });
    expect(proChunkOf("/repo/src/shared/i18n/index.ts", m)).toBe(
      PRO_CORE_CHUNK,
    );
    expect(proChunkOf("C:\\repo\\src\\shared\\x.ts", m)).toBe(PRO_CORE_CHUNK);
  });

  it("module khác ⇒ để rollup tự chia", () => {
    const m = meta({ "/repo/src/main/a.ts": ["/repo/src/main/index.ts"] });
    expect(proChunkOf("/repo/src/main/index.ts", m)).toBeUndefined();
    expect(proChunkOf("/repo/src/main/a.ts", m)).toBeUndefined();
    expect(
      proChunkOf("/repo/src/main/services/pro-bridge/x.ts", m),
    ).toBeUndefined();
    expect(proChunkOf("/repo/src/main/profile/x.ts", m)).toBeUndefined();
    expect(proChunkOf("/repo/node_modules/pro/index.js", m)).toBeUndefined();
    expect(
      proChunkOf("\0virtual", { getModuleInfo: () => null }),
    ).toBeUndefined();
  });
});

type GenerateBundle = (
  options: NormalizedOutputOptions,
  bundle: OutputBundle,
) => Promise<void>;

function chunk(name: string, code: string): OutputChunk {
  return {
    type: "chunk",
    name,
    fileName: `chunks/${name}-x.js`,
    code,
    map: { mappings: "" },
    sourcemapFileName: `chunks/${name}-x.js.map`,
  } as unknown as OutputChunk;
}

async function generate(bundle: OutputBundle): Promise<void> {
  const hook = proMinifyPlugin().generateBundle as unknown as GenerateBundle;
  await hook.call({}, {} as NormalizedOutputOptions, bundle);
}

describe("proMinifyPlugin", () => {
  const SRC = `// bình luận nội bộ\nfunction available() {\n  const longLocalName = true;\n  return longLocalName;\n}\nexport { available };\n`;

  it("minify chunk pro, giữ tên export, bỏ comment + sourcemap", async () => {
    const pro = chunk(PRO_CHUNK, SRC);
    const bundle: OutputBundle = {
      [pro.fileName]: pro,
      [`${pro.fileName}.map`]: { type: "asset" } as OutputBundle[string],
    };
    await generate(bundle);
    expect(pro.code).not.toContain("bình luận");
    expect(pro.code).not.toContain("longLocalName");
    expect(pro.code).toMatch(/as available|available\}/);
    expect(pro.code.length).toBeLessThan(SRC.length);
    expect(pro.map).toBeNull();
    expect(pro.sourcemapFileName).toBeNull();
    expect(bundle[`${pro.fileName}.map`]).toBeUndefined();
  });

  it("chunk khác (kể cả pro-core) ⇒ không đụng", async () => {
    const core = chunk(PRO_CORE_CHUNK, SRC);
    const bundle: OutputBundle = { [core.fileName]: core };
    await generate(bundle);
    expect(core.code).toBe(SRC);
    expect(core.map).not.toBeNull();
  });
});
