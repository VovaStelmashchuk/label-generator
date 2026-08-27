/**
 * The label specification. Shared by the form, the live preview and the PDF
 * renderer so all three agree on what a label is - the preview is only a
 * different rasteriser for the same numbers.
 */

import { DEFAULT_FONT_ID, findFont, type FontId } from './fonts';

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

/**
 * A stretch of the label text that overrides the label's base style.
 *
 * Offsets are half-open `[start, end)` indices into `LabelSpec.text`, in the
 * same units a textarea reports through `selectionStart` / `selectionEnd`, so
 * the form can hand its selection straight over. Fields left undefined fall
 * through to the base style, which is what lets "make this word bigger" and
 * "make this word bold" stack on the same range.
 */
export interface TextSpan {
  start: number;
  end: number;
  sizePt?: number;
  bold?: boolean;
}

export interface LabelSpec {
  text: string;
  /**
   * Per-selection style overrides. Always stored normalised: sorted, non
   * overlapping, and with no span that matches the base style.
   */
  spans: TextSpan[];
  /** Label box size in centimetres. */
  widthCm: number;
  heightCm: number;
  fontId: FontId;
  /** Base weight, used wherever no span says otherwise. */
  bold: boolean;
  /** Base text size in points, the unit printers and word processors agree on. */
  fontSizePt: number;
  horizontalAlign: HorizontalAlign;
  verticalAlign: VerticalAlign;
  /** Border stroke width in millimetres. 0 hides the border. */
  strokeMm: number;
  /** Corner radius in millimetres. */
  radiusMm: number;
  /** Maximum number of labels per page. Optional, defaults to unlimited (fills the page). */
  maxLabels?: number;
}

export const LIMITS = {
  text: { maxLength: 500 },
  widthCm: { min: 1, max: 20, step: 0.1 },
  heightCm: { min: 0.5, max: 28, step: 0.1 },
  fontSizePt: { min: 4, max: 96, step: 1 },
  strokeMm: { min: 0, max: 3, step: 0.1 },
  radiusMm: { min: 0, max: 20, step: 0.5 },
  maxLabels: { min: 1, max: 100, step: 1 },
} as const;

export const DEFAULT_SPEC: LabelSpec = {
  text: 'Sugar',
  spans: [],
  widthCm: 6,
  heightCm: 3,
  fontId: DEFAULT_FONT_ID,
  bold: true,
  fontSizePt: 18,
  horizontalAlign: 'center',
  verticalAlign: 'middle',
  strokeMm: 0.4,
  radiusMm: 3,
};

/** Padding between the label border and the text, in millimetres. */
export const TEXT_PADDING_MM = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function num(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** The style that actually applies to one character. */
interface CharacterStyle {
  sizePt?: number;
  bold?: boolean;
}

function sameStyle(a: CharacterStyle | null, b: CharacterStyle | null): boolean {
  if (a === null || b === null) return a === b;
  return a.sizePt === b.sizePt && a.bold === b.bold;
}

/**
 * Flattens spans onto individual characters and rebuilds them as a tidy list:
 * sorted, non-overlapping, adjacent equals merged, out-of-range parts dropped.
 *
 * Later spans win field by field rather than wholesale, so applying a size to a
 * word and then bolding half of it leaves the size intact on both halves.
 */
export function normalizeSpans(
  text: string,
  spans: readonly TextSpan[],
): TextSpan[] {
  if (spans.length === 0) return [];

  const styles: (CharacterStyle | null)[] = new Array(text.length).fill(null);

  for (const span of spans) {
    const start = clamp(Math.floor(span.start), 0, text.length);
    const end = clamp(Math.ceil(span.end), 0, text.length);
    if (end <= start) continue;

    const sizePt =
      span.sizePt === undefined
        ? undefined
        : clamp(span.sizePt, LIMITS.fontSizePt.min, LIMITS.fontSizePt.max);

    for (let index = start; index < end; index += 1) {
      const current = styles[index] ?? {};
      styles[index] = {
        sizePt: sizePt ?? current.sizePt,
        bold: span.bold ?? current.bold,
      };
    }
  }

  // Drop overrides that say nothing, so an empty object never becomes a span.
  for (let index = 0; index < styles.length; index += 1) {
    const style = styles[index];
    if (style && style.sizePt === undefined && style.bold === undefined) {
      styles[index] = null;
    }
  }

  const result: TextSpan[] = [];
  let index = 0;
  while (index < styles.length) {
    const style = styles[index];
    if (style === null) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < styles.length && sameStyle(styles[end], style)) end += 1;
    result.push({ start: index, end, ...style });
    index = end;
  }

  return result;
}

/** One stretch of text that is drawn with a single, fully resolved style. */
export interface StyledRun {
  text: string;
  sizePt: number;
  bold: boolean;
}

/**
 * Resolves text plus spans into runs with no undefined left in them, which is
 * all the renderer and the preview ever need to know about styling.
 */
export function toStyledRuns(spec: LabelSpec): StyledRun[] {
  const spans = normalizeSpans(spec.text, spec.spans);
  const runs: StyledRun[] = [];
  let cursor = 0;

  const push = (text: string, style: CharacterStyle) => {
    if (text === '') return;
    runs.push({
      text,
      sizePt: style.sizePt ?? spec.fontSizePt,
      bold: style.bold ?? spec.bold,
    });
  };

  for (const span of spans) {
    push(spec.text.slice(cursor, span.start), {});
    push(spec.text.slice(span.start, span.end), span);
    cursor = span.end;
  }
  push(spec.text.slice(cursor), {});

  return runs;
}

/**
 * The style in force at one character position, with the base style filled in.
 * The form uses it to show what its size field and bold button are currently
 * pointing at.
 */
export function styleAt(
  spec: LabelSpec,
  index: number,
): { sizePt: number; bold: boolean } {
  const span = spec.spans.find(
    (candidate) => index >= candidate.start && index < candidate.end,
  );
  return {
    sizePt: span?.sizePt ?? spec.fontSizePt,
    bold: span?.bold ?? spec.bold,
  };
}

/** Strips every override inside `[start, end)`, leaving the base style. */
export function clearSpanRange(
  spec: LabelSpec,
  start: number,
  end: number,
): TextSpan[] {
  const kept: TextSpan[] = [];
  for (const span of spec.spans) {
    if (span.end <= start || span.start >= end) {
      kept.push(span);
      continue;
    }
    // Keep whatever pokes out either side of the cleared range.
    if (span.start < start) kept.push({ ...span, end: start });
    if (span.end > end) kept.push({ ...span, start: end });
  }
  return normalizeSpans(spec.text, kept);
}

/**
 * Moves spans across a text edit so a resized word keeps its size while the
 * user types elsewhere.
 *
 * The edit is recovered as the single changed stretch between the shared prefix
 * and the shared suffix - which is what a textarea produces for typing, pasting
 * and deleting alike. Anything inside the replaced stretch collapses to its
 * start, so styling on deleted text disappears with it.
 */
export function remapSpans(
  previousText: string,
  nextText: string,
  spans: readonly TextSpan[],
): TextSpan[] {
  if (spans.length === 0 || previousText === nextText) {
    return normalizeSpans(nextText, spans);
  }

  // The shared suffix is matched first, and the prefix only gets what is left.
  // Doing it the other way round makes deleting "Salt " from "Salt Sugar" look
  // like replacing "alt S" with "u", because the two words share their leading
  // S - and the styled word would lose its first character.
  let suffix = 0;
  const maxSuffix = Math.min(previousText.length, nextText.length);
  while (
    suffix < maxSuffix &&
    previousText[previousText.length - 1 - suffix] ===
      nextText[nextText.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  let prefix = 0;
  const maxPrefix = Math.min(
    previousText.length - suffix,
    nextText.length - suffix,
  );
  while (prefix < maxPrefix && previousText[prefix] === nextText[prefix]) {
    prefix += 1;
  }

  const replacedStart = prefix;
  const replacedEnd = previousText.length - suffix;
  const delta = nextText.length - previousText.length;

  const move = (index: number) => {
    if (index <= replacedStart) return index;
    if (index >= replacedEnd) return index + delta;
    return replacedStart;
  };

  return normalizeSpans(
    nextText,
    spans.map((span) => ({
      ...span,
      start: move(span.start),
      end: move(span.end),
    })),
  );
}

function parseSpans(value: unknown): TextSpan[] {
  if (!Array.isArray(value)) return [];
  const spans: TextSpan[] = [];

  for (const entry of value.slice(0, LIMITS.text.maxLength)) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const start = Number(raw.start);
    const end = Number(raw.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const span: TextSpan = { start, end };
    if (raw.sizePt !== undefined && Number.isFinite(Number(raw.sizePt))) {
      span.sizePt = clamp(
        Number(raw.sizePt),
        LIMITS.fontSizePt.min,
        LIMITS.fontSizePt.max,
      );
    }
    if (typeof raw.bold === 'boolean') span.bold = raw.bold;
    if (span.sizePt === undefined && span.bold === undefined) continue;

    spans.push(span);
  }

  return spans;
}

/**
 * Coerces untrusted input (an HTTP body) into a valid spec. Out-of-range values
 * are clamped rather than rejected: the form already constrains them, so a value
 * outside the range is a client bug, not something worth failing a print over.
 */
export function parseSpec(input: unknown): LabelSpec {
  const raw = (input ?? {}) as Record<string, unknown>;
  const font = findFont(String(raw.fontId ?? ''));
  const text = String(raw.text ?? '').slice(0, LIMITS.text.maxLength);

  return {
    text,
    spans: normalizeSpans(text, parseSpans(raw.spans)),
    widthCm: num(
      raw.widthCm,
      DEFAULT_SPEC.widthCm,
      LIMITS.widthCm.min,
      LIMITS.widthCm.max,
    ),
    heightCm: num(
      raw.heightCm,
      DEFAULT_SPEC.heightCm,
      LIMITS.heightCm.min,
      LIMITS.heightCm.max,
    ),
    fontId: font?.id ?? DEFAULT_FONT_ID,
    bold: Boolean(raw.bold),
    fontSizePt: num(
      raw.fontSizePt,
      DEFAULT_SPEC.fontSizePt,
      LIMITS.fontSizePt.min,
      LIMITS.fontSizePt.max,
    ),
    horizontalAlign: pick(
      raw.horizontalAlign,
      ['left', 'center', 'right'] as const,
      DEFAULT_SPEC.horizontalAlign,
    ),
    verticalAlign: pick(
      raw.verticalAlign,
      ['top', 'middle', 'bottom'] as const,
      DEFAULT_SPEC.verticalAlign,
    ),
    strokeMm: num(
      raw.strokeMm,
      DEFAULT_SPEC.strokeMm,
      LIMITS.strokeMm.min,
      LIMITS.strokeMm.max,
    ),
    radiusMm: num(
      raw.radiusMm,
      DEFAULT_SPEC.radiusMm,
      LIMITS.radiusMm.min,
      LIMITS.radiusMm.max,
    ),
    maxLabels:
      raw.maxLabels !== undefined && raw.maxLabels !== null && raw.maxLabels !== ''
        ? num(
            raw.maxLabels,
            LIMITS.maxLabels.max,
            LIMITS.maxLabels.min,
            LIMITS.maxLabels.max,
          )
        : undefined,
  };
}

/** Filename offered to the browser, derived from the label text. */
export function pdfFileName(spec: LabelSpec): string {
  const slug = spec.text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const size = `${spec.widthCm}x${spec.heightCm}cm`;
  return `${slug || 'labels'}-${size}.pdf`;
}
