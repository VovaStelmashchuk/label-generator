'use client';

import { useMemo } from 'react';

import { Tag } from '@/components/ui/tag';
import { useLabelFont } from '@/components/use-label-font';
import { TEXT_PADDING_MM, type LabelSpec } from '@/lib/label-spec';
import { planGrid, wrapText } from '@/lib/pdf/layout';
import { cmToPt, mmToPt } from '@/lib/pdf/units';

/** Longest side of the preview box, in CSS pixels. */
const PREVIEW_MAX = 260;

/**
 * Draws a single label at true proportions using the same wrapping, padding and
 * alignment rules as the PDF renderer, with the same TTF loaded into the page.
 * It is a preview, not a proof: printers vary, which is what the calibration
 * sheet is for.
 */
export function LabelPreview({ spec }: { spec: LabelSpec }) {
  const font = useLabelFont(spec.fontId, spec.bold);

  const widthPt = cmToPt(spec.widthCm);
  const heightPt = cmToPt(spec.heightCm);
  const scale = Math.min(PREVIEW_MAX / widthPt, PREVIEW_MAX / heightPt, 3);

  const grid = useMemo(
    () => planGrid(spec.widthCm, spec.heightCm),
    [spec.widthCm, spec.heightCm],
  );

  const layout = useMemo(() => {
    const padding = mmToPt(TEXT_PADDING_MM) + mmToPt(spec.strokeMm);
    const innerWidth = Math.max(1, widthPt - padding * 2);
    const innerHeight = Math.max(1, heightPt - padding * 2);

    const lines = wrapText(spec.text, innerWidth, (value) =>
      font.measure(value, spec.fontSizePt),
    );

    const lineHeight =
      (font.ascentRatio + font.descentRatio) * spec.fontSizePt;
    const blockHeight = lineHeight * lines.length;
    const ascent = font.ascentRatio * spec.fontSizePt;

    let blockTop: number;
    switch (spec.verticalAlign) {
      case 'top':
        blockTop = padding;
        break;
      case 'bottom':
        blockTop = heightPt - padding - blockHeight;
        break;
      default:
        blockTop = padding + (innerHeight - blockHeight) / 2;
    }

    const drawn = lines.map((line, index) => {
      const width = font.measure(line, spec.fontSizePt);
      let x: number;
      switch (spec.horizontalAlign) {
        case 'left':
          x = padding;
          break;
        case 'right':
          x = padding + innerWidth - width;
          break;
        default:
          x = padding + (innerWidth - width) / 2;
      }
      return { line, x, baseline: blockTop + ascent + index * lineHeight };
    });

    const overflows =
      blockHeight > innerHeight ||
      drawn.some((item) => item.x < padding - 0.01);

    return { drawn, overflows };
    // `font.measure` is recreated every render but is pure, so the spec and the
    // loaded-font flag are what actually change the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, widthPt, heightPt, font.ready, font.ascentRatio, font.descentRatio]);

  const strokePt = mmToPt(spec.strokeMm);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex items-center justify-center rounded-xl border border-separator-secondary bg-surface p-4"
        style={{ minHeight: PREVIEW_MAX + 32 }}
      >
        <svg
          role="img"
          aria-label={`Preview of the label "${spec.text}"`}
          width={widthPt * scale}
          height={heightPt * scale}
          viewBox={`0 0 ${widthPt} ${heightPt}`}
        >
          {strokePt > 0 ? (
            <rect
              x={strokePt / 2}
              y={strokePt / 2}
              width={Math.max(0, widthPt - strokePt)}
              height={Math.max(0, heightPt - strokePt)}
              rx={mmToPt(spec.radiusMm)}
              fill="none"
              stroke="black"
              strokeWidth={strokePt}
            />
          ) : null}

          {layout.drawn.map((item, index) => (
            <text
              key={index}
              x={item.x}
              y={item.baseline}
              fill="black"
              fontFamily={`"${font.family}", sans-serif`}
              fontSize={spec.fontSizePt}
              fontWeight={spec.bold ? 700 : 400}
              style={{ whiteSpace: 'pre' }}
            >
              {item.line}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Tag icon="lucide:ruler">
          {spec.widthCm} x {spec.heightCm} cm
        </Tag>
        {grid.count > 0 ? (
          <Tag variant="success" icon="lucide:grid-3x3">
            {grid.count} per A4 page ({grid.columns} x {grid.rows})
          </Tag>
        ) : (
          <Tag variant="error" icon="lucide:triangle-alert">
            Does not fit on A4
          </Tag>
        )}
        {layout.overflows ? (
          <Tag variant="error" icon="lucide:triangle-alert">
            Text overflows the label
          </Tag>
        ) : null}
      </div>
    </div>
  );
}
