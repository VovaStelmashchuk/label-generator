/**
 * Page layout maths. Pure functions with no PDF or DOM dependency, so the same
 * numbers drive the generated PDF and the "N labels per page" hint in the form.
 */

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
        y:
          originY +
          blockHeight -
          (row + 1) * labelHeightPt -
          row * gapPt,
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

export interface WrapMeasurer {
  (text: string): number;
}

/**
 * Greedy word wrap. Explicit newlines are honoured first, then each paragraph is
 * broken on spaces to fit `maxWidthPt`. A single word longer than the line is
 * split character by character rather than allowed to overflow.
 */
export function wrapText(
  text: string,
  maxWidthPt: number,
  measure: WrapMeasurer,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      if (current !== '') {
        const candidate = `${current} ${word}`;
        if (measure(candidate) <= maxWidthPt) {
          current = candidate;
          continue;
        }
        lines.push(current);
        current = '';
      }

      // `word` now starts a fresh line. If it does not fit on a line of its own
      // it gets broken across several.
      const chunks = splitLongWord(word, maxWidthPt, measure);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1];
    }
    if (current !== '') lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}

function splitLongWord(
  word: string,
  maxWidthPt: number,
  measure: WrapMeasurer,
): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const char of Array.from(word)) {
    const candidate = current + char;
    if (current !== '' && measure(candidate) > maxWidthPt) {
      chunks.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
