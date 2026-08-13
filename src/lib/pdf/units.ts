/** PDF user space is measured in points: 72 pt to the inch, 25.4 mm to the inch. */
export const PT_PER_MM = 72 / 25.4;
export const PT_PER_CM = PT_PER_MM * 10;

export const mmToPt = (mm: number) => mm * PT_PER_MM;
export const cmToPt = (cm: number) => cm * PT_PER_CM;
export const ptToMm = (pt: number) => pt / PT_PER_MM;

/** A4 in points. Kept exact rather than rounded so 10 cm really is 10 cm. */
export const A4 = {
  widthMm: 210,
  heightMm: 297,
  widthPt: mmToPt(210),
  heightPt: mmToPt(297),
} as const;
