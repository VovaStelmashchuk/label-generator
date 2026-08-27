import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { findFont, type FontId } from '../fonts';
import {
  TEXT_PADDING_MM,
  toStyledRuns,
  type LabelSpec,
} from '../label-spec';
import {
  layOutLabelText,
  planGrid,
  type FontMetrics,
  type PlacedFragment,
} from './layout';
import { A4, mmToPt } from './units';

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

/**
 * A pair of embedded faces plus the measuring functions the layout module wants.
 * Both faces come from the same family, so a bolded selection keeps its shape.
 */
interface EmbeddedFace {
  regular: PDFFont;
  bold: PDFFont;
  metrics: FontMetrics;
}

function faceMetrics(regular: PDFFont, bold: PDFFont): FontMetrics {
  const pick = (isBold: boolean) => (isBold ? bold : regular);
  return {
    width: (text, sizePt, isBold) =>
      pick(isBold).widthOfTextAtSize(text, sizePt),
    // Height measured without the descender is the distance from the top of the
    // line box down to the baseline.
    ascent: (sizePt, isBold) =>
      pick(isBold).heightAtSize(sizePt, { descender: false }),
    descent: (sizePt, isBold) =>
      pick(isBold).heightAtSize(sizePt) -
      pick(isBold).heightAtSize(sizePt, { descender: false }),
  };
}

function drawLabel(
  page: PDFPage,
  spec: LabelSpec,
  face: EmbeddedFace,
  fragments: readonly PlacedFragment[],
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

  const labelTop = cell.y + size.height;

  for (const fragment of fragments) {
    page.drawText(fragment.text, {
      x: cell.x + fragment.x,
      // Layout works top-down; PDF user space grows upwards. This is the only
      // place the two conventions meet.
      y: labelTop - fragment.baseline,
      size: fragment.sizePt,
      font: fragment.bold ? face.bold : face.regular,
      color: BLACK,
    });
  }
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

  // `subset` keeps only the glyphs actually used, which matters because the
  // bundled fonts carry the full Cyrillic range.
  const embed = async (bold: boolean) =>
    pdf.embedFont(new Uint8Array(await readFontFile(spec.fontId, bold)), {
      subset: true,
    });

  const regular = await embed(false);
  const definition = findFont(spec.fontId);
  // Display faces such as Wallpoet point both weights at one file; embedding it
  // twice would double its bytes in the PDF for no visible difference.
  const bold =
    definition && definition.files.bold === definition.files.regular
      ? regular
      : await embed(true);

  const face: EmbeddedFace = {
    regular,
    bold,
    metrics: faceMetrics(regular, bold),
  };

  const page = pdf.addPage([A4.widthPt, A4.heightPt]);
  const grid = planGrid(spec.widthCm, spec.heightCm);

  const layout = layOutLabelText(
    toStyledRuns(spec),
    {
      widthPt: grid.labelWidthPt,
      heightPt: grid.labelHeightPt,
      paddingPt: mmToPt(TEXT_PADDING_MM) + mmToPt(spec.strokeMm),
    },
    { horizontal: spec.horizontalAlign, vertical: spec.verticalAlign },
    { sizePt: spec.fontSizePt, bold: spec.bold },
    face.metrics,
  );

  // Every label on the sheet is identical, so the text is laid out once and the
  // resulting fragments are stamped into each cell.
  const cellsToRender = spec.maxLabels !== undefined 
    ? grid.cells.slice(0, spec.maxLabels) 
    : grid.cells;

  for (const cell of cellsToRender) {
    drawLabel(page, spec, face, layout.fragments, cell, {
      width: grid.labelWidthPt,
      height: grid.labelHeightPt,
    });
  }

  return {
    bytes: await pdf.save(),
    labelCount: cellsToRender.length,
    columns: grid.columns,
    rows: grid.rows,
    overflows: layout.overflows,
  };
}
