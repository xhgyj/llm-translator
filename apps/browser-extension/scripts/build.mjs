import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";

const rootDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(rootDir, "..");
const distDir = resolve(appDir, "dist");

rmSync(distDir, { recursive: true, force: true });

await build({
  entryPoints: [resolve(appDir, "src/background.ts")],
  outfile: resolve(distDir, "background.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome114"],
  sourcemap: false,
  legalComments: "none",
});

await build({
  entryPoints: [resolve(appDir, "src/contentScriptEntry.ts")],
  outfile: resolve(distDir, "contentScript.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome114"],
  sourcemap: false,
  legalComments: "none",
});

await build({
  entryPoints: [resolve(appDir, "src/popup.ts")],
  outfile: resolve(distDir, "popup.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome114"],
  sourcemap: false,
  legalComments: "none",
});

execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"],
  {
    cwd: appDir,
    stdio: "inherit",
  },
);
