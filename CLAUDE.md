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
| `src/lib/label-spec.ts`   | The `LabelSpec` contract shared by form, preview and PDF   |
| `src/lib/pdf/layout.ts`   | Pure geometry: grid planning and word wrapping             |
| `src/lib/pdf/render.ts`   | Server-only PDF renderer                                   |
| `src/lib/fonts.ts`        | Font catalogue; the TTFs themselves are in `/fonts`        |
| `src/lib/analytics.ts`    | Server-side event writer (server-only)                     |
| `src/lib/track-client.ts` | Client-side event transport                                |
| `src/components/`         | The form, the live preview, and `ui/` primitives           |

## Conventions

- **Geometry lives in one place.** The preview and the PDF both import
  `planGrid` and `wrapText` from `src/lib/pdf/layout.ts`. If they ever disagree
  about where text sits, the fix belongs in that module, not in one of the two
  callers.
- **Units.** Label size is centimetres, stroke and radius are millimetres, text
  size is points. Convert at the edge with helpers from `src/lib/pdf/units.ts`;
  never hard-code `72 / 25.4`.
- **Labels are always pure black.** Not configurable — printers dither anything
  else and the result looks muddy at label sizes.
- **Server-only modules** import `server-only` at the top. Anything a client
  component needs (the font catalogue, the action names, the spec type) must live
  in a module free of Node built-ins — that is why `ACTIONS` sits in
  `analytics-actions.ts` and not in `analytics.ts`.
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
names are enumerated in `src/lib/analytics-actions.ts`.

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
