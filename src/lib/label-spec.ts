/**
 * The label specification. Shared by the form, the live preview and the PDF
 * renderer so all three agree on what a label is - the preview is only a
 * different rasteriser for the same numbers.
 */

import { DEFAULT_FONT_ID, findFont, type FontId } from './fonts';

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export interface LabelSpec {
  text: string;
  /** Label box size in centimetres. */
  widthCm: number;
  heightCm: number;
  fontId: FontId;
  bold: boolean;
  /** Text size in points, the unit printers and word processors agree on. */
  fontSizePt: number;
  horizontalAlign: HorizontalAlign;
  verticalAlign: VerticalAlign;
  /** Border stroke width in millimetres. 0 hides the border. */
  strokeMm: number;
  /** Corner radius in millimetres. */
  radiusMm: number;
}

export const LIMITS = {
  text: { maxLength: 500 },
  widthCm: { min: 1, max: 20, step: 0.1 },
  heightCm: { min: 0.5, max: 28, step: 0.1 },
  fontSizePt: { min: 4, max: 96, step: 1 },
  strokeMm: { min: 0, max: 3, step: 0.1 },
  radiusMm: { min: 0, max: 20, step: 0.5 },
} as const;

export const DEFAULT_SPEC: LabelSpec = {
  text: 'Sugar',
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

/**
 * Coerces untrusted input (an HTTP body) into a valid spec. Out-of-range values
 * are clamped rather than rejected: the form already constrains them, so a value
 * outside the range is a client bug, not something worth failing a print over.
 */
export function parseSpec(input: unknown): LabelSpec {
  const raw = (input ?? {}) as Record<string, unknown>;
  const font = findFont(String(raw.fontId ?? ''));

  return {
    text: String(raw.text ?? '').slice(0, LIMITS.text.maxLength),
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
