# MVP Manual Smoke Test

Use this checklist after setup or a build change.

## Obsidian

1. Open Obsidian with the MVP plugin loaded.
2. Select a short sentence.
3. Trigger translation.
4. Confirm a `Translating...` placeholder appears first.
5. Confirm the translated text is inserted below the source text.
6. Trigger the same translation again.
7. Confirm the cached path is used and the result still appears correctly.

## Browser

1. Load the browser extension.
2. Open a page with a normal paragraph of text.
3. Select a sentence or target a paragraph block.
4. Trigger translation.
5. Confirm the placeholder appears in the page.
6. Confirm the translated text replaces the placeholder below the source content.

## Smoke-test pass criteria

- `check:docs` passes
- `npm test` passes
- `npm run build` passes
- Obsidian selection translation works
- Browser selection or paragraph translation works
- Placeholder backfill completes without leaving stale placeholders
