import type { Glossary } from "./glossary.js";

export type TranslateRequest = {
  text: string;
  sourceLang: string;
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

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StorageAdapter = {
  getGlossary(): Promise<Glossary>;
  saveGlossary(glossary: Glossary): Promise<void>;
  getCache(key: string): Promise<TranslateResponse | null>;
  setCache(key: string, value: TranslateResponse, ttlMs: number): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
};
