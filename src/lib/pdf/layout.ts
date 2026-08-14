/**
 * Page and text layout maths. Pure functions with no PDF or DOM dependency, so
 * the same numbers drive the generated PDF and the live preview - they differ
 * only in how they measure glyphs and how they paint the result.
 */

import type {
  HorizontalAlign,
  StyledRun,
  VerticalAlign,
} from '../label-spec';
import { A4, cmToPt, mmToPt } from './units';

/** Blank margin kept around the grid; most home printers cannot print closer. */
export const PAGE_MARGIN_MM = 8;
/** Gap between neighbouring labels, giving scissors somewhere to go. */
export const LABEL_GAP_MM = 2;

export interface GridPlacement {
  columns: number;
  rows: number;
  count: number;
  /** Bottom-left corner of every label, in PDF points. */
  cells: { x: number; y: number }[];
  labelWidthPt: number;
  labelHeightPt: number;
}

function fitCount(availablePt: number, sizePt: number, gapPt: number): number {
  if (sizePt <= 0 || availablePt < sizePt) return 0;
  // n labels need n*size + (n-1)*gap of space.
  return Math.floor((availablePt + gapPt) / (sizePt + gapPt));
}

/**
 * Fills an A4 page with as many copies of the label as fit, and centres the
 * resulting block so the leftover margin is shared evenly on all four sides.
 */
export function planGrid(widthCm: number, heightCm: number): GridPlacement {
  const labelWidthPt = cmToPt(widthCm);
  const labelHeightPt = cmToPt(heightCm);
  const marginPt = mmToPt(PAGE_MARGIN_MM);
  const gapPt = mmToPt(LABEL_GAP_MM);

  const usableWidth = A4.widthPt - marginPt * 2;
  const usableHeight = A4.heightPt - marginPt * 2;

  const columns = fitCount(usableWidth, labelWidthPt, gapPt);
  const rows = fitCount(usableHeight, labelHeightPt, gapPt);

  if (columns === 0 || rows === 0) {
    return {
      columns: 0,
      rows: 0,
      count: 0,
      cells: [],
      labelWidthPt,
      labelHeightPt,
    };
  }

  const blockWidth = columns * labelWidthPt + (columns - 1) * gapPt;
  const blockHeight = rows * labelHeightPt + (rows - 1) * gapPt;
  const originX = (A4.widthPt - blockWidth) / 2;
  const originY = (A4.heightPt - blockHeight) / 2;

  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({
        x: originX + column * (labelWidthPt + gapPt),
        // PDF y grows upwards; fill the page top-down so the first label of the
        // grid is the top-left one.
        y: originY + blockHeight - (row + 1) * labelHeightPt - row * gapPt,
      });
    }
  }

  return {
    columns,
    rows,
    count: cells.length,
    cells,
    labelWidthPt,
    labelHeightPt,
  };
}

/**
 * How a caller measures glyphs. pdf-lib answers from the embedded font, the
 * preview from a canvas with the same TTF loaded - the layout code below does
 * not care which, as long as both answer for the same (size, weight) pair.
 */
export interface FontMetrics {
  width(text: string, sizePt: number, bold: boolean): number;
  ascent(sizePt: number, bold: boolean): number;
  descent(sizePt: number, bold: boolean): number;
}

/** A stretch of one line drawn with a single style, already measured. */
export interface Fragment {
  text: string;
  sizePt: number;
  bold: boolean;
  width: number;
}

/**
 * A fragment placed inside the label box. Coordinates are in points, measured
 * from the box's top-left corner with y pointing *down* - the SVG convention.
 * The PDF renderer flips y once, at the point of drawing.
 */
export interface PlacedFragment extends Fragment {
  x: number;
  baseline: number;
}

export interface TextLayout {
  fragments: PlacedFragment[];
  /** Width of the widest line, and the height of all lines stacked. */
  width: number;
  height: number;
  overflows: boolean;
}

interface StyledChar {
  ch: string;
  sizePt: number;
  bold: boolean;
}

/** Run-length encodes characters back into measured fragments. */
function toFragments(chars: StyledChar[], metrics: FontMetrics): Fragment[] {
  const fragments: Fragment[] = [];

  for (const char of chars) {
    const last = fragments[fragments.length - 1];
    if (last && last.sizePt === char.sizePt && last.bold === char.bold) {
      last.text += char.ch;
    } else {
      fragments.push({
        text: char.ch,
        sizePt: char.sizePt,
        bold: char.bold,
        width: 0,
      });
    }
  }

  for (const fragment of fragments) {
    fragment.width = metrics.width(fragment.text, fragment.sizePt, fragment.bold);
  }
  return fragments;
}

function totalWidth(fragments: readonly Fragment[]): number {
  return fragments.reduce((sum, fragment) => sum + fragment.width, 0);
}

function measureChars(chars: StyledChar[], metrics: FontMetrics): number {
  return totalWidth(toFragments(chars, metrics));
}

/**
 * Greedy word wrap over styled characters. Explicit newlines are honoured
 * first, then each paragraph is broken on whitespace to fit `maxWidthPt`. A
 * single word too wide for the line is split character by character rather than
 * allowed to overflow.
 *
 * Words are wrapped as units even when their characters carry different sizes,
 * so raising the size of one letter never splits the word around it.
 */
export function wrapStyledText(
  runs: readonly StyledRun[],
  maxWidthPt: number,
  metrics: FontMetrics,
): StyledChar[][] {
  const chars: StyledChar[] = [];
  for (const run of runs) {
    for (const ch of run.text) {
      chars.push({ ch, sizePt: run.sizePt, bold: run.bold });
    }
  }

  const paragraphs: StyledChar[][] = [[]];
  for (const char of chars) {
    if (char.ch === '\n') paragraphs.push([]);
    else paragraphs[paragraphs.length - 1].push(char);
  }

  const lines: StyledChar[][] = [];

  for (const paragraph of paragraphs) {
    const words: StyledChar[][] = [];
    let word: StyledChar[] = [];
    for (const char of paragraph) {
      if (/\s/.test(char.ch)) {
        if (word.length > 0) words.push(word);
        word = [];
      } else {
        word.push(char);
      }
    }
    if (word.length > 0) words.push(word);

    if (words.length === 0) {
      lines.push([]);
      continue;
    }

    let current: StyledChar[] = [];
    for (const next of words) {
      if (current.length > 0) {
        // The joining space inherits the style of the character before it.
        const space: StyledChar = { ...current[current.length - 1], ch: ' ' };
        const candidate = [...current, space, ...next];
        if (measureChars(candidate, metrics) <= maxWidthPt) {
          current = candidate;
          continue;
        }
        lines.push(current);
        current = [];
      }

      // `next` now starts a fresh line; break it up if it does not fit alone.
      const chunks = splitWord(next, maxWidthPt, metrics);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1];
    }
    if (current.length > 0) lines.push(current);
  }

  return lines.length > 0 ? lines : [[]];
}

function splitWord(
  word: StyledChar[],
  maxWidthPt: number,
  metrics: FontMetrics,
): StyledChar[][] {
  const chunks: StyledChar[][] = [];
  let current: StyledChar[] = [];

  for (const char of word) {
    const candidate = [...current, char];
    if (current.length > 0 && measureChars(candidate, metrics) > maxWidthPt) {
      chunks.push(current);
      current = [char];
    } else {
      current = candidate;
    }
  }

  chunks.push(current);
  return chunks;
}

export interface LabelBox {
  widthPt: number;
  heightPt: number;
  paddingPt: number;
}

/**
 * Wraps, stacks and aligns the label text inside its box.
 *
 * Each line is tall enough for its own biggest glyph and sits on a baseline
 * shared by everything on it, so a word raised to 40pt pushes its line apart
 * without disturbing the lines around it.
 */
export function layOutLabelText(
  runs: readonly StyledRun[],
  box: LabelBox,
  align: { horizontal: HorizontalAlign; vertical: VerticalAlign },
  base: { sizePt: number; bold: boolean },
  metrics: FontMetrics,
): TextLayout {
  const innerWidth = Math.max(1, box.widthPt - box.paddingPt * 2);
  const innerHeight = Math.max(1, box.heightPt - box.paddingPt * 2);

  const lines = wrapStyledText(runs, innerWidth, metrics).map((chars) => {
    const fragments = toFragments(chars, metrics);
    // An empty line still takes up room - the height of the base style.
    const ascent =
      fragments.length === 0
        ? metrics.ascent(base.sizePt, base.bold)
        : Math.max(...fragments.map((f) => metrics.ascent(f.sizePt, f.bold)));
    const descent =
      fragments.length === 0
        ? metrics.descent(base.sizePt, base.bold)
        : Math.max(...fragments.map((f) => metrics.descent(f.sizePt, f.bold)));

    return {
      fragments,
      width: totalWidth(fragments),
      ascent,
      height: ascent + descent,
    };
  });

  const blockHeight = lines.reduce((sum, line) => sum + line.height, 0);
  const blockWidth = Math.max(...lines.map((line) => line.width));

  let top: number;
  switch (align.vertical) {
    case 'top':
      top = box.paddingPt;
      break;
    case 'bottom':
      top = box.heightPt - box.paddingPt - blockHeight;
      break;
    default:
      top = box.paddingPt + (innerHeight - blockHeight) / 2;
  }

  const placed: PlacedFragment[] = [];
  let cursorY = top;

  for (const line of lines) {
    let x: number;
    switch (align.horizontal) {
      case 'left':
        x = box.paddingPt;
        break;
      case 'right':
        x = box.paddingPt + innerWidth - line.width;
        break;
      default:
        x = box.paddingPt + (innerWidth - line.width) / 2;
    }

    const baseline = cursorY + line.ascent;
    for (const fragment of line.fragments) {
      if (fragment.text.trim() !== '') {
        placed.push({ ...fragment, x, baseline });
      }
      x += fragment.width;
    }
    cursorY += line.height;
  }

  return {
    fragments: placed,
    width: blockWidth,
    height: blockHeight,
    // A hair of tolerance: rounding in the measurers should not raise a warning.
    overflows: blockHeight > innerHeight + 0.01 || blockWidth > innerWidth + 0.01,
  };
}
