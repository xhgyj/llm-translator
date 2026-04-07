import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptsDir, "..");
const distDir = resolve(appDir, "dist");
const mainJsPath = resolve(appDir, "main.js");

rmSync(distDir, { recursive: true, force: true });
rmSync(mainJsPath, { force: true });

execFileSync(
  process.execPath,
  [resolve(appDir, "../../node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json"],
  {
    cwd: appDir,
    stdio: "inherit",
  },
);

await build({
  entryPoints: [resolve(appDir, "main.ts")],
  outfile: mainJsPath,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: ["node18"],
  external: ["obsidian"],
  sourcemap: false,
  legalComments: "none",
});
