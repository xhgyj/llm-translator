import { z } from "zod";

const GlossaryTermSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
});

const RawGlossarySchema = z.object({
  version: z.string().min(1),
  terms: z.array(z.unknown()),
});

export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;

export type Glossary = {
  version: string;
  terms: GlossaryTerm[];
};

export function parseGlossary(input: unknown): Glossary {
  const parsed = RawGlossarySchema.parse(input);

  const terms = parsed.terms.flatMap((term) => {
    const result = GlossaryTermSchema.safeParse(term);
    return result.success ? [result.data] : [];
  });

  return {
    version: parsed.version,
    terms,
  };
}

export function buildGlossaryPrompt(glossary: Glossary): string {
  return glossary.terms.map((term) => `${term.source} => ${term.target}`).join("\n");
}
