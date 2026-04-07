# LLM Translator Design (Obsidian + Browser)

## 1. Background and Goal

The goal is to build a translation plugin system that works in both Obsidian and the browser. The system should translate selected text and full paragraphs by calling local or remote LLMs through an OpenAI-compatible API.

Required capabilities:

- glossary support
- bilingual rendering (translation inserted below source text)
- cache (cache hit by default, with force refresh)
- backfill (insert placeholder first, then write result back in place)

MVP does not include full-page translation.

## 2. Scope

### 2.1 In Scope (MVP)

- dual-end minimal viable product: Obsidian plugin + browser extension
- shared translation core package
- OpenAI-compatible API support (local and remote base URL)
- translation targets: selection + paragraph
- default source language auto-detection
- configurable target language
- bilingual display mode: translation below source text
- placeholder backfill flow
- local JSON glossary
- cache hit by default + force refresh

### 2.2 Out of Scope (MVP)

- full-page translation
- OCR/image text translation
- automatic multi-model routing
- cloud glossary sync

## 3. Architecture

Use a Monorepo with a shared core plus thin platform adapters.

```text
llm-translator/
  packages/
    core/                  # shared translation core
  apps/
    obsidian-plugin/       # Obsidian adapter
    browser-extension/     # browser adapter
  shared/
    glossary.json          # default glossary file
```

### 3.1 packages/core

Responsibilities:

- OpenAI-compatible client (baseUrl/apiKey/model)
- unified translation entry: `translate(request)`
- glossary loading/validation/application
- cache key generation and cache abstraction
- backfill state machine (`pending`, `resolved`, `failed`)

### 3.2 apps/obsidian-plugin

Responsibilities:

- capture selected text or current paragraph
- insert a "translating..." placeholder block
- call `core.translate`
- replace placeholder with translated text below source text
- show error with retry actions

### 3.3 apps/browser-extension

Responsibilities:

- capture selected text or paragraph node text
- insert a placeholder container in-page
- call `core.translate`
- replace placeholder in place (below source text)
- show retry/refresh actions on failure

### 3.4 StorageAdapter

Unified cross-platform storage interface:

- `getGlossary()` / `saveGlossary()`
- `getCache(key)` / `setCache(key, value, ttlMs)`
- `getSettings()` / `saveSettings()`

Each platform implements its own adapter, while core logic stays shared.

## 4. Data Model

### 4.1 TranslateRequest

```ts
type TranslateRequest = {
  text: string;
  sourceLang: "auto" | string;
  targetLang: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  glossaryVersion?: string;
  promptVersion: string;
  displayMode: "bilingual-below";
  forceRefresh?: boolean;
  context?: {
    app: "obsidian" | "browser";
    selectionType: "selection" | "paragraph";
  };
};
```

### 4.2 TranslateResponse

```ts
type TranslateResponse = {
  translatedText: string;
  detectedSourceLang?: string;
  fromCache: boolean;
  latencyMs: number;
};
```

### 4.3 Cache Key

Cache key must be stable and identical across both platforms:

```text
hash(
  text +
  sourceLang +
  targetLang +
  model +
  baseUrl +
  glossaryVersion +
  promptVersion
)
```

## 5. Translation Flow

1. Adapter captures selection or paragraph text.
2. Adapter creates `jobId` and inserts a placeholder.
3. Core normalizes input text (preserve paragraph structure, trim noise).
4. Core generates cache key and reads cache.
5. If hit and not `forceRefresh`, return cached result with `fromCache=true`.
6. If miss, call the OpenAI-compatible endpoint.
7. Build prompt with glossary constraints and produce translation.
8. Write result to cache.
9. Adapter resolves placeholder by `jobId` and writes translation below source text.
10. If target position changed by user edits, do not overwrite; insert a conflict result block.

## 6. Glossary Design

Glossary is a local JSON file:

```json
{
  "version": "1",
  "terms": [
    { "source": "Transformer", "target": "Transformer (transformer model)" },
    { "source": "fine-tuning", "target": "fine-tuning" }
  ]
}
```

Rules:

- validate schema at load; skip invalid entries with warning
- cap total glossary prompt length; truncate by priority when over limit
- keep extension points for case-sensitive matching in future versions

## 7. Bilingual Display and Backfill

Default display: translated block inserted below source block.

State machine:

- `pending`: placeholder inserted, waiting for response
- `resolved`: placeholder replaced by translation
- `failed`: placeholder shows failure state with actions

Backfill safeguards:

- only resolve placeholders that match `jobId`
- if source text changed before completion, do not force overwrite

## 8. Error Handling

Error classes:

- config errors: missing `baseUrl`, `model`, or `apiKey`
- auth errors: 401/403
- rate limit errors: 429 with short exponential backoff
- server errors: 5xx with bounded retries
- network errors: timeout/offline

User-facing behavior:

- clear error type and short guidance
- expose `Retry` and `Force Refresh`

## 9. Privacy and Security

- MVP only sends user-selected text or paragraph text
- provide optional "local endpoints only" mode
- store API keys in platform-appropriate secure storage

## 10. Testing Strategy

### 10.1 Unit Tests (packages/core)

- cache key stability
- glossary load and application
- backfill state transitions
- error classification mapping

### 10.2 Integration Tests

- mocked OpenAI-compatible success path
- 401/429/5xx failure paths
- cache hit and force-refresh flow

### 10.3 E2E Smoke

- Obsidian: selection translate + paragraph translate + successful backfill
- Browser: selection translate + paragraph translate + successful backfill
- same glossary should lead to consistent behavior pattern across both ends

## 11. MVP Acceptance Criteria

- both plugins can be installed and used
- selection and paragraph translation both work
- source language auto-detection works by default
- target language is configurable
- default display is bilingual-below
- cache hit is used by default and force refresh works
- glossary JSON loads and changes translation behavior
- placeholder backfill and retry flow work

## 12. Risks and Mitigations

- output variability: constrain with glossary and stable prompt template
- DOM complexity: keep browser scope to selection/paragraph only in MVP
- configuration complexity: provide connectivity test and starter config
- backfill race/conflict: guard with `jobId` and conflict block strategy

## 13. Milestones

- M1: `packages/core` foundation (client/cache/glossary/state machine)
- M2: Obsidian integration (selection + paragraph)
- M3: browser integration (selection + paragraph)
- M4: tests, docs, and first release
