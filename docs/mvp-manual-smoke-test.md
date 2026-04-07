# MVP Manual Smoke Test

Use this checklist after setup or a build change.

## Obsidian

1. Open Obsidian with the MVP plugin loaded.
2. Select a short sentence and use right-click `Translate selected text`.
3. Confirm a temporary translation overlay appears.
4. Clear selection and confirm the overlay disappears.
5. Trigger translation again and click `Pin to note`.
6. Confirm translated text is inserted into the note.
7. In PDF view, select text and use right-click translation.
8. Confirm a read-only translation popup appears and no text is written back to PDF.

## Browser

1. Load the browser extension.
2. Open a page with a normal paragraph of text.
3. Select a sentence and use right-click translation.
4. Confirm a temporary translation layer appears.
5. Clear selection and confirm the layer disappears.
6. Trigger again and click `Pin to page`.
7. Confirm pinned translation remains in the page.
8. Open a PDF URL, select text, and use right-click translation.
9. Confirm read-only translation popup opens.

## Smoke-test pass criteria

- `check:docs` passes
- `npm test` passes
- `npm run build` passes
- temporary UI shows `Translating...` while request is pending
- Obsidian selection translation works
- Browser selection or paragraph translation works
- Placeholder backfill completes without leaving stale placeholders
