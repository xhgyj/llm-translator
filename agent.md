# Agent Guide: llm-translator

## 1. Mission

This repository is the MVP monorepo for LLM Translator.  
It supports two platforms:

- Obsidian plugin (`apps/obsidian-plugin`)
- Browser extension (`apps/browser-extension`)

Shared behavior must live in `packages/core`, including:

- OpenAI-compatible translation calls
- Glossary loading and prompt application
- Cache-first behavior with force refresh support
- Placeholder backfill flow

## 2. Repository Map

- `packages/core`: shared translation logic across platforms
- `apps/obsidian-plugin`: Obsidian adapter layer
- `apps/browser-extension`: Browser MV3 adapter layer
- `shared/glossary.json`: default glossary data
- `docs/`: setup, smoke test, and design/plan docs

## 3. Setup and Validation

Run from repo root:

```powershell
npm install
npm run check:docs
npm test
npm run build
```

The three checks above are the default quality gates.

## 4. Working Rules

1. Read docs before changes: `README.md`, `docs/setup.md`, and `docs/mvp-manual-smoke-test.md`.
2. Keep `core` thick and adapters thin: cross-platform logic goes to `packages/core`.
3. Ship tests with changes: cover touched logic in package tests; add cross-end tests when behavior is shared.
4. Do not manually edit build artifacts: avoid direct edits in `dist/` and `node_modules/`.
5. Update docs when behavior changes.

## 5. MVP Behavior Constraints

- Translation entry points must support both selection and paragraph scenarios.
- Display mode is bilingual-below (translation inserted below source text).
- Placeholder lifecycle must be visible: `pending -> resolved/failed`.
- Cache hit is default behavior; `forceRefresh` bypasses cache.
- Glossary data must be loadable and affect translation output.

## 6. Definition of Done

A task is complete only when:

1. The feature/fix is implemented and locally verified.
2. `npm run check:docs`, `npm test`, and `npm run build` all pass.
3. Required docs are updated and no unrelated changes are introduced.

## 7. Common Commands

```powershell
# Full repo checks
npm run check:docs
npm test
npm run build

# Example: run core tests only
npm run -w @llm-translator/core test

# Example: build browser extension only
npm run -w @llm-translator/browser-extension build
```

