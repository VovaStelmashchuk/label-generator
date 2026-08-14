'use client';

import { useMemo } from 'react';

import { Tag } from '@/components/ui/tag';
import { useLabelFont } from '@/components/use-label-font';
import { TEXT_PADDING_MM, toStyledRuns, type LabelSpec } from '@/lib/label-spec';
import { layOutLabelText, planGrid } from '@/lib/pdf/layout';
import { cmToPt, mmToPt } from '@/lib/pdf/units';

/** Longest side of the preview box, in CSS pixels. */
const PREVIEW_MAX = 260;

/**
 * Draws a single label at true proportions by running the very same layout code
 * the PDF renderer uses, over the very same TTFs. It is a preview, not a proof:
 * printers vary, which is what the calibration sheet is for.
 */
export function LabelPreview({ spec }: { spec: LabelSpec }) {
  const font = useLabelFont(spec.fontId);

  const widthPt = cmToPt(spec.widthCm);
  const heightPt = cmToPt(spec.heightCm);
  const scale = Math.min(PREVIEW_MAX / widthPt, PREVIEW_MAX / heightPt, 3);

  const grid = useMemo(
    () => planGrid(spec.widthCm, spec.heightCm),
    [spec.widthCm, spec.heightCm],
  );

  const layout = useMemo(
    () =>
      layOutLabelText(
        toStyledRuns(spec),
        {
          widthPt,
          heightPt,
          paddingPt: mmToPt(TEXT_PADDING_MM) + mmToPt(spec.strokeMm),
        },
        { horizontal: spec.horizontalAlign, vertical: spec.verticalAlign },
        { sizePt: spec.fontSizePt, bold: spec.bold },
        font.metrics,
      ),
    [spec, widthPt, heightPt, font.metrics],
  );

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

          {layout.fragments.map((fragment, index) => (
            <text
              key={index}
              x={fragment.x}
              y={fragment.baseline}
              fill="black"
              fontFamily={`"${font.family(fragment.bold)}", sans-serif`}
              fontSize={fragment.sizePt}
              style={{ whiteSpace: 'pre' }}
            >
              {fragment.text}
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
