import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("obsidian plugin bootstrap artifacts", () => {
  it("ships manifest.json and built main.js so it can be loaded directly", () => {
    const pluginDir = process.cwd();
    const manifestPath = resolve(pluginDir, "manifest.json");
    const mainJsPath = resolve(pluginDir, "main.js");

    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(mainJsPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      id?: string;
      name?: string;
      version?: string;
      minAppVersion?: string;
    };

    expect(manifest.id).toBeTruthy();
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toBeTruthy();
    expect(manifest.minAppVersion).toBeTruthy();
  });
});
