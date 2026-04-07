import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ExtensionManifest = {
  permissions?: string[];
  action?: {
    default_popup?: string;
  };
  commands?: Record<string, { description?: string }>;
};

describe("browser extension user entry", () => {
  it("declares explicit action and command triggers", () => {
    const appDir = process.cwd();
    const manifestPath = resolve(appDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ExtensionManifest;

    expect(manifest.permissions).toContain("contextMenus");
    expect(manifest.action?.default_popup).toBeTruthy();
    expect(manifest.commands?.["translate-selection"]?.description).toBeTruthy();
    expect(manifest.commands?.["translate-paragraph"]?.description).toBeTruthy();
  });
});
