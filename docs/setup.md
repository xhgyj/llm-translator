# Setup

This MVP uses npm workspaces and runs on Windows, macOS, and Linux.

## Prerequisites

- Node.js installed
- npm available in your shell
- An OpenAI-compatible API endpoint, if you want to test real translations

## Install

From the repo root:

```powershell
npm install
```

## Verify the workspace

Run the repository checks from the root:

```powershell
npm run check:docs
npm test
npm run build
```

## Configure translation

The MVP expects the platform adapters to provide:

- `baseUrl` for the OpenAI-compatible endpoint
- `model`
- `targetLang` to choose the translation language
- `apiKey` when the endpoint requires one

The shared glossary lives in `shared/glossary.json`.

## Run the MVP

- Obsidian: build `apps/obsidian-plugin`, then load that folder as a community plugin (`manifest.json` + `main.js`). Configure `baseUrl`, `model`, and `targetLang` in the plugin setting tab, then run `Translate selected text` / `Translate current paragraph` or use right-click on selected text. PDF selection is supported as a read-only translation popup (not written back to PDF).
- Browser: load `apps/browser-extension` as an unpacked extension after building. Open the extension popup to configure `baseUrl`, `model`, and `targetLang`, then use popup buttons, keyboard commands, or right-click selected text. PDF selection uses a read-only translation popup page.
- For both, translate a selection or a paragraph and confirm the result appears below the source text

## Helpful files

- Root checks: `package.json`
- Shared glossary: `shared/glossary.json`
- Core translation logic: `packages/core`
