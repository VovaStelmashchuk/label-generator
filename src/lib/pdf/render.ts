import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { findFont, type FontId } from '../fonts';
import { TEXT_PADDING_MM, type LabelSpec } from '../label-spec';
import { planGrid, wrapText } from './layout';
import { A4, cmToPt, mmToPt } from './units';

/** Labels are always printed in pure black - printers dither anything else. */
const BLACK = rgb(0, 0, 0);

const FONT_DIR = path.join(process.cwd(), 'fonts');
const fontCache = new Map<string, Buffer>();

async function loadFontBytes(fileName: string): Promise<Buffer> {
  const cached = fontCache.get(fileName);
  if (cached) return cached;

  // `fileName` always comes from the FONTS catalogue, never from user input,
  // but resolve-and-check anyway so a future caller cannot escape the directory.
  const resolved = path.join(FONT_DIR, fileName);
  if (path.dirname(resolved) !== FONT_DIR) {
    throw new Error(`Refusing to read font outside ${FONT_DIR}`);
  }

  const bytes = await readFile(resolved);
  fontCache.set(fileName, bytes);
  return bytes;
}

export async function readFontFile(
  fontId: FontId,
  bold: boolean,
): Promise<Buffer> {
  const font = findFont(fontId);
  if (!font) throw new Error(`Unknown font: ${fontId}`);
  return loadFontBytes(bold ? font.files.bold : font.files.regular);
}

/**
 * Draws a rectangle with rounded corners as an explicit path. pdf-lib's
 * `drawRectangle` has no corner radius, and four arcs give exact control over
 * where the stroke sits.
 */
function drawRoundedRect(
  page: PDFPage,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    strokeWidth: number;
  },
) {
  const { x, y, width, height } = options;
  const strokeWidth = options.strokeWidth;
  if (strokeWidth <= 0) return;

  // The stroke straddles the path, so inset by half of it to keep the drawn
  // outline inside the label's declared size.
  const inset = strokeWidth / 2;
  const left = x + inset;
  const bottom = y + inset;
  const innerWidth = width - strokeWidth;
  const innerHeight = height - strokeWidth;
  if (innerWidth <= 0 || innerHeight <= 0) return;

  const right = left + innerWidth;
  const top = bottom + innerHeight;
  const radiusPt = Math.max(
    0,
    Math.min(options.radius, innerWidth / 2, innerHeight / 2),
  );
  // Magic constant for approximating a quarter circle with a cubic Bezier.
  const k = radiusPt * 0.5522847498;

  // drawSvgPath anchors the path at (x, y) with the y axis pointing *down*, so
  // the path is expressed in that flipped space and anchored at the page top.
  const pageTop = page.getHeight();
  const yTop = pageTop - top;
  const yBottom = pageTop - bottom;
  const r = radiusPt;

  const svgPath = [
    `M ${left + r} ${yTop}`,
    `L ${right - r} ${yTop}`,
    `C ${right - r + k} ${yTop} ${right} ${yTop + r - k} ${right} ${yTop + r}`,
    `L ${right} ${yBottom - r}`,
    `C ${right} ${yBottom - r + k} ${right - r + k} ${yBottom} ${right - r} ${yBottom}`,
    `L ${left + r} ${yBottom}`,
    `C ${left + r - k} ${yBottom} ${left} ${yBottom - r + k} ${left} ${yBottom - r}`,
    `L ${left} ${yTop + r}`,
    `C ${left} ${yTop + r - k} ${left + r - k} ${yTop} ${left + r} ${yTop}`,
    'Z',
  ].join(' ');

  page.drawSvgPath(svgPath, {
    x: 0,
    y: pageTop,
    borderColor: BLACK,
    borderWidth: strokeWidth,
    scale: 1,
  });
}

interface TextBlock {
  lines: string[];
  lineHeight: number;
  /** Distance from the top of the text block to the first baseline. */
  firstBaselineOffset: number;
  height: number;
  overflows: boolean;
}

function layOutText(
  spec: LabelSpec,
  font: PDFFont,
  innerWidth: number,
  innerHeight: number,
): TextBlock {
  const size = spec.fontSizePt;
  const measure = (value: string) => font.widthOfTextAtSize(value, size);
  const lines = wrapText(spec.text, innerWidth, measure);

  const lineHeight = font.heightAtSize(size);
  // Height measured without the descender is the distance from the top of the
  // line box down to the baseline.
  const ascender = font.heightAtSize(size, { descender: false });
  const height = lineHeight * lines.length;

  return {
    lines,
    lineHeight,
    firstBaselineOffset: ascender,
    height,
    overflows:
      height > innerHeight ||
      lines.some((line) => measure(line) > innerWidth + 0.01),
  };
}

function drawLabel(
  page: PDFPage,
  spec: LabelSpec,
  font: PDFFont,
  cell: { x: number; y: number },
  size: { width: number; height: number },
) {
  drawRoundedRect(page, {
    x: cell.x,
    y: cell.y,
    width: size.width,
    height: size.height,
    radius: mmToPt(spec.radiusMm),
    strokeWidth: mmToPt(spec.strokeMm),
  });

  if (spec.text.trim() === '') return;

  const padding = mmToPt(TEXT_PADDING_MM) + mmToPt(spec.strokeMm);
  const innerWidth = Math.max(1, size.width - padding * 2);
  const innerHeight = Math.max(1, size.height - padding * 2);
  const block = layOutText(spec, font, innerWidth, innerHeight);

  const innerLeft = cell.x + padding;
  const innerBottom = cell.y + padding;

  let blockTop: number;
  switch (spec.verticalAlign) {
    case 'top':
      blockTop = innerBottom + innerHeight;
      break;
    case 'bottom':
      blockTop = innerBottom + block.height;
      break;
    default:
      blockTop = innerBottom + (innerHeight + block.height) / 2;
  }

  block.lines.forEach((line, index) => {
    if (line === '') return;
    const width = font.widthOfTextAtSize(line, spec.fontSizePt);

    let x: number;
    switch (spec.horizontalAlign) {
      case 'left':
        x = innerLeft;
        break;
      case 'right':
        x = innerLeft + innerWidth - width;
        break;
      default:
        x = innerLeft + (innerWidth - width) / 2;
    }

    const baseline =
      blockTop - block.firstBaselineOffset - index * block.lineHeight;

    page.drawText(line, {
      x,
      y: baseline,
      size: spec.fontSizePt,
      font,
      color: BLACK,
    });
  });
}

export interface RenderResult {
  bytes: Uint8Array;
  labelCount: number;
  columns: number;
  rows: number;
  overflows: boolean;
}

/** Renders one A4 page filled with copies of the same label. */
export async function renderLabelSheet(spec: LabelSpec): Promise<RenderResult> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle('Labels');
  pdf.setProducer('label-generator');

  const fontBytes = await readFontFile(spec.fontId, spec.bold);
  // `subset` keeps only the glyphs actually used, which matters because the
  // bundled fonts carry the full Cyrillic range.
  const font = await pdf.embedFont(new Uint8Array(fontBytes), { subset: true });

  const page = pdf.addPage([A4.widthPt, A4.heightPt]);
  const grid = planGrid(spec.widthCm, spec.heightCm);

  const padding = mmToPt(TEXT_PADDING_MM) + mmToPt(spec.strokeMm);
  const probe = layOutText(
    spec,
    font,
    Math.max(1, cmToPt(spec.widthCm) - padding * 2),
    Math.max(1, cmToPt(spec.heightCm) - padding * 2),
  );

  for (const cell of grid.cells) {
    drawLabel(page, spec, font, cell, {
      width: grid.labelWidthPt,
      height: grid.labelHeightPt,
    });
  }

  return {
    bytes: await pdf.save(),
    labelCount: grid.count,
    columns: grid.columns,
    rows: grid.rows,
    overflows: probe.overflows,
  };
}
