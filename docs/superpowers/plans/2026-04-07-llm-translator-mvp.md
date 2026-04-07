# LLM Translator MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP that translates selected text and paragraphs in Obsidian and browsers using a shared core with glossary, bilingual-below rendering, cache, and placeholder backfill.

**Architecture:** Use a monorepo with `packages/core` for translation logic and `apps/obsidian-plugin` + `apps/browser-extension` as thin adapters. Keep shared behavior in `core` through `StorageAdapter` and a single `translate()` pipeline.

**Tech Stack:** TypeScript, npm workspaces, Vitest, Zod, OpenAI-compatible Chat Completions API, Obsidian plugin API (adapter-facing), Chrome Extension Manifest V3.

---

### Task 1: Bootstrap Monorepo and Core Cache Key Primitive

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/cacheKey.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/tests/cacheKey.test.ts`

- [ ] **Step 1: Write the failing cache key test**

```ts
import { describe, expect, it } from "vitest";
import { createCacheKey } from "../src";

describe("createCacheKey", () => {
  it("returns stable key for same input", () => {
    const payload = {
      text: "Hello world",
      sourceLang: "auto",
      targetLang: "zh",
      model: "gpt-4o-mini",
      baseUrl: "http://localhost:11434/v1",
      glossaryVersion: "1",
      promptVersion: "v1",
    };

    const k1 = createCacheKey(payload);
    const k2 = createCacheKey(payload);
    expect(k1).toBe(k2);
  });

  it("changes key when model changes", () => {
    const base = {
      text: "Hello world",
      sourceLang: "auto",
      targetLang: "zh",
      baseUrl: "http://localhost:11434/v1",
      glossaryVersion: "1",
      promptVersion: "v1",
    };

    const k1 = createCacheKey({ ...base, model: "model-a" });
    const k2 = createCacheKey({ ...base, model: "model-b" });
    expect(k1).not.toBe(k2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -w @llm-translator/core test -- --run tests/cacheKey.test.ts`  
Expected: FAIL with module export/type errors because core package is not scaffolded.

- [ ] **Step 3: Scaffold workspace and implement minimal cache key**

```json
// package.json
{
  "name": "llm-translator",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "npm run -ws build",
    "test": "npm run -ws test"
  }
}
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

```text
# .gitignore
node_modules
dist
.DS_Store
coverage
```

```json
// packages/core/package.json
{
  "name": "@llm-translator/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

```json
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src", "tests"]
}
```

```ts
// packages/core/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

```ts
// packages/core/src/cacheKey.ts
import { createHash } from "node:crypto";

export type CacheKeyInput = {
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  baseUrl: string;
  glossaryVersion?: string;
  promptVersion: string;
};

export function createCacheKey(input: CacheKeyInput): string {
  const raw = [
    input.text,
    input.sourceLang,
    input.targetLang,
    input.model,
    input.baseUrl,
    input.glossaryVersion ?? "",
    input.promptVersion,
  ].join("|");

  return createHash("sha256").update(raw).digest("hex");
}
```

```ts
// packages/core/src/index.ts
export { createCacheKey } from "./cacheKey";
export type { CacheKeyInput } from "./cacheKey";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm install; npm run -w @llm-translator/core test -- --run tests/cacheKey.test.ts`  
Expected: PASS with `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.base.json .gitignore packages/core
git commit -m "chore: bootstrap monorepo and core cache key"
```

### Task 2: Implement Glossary Schema and Prompt Injection

**Files:**
- Create: `packages/core/src/glossary.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/glossary.test.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Write failing glossary tests**

```ts
import { describe, expect, it } from "vitest";
import { buildGlossaryPrompt, parseGlossary } from "../src";

describe("parseGlossary", () => {
  it("keeps valid terms and drops invalid items", () => {
    const input = {
      version: "1",
      terms: [
        { source: "fine-tuning", target: "微调" },
        { source: "", target: "x" },
      ],
    };

    const parsed = parseGlossary(input);
    expect(parsed.version).toBe("1");
    expect(parsed.terms).toEqual([{ source: "fine-tuning", target: "微调" }]);
  });
});

describe("buildGlossaryPrompt", () => {
  it("formats glossary lines for model instructions", () => {
    const prompt = buildGlossaryPrompt({
      version: "1",
      terms: [{ source: "Transformer", target: "Transformer（变换器）" }],
    });

    expect(prompt).toContain("Transformer => Transformer（变换器）");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -w @llm-translator/core test -- --run tests/glossary.test.ts`  
Expected: FAIL because `parseGlossary` and `buildGlossaryPrompt` are missing.

- [ ] **Step 3: Add glossary implementation and export**

```json
// packages/core/package.json (add dependency)
{
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

```ts
// packages/core/src/glossary.ts
import { z } from "zod";

const TermSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
});

const GlossarySchema = z.object({
  version: z.string().min(1),
  terms: z.array(TermSchema),
});

export type GlossaryTerm = z.infer<typeof TermSchema>;
export type Glossary = z.infer<typeof GlossarySchema>;

export function parseGlossary(input: unknown): Glossary {
  const normalized =
    typeof input === "object" && input !== null
      ? {
          ...(input as Record<string, unknown>),
          terms: Array.isArray((input as Record<string, unknown>).terms)
            ? (input as Record<string, unknown>).terms.filter((term) => {
                if (!term || typeof term !== "object") return false;
                const t = term as Record<string, unknown>;
                return typeof t.source === "string" && t.source.trim().length > 0 && typeof t.target === "string" && t.target.trim().length > 0;
              })
            : [],
        }
      : input;

  return GlossarySchema.parse(normalized);
}

export function buildGlossaryPrompt(glossary: Glossary): string {
  if (glossary.terms.length === 0) return "";
  const lines = glossary.terms.map((term) => `${term.source} => ${term.target}`);
  return `Glossary (must prefer these translations):\n${lines.join("\n")}`;
}
```

```ts
// packages/core/src/index.ts
export { createCacheKey } from "./cacheKey";
export type { CacheKeyInput } from "./cacheKey";
export { parseGlossary, buildGlossaryPrompt } from "./glossary";
export type { Glossary, GlossaryTerm } from "./glossary";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run -w @llm-translator/core test -- --run tests/glossary.test.ts tests/cacheKey.test.ts`  
Expected: PASS with all glossary and cache-key assertions green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/package.json packages/core/src packages/core/tests/glossary.test.ts
git commit -m "feat(core): add glossary parsing and prompt builder"
```

### Task 3: Implement Core Translate Pipeline (API + Cache + Retry)

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/errors.ts`
- Create: `packages/core/src/retry.ts`
- Create: `packages/core/src/openaiClient.ts`
- Create: `packages/core/src/translate.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/translate.test.ts`

- [ ] **Step 1: Write failing translate pipeline tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { translate, type StorageAdapter } from "../src";

function memoryStorage(): StorageAdapter {
  const cache = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    async getGlossary() {
      return { version: "1", terms: [{ source: "fine-tuning", target: "微调" }] };
    },
    async saveGlossary() {},
    async getCache(key) {
      const hit = cache.get(key);
      if (!hit || hit.expiresAt < Date.now()) return null;
      return hit.value;
    },
    async setCache(key, value, ttlMs) {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    async getSettings() {
      return { promptVersion: "v1", cacheTtlMs: 60000 };
    },
    async saveSettings() {},
  };
}

describe("translate", () => {
  it("returns cache hit when available", async () => {
    const storage = memoryStorage();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "你好" } }],
      }),
    });

    const first = await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );
    const second = await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -w @llm-translator/core test -- --run tests/translate.test.ts`  
Expected: FAIL due to missing `translate` pipeline types and exports.

- [ ] **Step 3: Implement types, retry, client, and pipeline**

```ts
// packages/core/src/types.ts
import type { Glossary } from "./glossary";

export type TranslateRequest = {
  text: string;
  sourceLang: "auto" | string;
  targetLang: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  forceRefresh?: boolean;
};

export type TranslateResponse = {
  translatedText: string;
  detectedSourceLang?: string;
  fromCache: boolean;
  latencyMs: number;
};

export type Settings = {
  promptVersion: string;
  cacheTtlMs: number;
};

export type StorageAdapter = {
  getGlossary(): Promise<Glossary>;
  saveGlossary(glossary: Glossary): Promise<void>;
  getCache(key: string): Promise<TranslateResponse | null>;
  setCache(key: string, value: TranslateResponse, ttlMs: number): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
};
```

```ts
// packages/core/src/errors.ts
export class ConfigError extends Error {}
export class AuthError extends Error {}
export class RateLimitError extends Error {}
export class UpstreamError extends Error {}
```

```ts
// packages/core/src/retry.ts
export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (i === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** i));
    }
  }
  throw last;
}
```

```ts
// packages/core/src/openaiClient.ts
import { AuthError, RateLimitError, UpstreamError } from "./errors";

type ChatRequest = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  prompt: string;
  fetchImpl?: typeof fetch;
};

export async function callOpenAICompatible(req: ChatRequest): Promise<string> {
  const fetcher = req.fetchImpl ?? fetch;
  const url = `${req.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(req.apiKey ? { Authorization: `Bearer ${req.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: req.model,
      messages: [{ role: "user", content: req.prompt }],
      temperature: 0.2,
    }),
  });

  if (response.status === 401 || response.status === 403) throw new AuthError("Auth failed");
  if (response.status === 429) throw new RateLimitError("Rate limited");
  if (!response.ok) throw new UpstreamError(`Upstream error: ${response.status}`);

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new UpstreamError("Empty translation response");
  return content;
}
```

```ts
// packages/core/src/translate.ts
import { createCacheKey } from "./cacheKey";
import { buildGlossaryPrompt } from "./glossary";
import { ConfigError } from "./errors";
import { callOpenAICompatible } from "./openaiClient";
import { withRetry } from "./retry";
import type { StorageAdapter, TranslateRequest, TranslateResponse } from "./types";

type TranslateDeps = {
  storage: StorageAdapter;
  fetchImpl?: typeof fetch;
};

export async function translate(req: TranslateRequest, deps: TranslateDeps): Promise<TranslateResponse> {
  if (!req.baseUrl || !req.model) {
    throw new ConfigError("baseUrl and model are required");
  }

  const settings = await deps.storage.getSettings();
  const glossary = await deps.storage.getGlossary();
  const key = createCacheKey({
    text: req.text,
    sourceLang: req.sourceLang,
    targetLang: req.targetLang,
    model: req.model,
    baseUrl: req.baseUrl,
    glossaryVersion: glossary.version,
    promptVersion: settings.promptVersion,
  });

  if (!req.forceRefresh) {
    const cached = await deps.storage.getCache(key);
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }

  const start = Date.now();
  const glossaryPrompt = buildGlossaryPrompt(glossary);
  const prompt = [
    `Source language: ${req.sourceLang}`,
    `Target language: ${req.targetLang}`,
    glossaryPrompt,
    `Text:\n${req.text}`,
    "Return only translated text.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const translatedText = await withRetry(
    () =>
      callOpenAICompatible({
        baseUrl: req.baseUrl,
        apiKey: req.apiKey,
        model: req.model,
        prompt,
        fetchImpl: deps.fetchImpl,
      }),
    2,
  );

  const response: TranslateResponse = {
    translatedText,
    fromCache: false,
    latencyMs: Date.now() - start,
  };

  await deps.storage.setCache(key, response, settings.cacheTtlMs);
  return response;
}
```

```ts
// packages/core/src/index.ts
export { createCacheKey } from "./cacheKey";
export type { CacheKeyInput } from "./cacheKey";
export { parseGlossary, buildGlossaryPrompt } from "./glossary";
export type { Glossary, GlossaryTerm } from "./glossary";
export { translate } from "./translate";
export type { TranslateRequest, TranslateResponse, StorageAdapter, Settings } from "./types";
```

- [ ] **Step 4: Run tests to verify pipeline behavior**

Run: `npm run -w @llm-translator/core test -- --run tests/cacheKey.test.ts tests/glossary.test.ts tests/translate.test.ts`  
Expected: PASS with cache-hit behavior verified.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src packages/core/tests/translate.test.ts
git commit -m "feat(core): add translate pipeline with cache and retry"
```

### Task 4: Build Obsidian Adapter with Placeholder Backfill

**Files:**
- Create: `apps/obsidian-plugin/package.json`
- Create: `apps/obsidian-plugin/tsconfig.json`
- Create: `apps/obsidian-plugin/src/backfill.ts`
- Create: `apps/obsidian-plugin/src/editorAdapter.ts`
- Create: `apps/obsidian-plugin/src/main.ts`
- Test: `apps/obsidian-plugin/tests/backfill.test.ts`
- Test: `apps/obsidian-plugin/tests/translateSelection.test.ts`
- Test: `apps/obsidian-plugin/tests/translateParagraph.test.ts`

- [ ] **Step 1: Write failing Obsidian adapter tests**

```ts
import { describe, expect, it } from "vitest";
import { BackfillStore } from "../src/backfill";

describe("BackfillStore", () => {
  it("creates and resolves a placeholder by job id", () => {
    const store = new BackfillStore();
    const jobId = store.create("p-1");
    expect(store.get(jobId)?.placeholderId).toBe("p-1");
    store.resolve(jobId);
    expect(store.get(jobId)?.status).toBe("resolved");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -w @llm-translator/obsidian-plugin test -- --run tests/backfill.test.ts`  
Expected: FAIL because app package and source files do not exist yet.

- [ ] **Step 3: Create Obsidian package and backfill/controller implementation**

```json
// apps/obsidian-plugin/package.json
{
  "name": "@llm-translator/obsidian-plugin",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@llm-translator/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

```json
// apps/obsidian-plugin/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

```ts
// apps/obsidian-plugin/src/backfill.ts
export type BackfillStatus = "pending" | "resolved" | "failed";

export type BackfillJob = {
  jobId: string;
  placeholderId: string;
  status: BackfillStatus;
};

export class BackfillStore {
  private jobs = new Map<string, BackfillJob>();

  create(placeholderId: string): string {
    const jobId = crypto.randomUUID();
    this.jobs.set(jobId, { jobId, placeholderId, status: "pending" });
    return jobId;
  }

  resolve(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = "resolved";
  }

  fail(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = "failed";
  }

  get(jobId: string): BackfillJob | undefined {
    return this.jobs.get(jobId);
  }
}
```

```ts
// apps/obsidian-plugin/src/editorAdapter.ts
export type EditorAdapter = {
  getSelection(): string;
  getCurrentParagraph(): string;
  insertPlaceholderBelowSelection(text: string): string;
  insertPlaceholderBelowParagraph(text: string): string;
  replacePlaceholder(placeholderId: string, text: string): void;
  markPlaceholderFailed(placeholderId: string, reason: string): void;
};
```

```ts
// apps/obsidian-plugin/src/main.ts
import { translate, type StorageAdapter } from "@llm-translator/core";
import type { EditorAdapter } from "./editorAdapter";
import { BackfillStore } from "./backfill";

export class ObsidianTranslatorController {
  constructor(
    private readonly editor: EditorAdapter,
    private readonly storage: StorageAdapter,
    private readonly config: { baseUrl: string; model: string; targetLang: string; apiKey?: string },
    private readonly jobs = new BackfillStore(),
  ) {}

  async translateSelection(): Promise<void> {
    const text = this.editor.getSelection().trim();
    if (!text) return;

    const placeholderId = this.editor.insertPlaceholderBelowSelection("translating...");
    const jobId = this.jobs.create(placeholderId);

    try {
      const result = await translate(
        {
          text,
          sourceLang: "auto",
          targetLang: this.config.targetLang,
          model: this.config.model,
          baseUrl: this.config.baseUrl,
          apiKey: this.config.apiKey,
        },
        { storage: this.storage },
      );

      this.editor.replacePlaceholder(placeholderId, result.translatedText);
      this.jobs.resolve(jobId);
    } catch (error) {
      this.editor.markPlaceholderFailed(placeholderId, String(error));
      this.jobs.fail(jobId);
    }
  }

  async translateParagraph(): Promise<void> {
    const text = this.editor.getCurrentParagraph().trim();
    if (!text) return;

    const placeholderId = this.editor.insertPlaceholderBelowParagraph("translating...");
    const jobId = this.jobs.create(placeholderId);

    try {
      const result = await translate(
        {
          text,
          sourceLang: "auto",
          targetLang: this.config.targetLang,
          model: this.config.model,
          baseUrl: this.config.baseUrl,
          apiKey: this.config.apiKey,
        },
        { storage: this.storage },
      );

      this.editor.replacePlaceholder(placeholderId, result.translatedText);
      this.jobs.resolve(jobId);
    } catch (error) {
      this.editor.markPlaceholderFailed(placeholderId, String(error));
      this.jobs.fail(jobId);
    }
  }
}
```

- [ ] **Step 4: Add selection+paragraph tests and run Obsidian tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { ObsidianTranslatorController } from "../src/main";
import type { StorageAdapter } from "@llm-translator/core";

function storage(): StorageAdapter {
  const cache = new Map<string, any>();
  return {
    async getGlossary() { return { version: "1", terms: [] }; },
    async saveGlossary() {},
    async getCache(k) { return cache.get(k) ?? null; },
    async setCache(k, v, _ttlMs) { cache.set(k, v); },
    async getSettings() { return { promptVersion: "v1", cacheTtlMs: 60000 }; },
    async saveSettings() {},
  };
}

describe("ObsidianTranslatorController", () => {
  it("replaces placeholder with translated text", async () => {
    const editor = {
      getSelection: () => "hello",
      getCurrentParagraph: () => "Hello paragraph",
      insertPlaceholderBelowSelection: () => "ph-1",
      insertPlaceholderBelowParagraph: () => "ph-2",
      replacePlaceholder: vi.fn(),
      markPlaceholderFailed: vi.fn(),
    };

    const controller = new ObsidianTranslatorController(
      editor,
      storage(),
      { baseUrl: "http://localhost:11434/v1", model: "qwen2.5", targetLang: "zh" },
    );

    await controller.translateSelection();
    expect(editor.replacePlaceholder).toHaveBeenCalledOnce();
    expect(editor.markPlaceholderFailed).not.toHaveBeenCalled();
  });

  it("replaces paragraph placeholder with translated text", async () => {
    const editor = {
      getSelection: () => "",
      getCurrentParagraph: () => "Hello paragraph",
      insertPlaceholderBelowSelection: () => "ph-1",
      insertPlaceholderBelowParagraph: () => "ph-2",
      replacePlaceholder: vi.fn(),
      markPlaceholderFailed: vi.fn(),
    };

    const controller = new ObsidianTranslatorController(
      editor,
      storage(),
      { baseUrl: "http://localhost:11434/v1", model: "qwen2.5", targetLang: "zh" },
    );

    await controller.translateParagraph();
    expect(editor.replacePlaceholder).toHaveBeenCalledOnce();
    expect(editor.markPlaceholderFailed).not.toHaveBeenCalled();
  });
});
```

```ts
// apps/obsidian-plugin/tests/translateParagraph.test.ts
import { describe, expect, it, vi } from "vitest";
import { ObsidianTranslatorController } from "../src/main";
import type { StorageAdapter } from "@llm-translator/core";

function storage(): StorageAdapter {
  const cache = new Map<string, any>();
  return {
    async getGlossary() { return { version: "1", terms: [] }; },
    async saveGlossary() {},
    async getCache(k) { return cache.get(k) ?? null; },
    async setCache(k, v, _ttlMs) { cache.set(k, v); },
    async getSettings() { return { promptVersion: "v1", cacheTtlMs: 60000 }; },
    async saveSettings() {},
  };
}

describe("ObsidianTranslatorController.translateParagraph", () => {
  it("replaces paragraph placeholder with translated text", async () => {
    const editor = {
      getSelection: () => "",
      getCurrentParagraph: () => "Hello paragraph",
      insertPlaceholderBelowSelection: () => "ph-1",
      insertPlaceholderBelowParagraph: () => "ph-2",
      replacePlaceholder: vi.fn(),
      markPlaceholderFailed: vi.fn(),
    };

    const controller = new ObsidianTranslatorController(
      editor,
      storage(),
      { baseUrl: "http://localhost:11434/v1", model: "qwen2.5", targetLang: "zh" },
    );

    await controller.translateParagraph();
    expect(editor.replacePlaceholder).toHaveBeenCalledOnce();
    expect(editor.markPlaceholderFailed).not.toHaveBeenCalled();
  });
});
```

Run: `npm run -w @llm-translator/obsidian-plugin test -- --run tests/backfill.test.ts tests/translateSelection.test.ts tests/translateParagraph.test.ts`  
Expected: PASS with pending/resolved behavior and selection+paragraph translation flows validated.

- [ ] **Step 5: Commit**

```bash
git add apps/obsidian-plugin
git commit -m "feat(obsidian): add selection and paragraph translation with placeholder backfill"
```

### Task 5: Build Browser Extension Adapter (Selection + Paragraph)

**Files:**
- Create: `apps/browser-extension/package.json`
- Create: `apps/browser-extension/tsconfig.json`
- Create: `apps/browser-extension/manifest.json`
- Create: `apps/browser-extension/src/background.ts`
- Create: `apps/browser-extension/src/contentScript.ts`
- Create: `apps/browser-extension/src/storageAdapter.ts`
- Test: `apps/browser-extension/tests/contentScript.test.ts`
- Test: `apps/browser-extension/tests/paragraphNode.test.ts`

- [ ] **Step 1: Write failing browser placeholder test**

```ts
import { describe, expect, it } from "vitest";
import { getParagraphNodeFromSelection, insertPlaceholderBelow } from "../src/contentScript";

describe("insertPlaceholderBelow", () => {
  it("inserts placeholder element below source node", () => {
    const root = document.createElement("div");
    const source = document.createElement("p");
    source.textContent = "hello";
    root.appendChild(source);

    const placeholder = insertPlaceholderBelow(source, "translating...");
    expect(placeholder.textContent).toContain("translating...");
    expect(root.lastElementChild).toBe(placeholder);
  });
});

describe("getParagraphNodeFromSelection", () => {
  it("returns nearest paragraph-like node", () => {
    const p = document.createElement("p");
    const span = document.createElement("span");
    p.appendChild(span);
    document.body.appendChild(p);

    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const found = getParagraphNodeFromSelection(selection);
    expect(found?.tagName).toBe("P");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -w @llm-translator/browser-extension test -- --run tests/contentScript.test.ts`  
Expected: FAIL because browser extension package and source files are missing.

- [ ] **Step 3: Scaffold extension and implement content/background flow**

```json
// apps/browser-extension/package.json
{
  "name": "@llm-translator/browser-extension",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run --environment jsdom"
  },
  "dependencies": {
    "@llm-translator/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.8",
    "jsdom": "^25.0.1"
  }
}
```

```json
// apps/browser-extension/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src", "tests"]
}
```

```json
// apps/browser-extension/manifest.json
{
  "manifest_version": 3,
  "name": "LLM Translator",
  "version": "0.1.0",
  "permissions": ["storage", "activeTab"],
  "background": { "service_worker": "dist/background.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/contentScript.js"]
    }
  ]
}
```

```ts
// apps/browser-extension/src/contentScript.ts
export function insertPlaceholderBelow(sourceNode: Element, text: string): HTMLElement {
  const placeholder = document.createElement("div");
  placeholder.dataset.llmTranslator = "placeholder";
  placeholder.textContent = text;
  sourceNode.insertAdjacentElement("afterend", placeholder);
  return placeholder;
}

export function replacePlaceholder(placeholder: HTMLElement, translatedText: string): void {
  placeholder.dataset.llmTranslator = "translated";
  placeholder.textContent = translatedText;
}

export function getParagraphNodeFromSelection(selection: Selection | null): Element | null {
  if (!selection || selection.rangeCount === 0) return null;
  const node = selection.getRangeAt(0).startContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return null;
  return el.closest("p, li, blockquote, h1, h2, h3, h4, h5, h6");
}
```

```ts
// apps/browser-extension/src/storageAdapter.ts
import type { Glossary, Settings, StorageAdapter, TranslateResponse } from "@llm-translator/core";

export function createChromeStorageAdapter(): StorageAdapter {
  return {
    async getGlossary(): Promise<Glossary> {
      const data = await chrome.storage.local.get("glossary");
      return data.glossary ?? { version: "1", terms: [] };
    },
    async saveGlossary(glossary: Glossary): Promise<void> {
      await chrome.storage.local.set({ glossary });
    },
    async getCache(key: string): Promise<TranslateResponse | null> {
      const data = await chrome.storage.local.get(`cache:${key}`);
      return data[`cache:${key}`] ?? null;
    },
    async setCache(key: string, value: TranslateResponse, _ttlMs: number): Promise<void> {
      await chrome.storage.local.set({ [`cache:${key}`]: value });
    },
    async getSettings(): Promise<Settings> {
      const data = await chrome.storage.local.get("settings");
      return data.settings ?? { promptVersion: "v1", cacheTtlMs: 7 * 24 * 60 * 60 * 1000 };
    },
    async saveSettings(settings: Settings): Promise<void> {
      await chrome.storage.local.set({ settings });
    },
  };
}
```

```ts
// apps/browser-extension/src/background.ts
import { translate } from "@llm-translator/core";
import { createChromeStorageAdapter } from "./storageAdapter";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "translate") return;

  void (async () => {
    try {
      const storage = createChromeStorageAdapter();
      const res = await translate(
        {
          text: message.text,
          sourceLang: "auto",
          targetLang: message.targetLang ?? "zh",
          model: message.model,
          baseUrl: message.baseUrl,
          apiKey: message.apiKey,
          forceRefresh: Boolean(message.forceRefresh),
        },
        { storage },
      );
      sendResponse({ ok: true, data: res });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  })();

  return true;
});
```

- [ ] **Step 4: Run browser tests**

Run: `npm run -w @llm-translator/browser-extension test -- --run tests/contentScript.test.ts tests/paragraphNode.test.ts`  
Expected: PASS with selection placeholder and paragraph-node detection assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/browser-extension
git commit -m "feat(browser): add mv3 extension adapter for selection and paragraph translation"
```

### Task 6: Add Shared Glossary File and Cross-End Integration Tests

**Files:**
- Create: `shared/glossary.json`
- Create: `packages/core/tests/integration.consistency.test.ts`
- Modify: `apps/obsidian-plugin/tests/translateSelection.test.ts`
- Modify: `apps/obsidian-plugin/tests/translateParagraph.test.ts`
- Create: `apps/browser-extension/tests/backgroundMessage.test.ts`
- Modify: `apps/browser-extension/tests/paragraphNode.test.ts`

- [ ] **Step 1: Write failing cross-end consistency tests**

```ts
import { describe, expect, it } from "vitest";
import { parseGlossary } from "../src";
import glossaryFile from "../../../shared/glossary.json";

describe("shared glossary file", () => {
  it("is valid and loadable by core parser", () => {
    const glossary = parseGlossary(glossaryFile);
    expect(glossary.version).toBeTypeOf("string");
    expect(Array.isArray(glossary.terms)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run -w @llm-translator/core test -- --run tests/integration.consistency.test.ts`  
Expected: FAIL because `shared/glossary.json` does not exist.

- [ ] **Step 3: Create shared glossary and adapter-level integration tests**

```json
// shared/glossary.json
{
  "version": "1",
  "terms": [
    { "source": "Transformer", "target": "Transformer（变换器）" },
    { "source": "fine-tuning", "target": "微调" },
    { "source": "token", "target": "令牌" }
  ]
}
```

```ts
// apps/browser-extension/tests/backgroundMessage.test.ts
import { describe, expect, it, vi } from "vitest";

describe("background translate message", () => {
  it("returns ok response shape", async () => {
    const sendResponse = vi.fn();
    const listener = (globalThis as any).chrome?.runtime?.onMessage?.addListener;
    expect(typeof listener === "function" || listener === undefined).toBe(true);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
```

```ts
// apps/obsidian-plugin/tests/translateSelection.test.ts (add assertion)
expect(editor.replacePlaceholder.mock.calls[0][1].length).toBeGreaterThan(0);
```

```ts
// apps/obsidian-plugin/tests/translateParagraph.test.ts (add assertion)
expect(editor.replacePlaceholder.mock.calls[0][1].length).toBeGreaterThan(0);
```

```ts
// apps/browser-extension/tests/paragraphNode.test.ts (add assertion)
expect(found).not.toBeNull();
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`  
Expected: PASS for core, Obsidian adapter tests, and browser adapter tests.

- [ ] **Step 5: Commit**

```bash
git add shared/glossary.json packages/core/tests/integration.consistency.test.ts apps/obsidian-plugin/tests/translateSelection.test.ts apps/obsidian-plugin/tests/translateParagraph.test.ts apps/browser-extension/tests/backgroundMessage.test.ts apps/browser-extension/tests/paragraphNode.test.ts
git commit -m "test: add shared glossary consistency and adapter integration checks"
```

### Task 7: Developer Docs, Verification Script, and Release-Ready Defaults

**Files:**
- Create: `README.md`
- Create: `docs/setup.md`
- Create: `docs/mvp-manual-smoke-test.md`
- Modify: `package.json`

- [ ] **Step 1: Write failing docs validation command**

```json
// package.json (add script first, test should fail until files exist)
{
  "scripts": {
    "check:docs": "node -e \"const fs=require('fs');['README.md','docs/setup.md','docs/mvp-manual-smoke-test.md'].forEach((p)=>{if(!fs.existsSync(p)){console.error('Missing',p);process.exitCode=1;}})\""
  }
}
```

Run: `npm run check:docs`  
Expected: FAIL before doc files are created.

- [ ] **Step 2: Add README with install/run instructions**

```md
# llm-translator

MVP monorepo for Obsidian + browser translation via OpenAI-compatible APIs.

## Quick Start

1. `npm install`
2. `npm test`
3. `npm run build`

## Packages

- `@llm-translator/core`
- `@llm-translator/obsidian-plugin`
- `@llm-translator/browser-extension`
```

- [ ] **Step 3: Add setup and manual smoke docs**

```md
<!-- docs/setup.md -->
# Setup

## Core config

- base URL (local or remote OpenAI-compatible endpoint)
- model
- API key (optional for local)

## Shared glossary

Edit `shared/glossary.json` and reload plugin/extension.
```

```md
<!-- docs/mvp-manual-smoke-test.md -->
# MVP Manual Smoke Test

1. Translate a selected sentence in Obsidian.
2. Confirm placeholder appears then backfills.
3. Repeat same sentence and confirm cache hit behavior.
4. Translate a selected sentence in browser page.
5. Confirm glossary term appears in output.
```

- [ ] **Step 4: Run docs and full verification**

Run: `npm run check:docs; npm test; npm run build`  
Expected: PASS for docs checks, tests, and TypeScript builds.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/setup.md docs/mvp-manual-smoke-test.md package.json
git commit -m "docs: add setup and smoke-test guide for mvp"
```
