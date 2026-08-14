# label-generator

A one-page Next.js app that turns a piece of text and a size in centimetres into
an A4 PDF filled with printable labels.

## Stack

- Next.js (App Router) + React, TypeScript
- Tailwind CSS v4 — configured entirely in `src/app/globals.css` via `@theme`,
  there is no `tailwind.config.js`
- shadcn-style components: `cva` + `cn`, files under `src/components/ui`, no
  component library runtime
- MongoDB (standalone, no replica set) via the official driver; PDFs live in
  GridFS bucket `pdfs`
- `pdf-lib` + `@pdf-lib/fontkit` for PDF generation
- Iconify (`@iconify/react`) for icons — the project ships no SVG of its own

## Layout

| Path                      | What lives there                                          |
| ------------------------- | --------------------------------------------------------- |
| `src/lib/label-spec.ts`   | The `LabelSpec` contract, plus all span algebra            |
| `src/lib/pdf/layout.ts`   | Pure geometry: grid planning, wrapping, placement          |
| `src/lib/pdf/render.ts`   | Server-only PDF renderer                                   |
| `src/lib/fonts.ts`        | Font catalogue; the TTFs themselves are in `/fonts`        |
| `src/lib/analytics.ts`    | Server-side event writer (server-only)                     |
| `src/lib/track-client.ts` | Client-side event transport                                |
| `src/components/`         | The form, the live preview, and `ui/` primitives           |

## Styled selections

`LabelSpec.text` is a plain string; `LabelSpec.spans` styles parts of it. A
`TextSpan` is a half-open `[start, end)` range over that string carrying an
optional `sizePt` and `bold`, and anything it leaves undefined falls through to
the label's base style. Offsets are exactly what a textarea reports through
`selectionStart` / `selectionEnd`, which is what lets the form hand its
selection straight to the model.

Everything that manipulates spans lives in `label-spec.ts`:

- `normalizeSpans` is the gatekeeper — it flattens spans onto characters and
  rebuilds them sorted, non-overlapping and merged. **Every path that produces
  spans runs through it**, so the rest of the code may assume that shape.
  Overlaps resolve field by field, later span wins, which is what lets a size
  and a bold applied to different ranges stack where they cross.
- `remapSpans` moves offsets across a text edit. It matches the shared *suffix*
  before the prefix; the other order makes deleting `"Salt "` from
  `"Salt Sugar"` look like replacing `"alt S"` with `"u"`, because both words
  start with S, and the styled word loses a character.
- `toStyledRuns` resolves text plus spans into runs with no undefined left,
  which is all the renderer and preview ever consume.

## Conventions

- **Geometry lives in one place.** The preview and the PDF both call
  `layOutLabelText` from `src/lib/pdf/layout.ts`; it returns placed fragments in
  a top-left, y-down coordinate system, and the PDF renderer flips y exactly
  once, where it draws. If the two ever disagree about where text sits, the fix
  belongs in that module, not in one of the two callers.
- **Measure fragments, not characters.** `toFragments` run-length encodes a line
  by style before measuring. Measuring character by character and summing drifts
  by up to 6% on kerned pairs (`AVATAR`, `ToTAL`); measuring whole same-style
  runs is exact.
- **Two faces, always.** The renderer embeds regular and bold of the chosen
  family so a bolded selection uses a real bold face rather than a synthetic
  one. Families whose two weights point at the same file are embedded once.
- **Units.** Label size is centimetres, stroke and radius are millimetres, text
  size is points. Convert at the edge with helpers from `src/lib/pdf/units.ts`;
  never hard-code `72 / 25.4`.
- **Labels are always pure black.** Not configurable — printers dither anything
  else and the result looks muddy at label sizes.
- **Server-only modules** import `server-only` at the top. Anything a client
  component needs (the font catalogue, the action names, the spec type) must live
  in a module free of Node built-ins.
- **Analytics actions**: Always use hardcoded string literals for analytics event action names. Do not use an enum or object (e.g., `ACTIONS`).
- **Analytics never throws.** `track()` swallows and logs its own errors; a
  broken database must not stop somebody printing.
- **Design tokens only.** Colours come from the `@theme` block in `globals.css`
  (`text-label-secondary`, `bg-fill-tertiary`, …). Do not introduce raw hex
  values or Tailwind's default palette; light theme only.
- **Two button styles, two sizes.** `primary` and `ghost`, `sm` and `md`. Adding
  a third of either is a design decision, not an implementation detail.

## Analytics events

One collection, `analytics_events`, with `{ deviceId, action, time, data, country }`.
`country` is intentionally always `null` — resolving it needs either a header
from the reverse proxy or a bundled IP database, and neither is set up. Action
names are represented as inline hardcoded strings.

The device id is an anonymous UUID set as the httpOnly cookie `lg_did` by
`src/middleware.ts` on the first request.

## Local development

```sh
docker compose up -d      # MongoDB on :27017
cp .env.example .env
npm install
npm run dev
```

`npm run typecheck` and `npm run lint` before pushing.
