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
