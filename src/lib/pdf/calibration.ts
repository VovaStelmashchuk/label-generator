import 'server-only';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';

import { readFontFile } from './render';
import { A4, cmToPt, mmToPt } from './units';

const BLACK = rgb(0, 0, 0);

export const CALIBRATION_FILE_NAME = 'calibration-10x10cm.pdf';

/**
 * A single 10 x 10 cm square centred on A4, plus tick marks every centimetre.
 * Printed at 100% scale ("Actual size", never "Fit to page") the square must
 * measure exactly 10 cm with a ruler; if it does not, the printer is scaling
 * and every label will come out the wrong size.
 */
export async function renderCalibrationSheet(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle('Printer calibration - 10 x 10 cm');
  pdf.setProducer('label-generator');

  const font = await pdf.embedFont(
    new Uint8Array(await readFontFile('liberation-sans', false)),
    { subset: true },
  );

  const page = pdf.addPage([A4.widthPt, A4.heightPt]);
  const side = cmToPt(10);
  const strokeWidth = mmToPt(0.3);
  const x = (A4.widthPt - side) / 2;
  const y = (A4.heightPt - side) / 2;

  page.drawRectangle({
    x,
    y,
    width: side,
    height: side,
    borderColor: BLACK,
    borderWidth: strokeWidth,
  });

  // Centimetre ticks along the bottom and left edges, pointing inwards.
  const tickLength = mmToPt(3);
  for (let cm = 1; cm < 10; cm += 1) {
    const offset = cmToPt(cm);
    page.drawLine({
      start: { x: x + offset, y },
      end: { x: x + offset, y: y + tickLength },
      thickness: strokeWidth,
      color: BLACK,
    });
    page.drawLine({
      start: { x, y: y + offset },
      end: { x: x + tickLength, y: y + offset },
      thickness: strokeWidth,
      color: BLACK,
    });
  }

  const caption = 'Print at 100% (Actual size). Each side must measure 10 cm.';
  const captionSize = 10;
  page.drawText(caption, {
    x: (A4.widthPt - font.widthOfTextAtSize(caption, captionSize)) / 2,
    y: y - mmToPt(10),
    size: captionSize,
    font,
    color: BLACK,
  });

  const label = '10 cm';
  const labelSize = 9;
  page.drawText(label, {
    x: (A4.widthPt - font.widthOfTextAtSize(label, labelSize)) / 2,
    y: y + side + mmToPt(4),
    size: labelSize,
    font,
    color: BLACK,
  });

  return pdf.save();
}
