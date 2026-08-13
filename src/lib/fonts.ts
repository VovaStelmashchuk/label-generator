/**
 * The font catalogue. Every family here ships as a TTF in `/fonts` and covers
 * Latin, Latin Extended and Cyrillic (including the Ukrainian ї, є, і, ґ), so a
 * label renders the same characters the user typed regardless of language.
 *
 * This module is imported by both server and client code, so it must stay free
 * of Node built-ins - only the file names live here, never the file contents.
 */

export type FontId =
  | 'liberation-sans'
  | 'dejavu-sans'
  | 'liberation-serif'
  | 'lora'
  | 'jetbrains-mono'
  | 'ibm-plex-mono';

export type FontCategory = 'sans' | 'serif' | 'mono';

export interface FontDefinition {
  id: FontId;
  name: string;
  category: FontCategory;
  files: { regular: string; bold: string };
}

export const FONTS: readonly FontDefinition[] = [
  {
    id: 'liberation-sans',
    name: 'Liberation Sans',
    category: 'sans',
    files: {
      regular: 'LiberationSans-Regular.ttf',
      bold: 'LiberationSans-Bold.ttf',
    },
  },
  {
    id: 'dejavu-sans',
    name: 'DejaVu Sans',
    category: 'sans',
    files: { regular: 'DejaVuSans-Regular.ttf', bold: 'DejaVuSans-Bold.ttf' },
  },
  {
    id: 'liberation-serif',
    name: 'Liberation Serif',
    category: 'serif',
    files: {
      regular: 'LiberationSerif-Regular.ttf',
      bold: 'LiberationSerif-Bold.ttf',
    },
  },
  {
    id: 'lora',
    name: 'Lora',
    category: 'serif',
    files: { regular: 'Lora-Regular.ttf', bold: 'Lora-Bold.ttf' },
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    category: 'mono',
    files: {
      regular: 'JetBrainsMono-Regular.ttf',
      bold: 'JetBrainsMono-Bold.ttf',
    },
  },
  {
    id: 'ibm-plex-mono',
    name: 'IBM Plex Mono',
    category: 'mono',
    files: { regular: 'IBMPlexMono-Regular.ttf', bold: 'IBMPlexMono-Bold.ttf' },
  },
] as const;

export const DEFAULT_FONT_ID: FontId = 'liberation-sans';

export function findFont(id: string): FontDefinition | undefined {
  return FONTS.find((font) => font.id === id);
}

/** Stable key used by both the font API route and the browser's @font-face. */
export function fontFaceId(id: FontId, bold: boolean): string {
  return `${id}-${bold ? 'bold' : 'regular'}`;
}

export function parseFontFaceId(
  faceId: string,
): { font: FontDefinition; bold: boolean } | undefined {
  const bold = faceId.endsWith('-bold');
  const id = faceId.replace(/-(bold|regular)$/, '');
  const font = findFont(id);
  if (!font || !/-(bold|regular)$/.test(faceId)) return undefined;
  return { font, bold };
}
