import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGlossary } from "../src/index.js";

const glossaryPath = fileURLToPath(new URL("../../../shared/glossary.json", import.meta.url));
const sharedGlossary = JSON.parse(readFileSync(glossaryPath, "utf8")) as unknown;

describe("shared glossary consistency", () => {
  it("is valid JSON and loadable by the core glossary parser", () => {
    const parsedGlossary = parseGlossary(sharedGlossary);

    expect(parsedGlossary).toEqual({
      version: "1",
      terms: [
        { source: "LLM", target: "large language model" },
        { source: "glossary", target: "term list" },
        { source: "translation", target: "translation output" },
      ],
    });
  });
});
