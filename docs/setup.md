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

- Obsidian: install or load `apps/obsidian-plugin`, then set `baseUrl`, `model`, and required `targetLang` in the plugin config before translating
- Browser: load `apps/browser-extension` as an unpacked extension after building, then set `baseUrl`, `model`, and required `targetLang` in the extension config before translating
- For both, translate a selection or a paragraph and confirm the result appears below the source text

## Helpful files

- Root checks: `package.json`
- Shared glossary: `shared/glossary.json`
- Core translation logic: `packages/core`
