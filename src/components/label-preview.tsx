'use client';

import { useEffect, useMemo, useState } from 'react';

import { SegmentedControl } from '@/components/ui/segmented-control';
import { Tag } from '@/components/ui/tag';
import { useLabelFont } from '@/components/use-label-font';
import { TEXT_PADDING_MM, toStyledRuns, type LabelSpec } from '@/lib/label-spec';
import { layOutLabelText, planGrid } from '@/lib/pdf/layout';
import { A4, cmToPt, mmToPt } from '@/lib/pdf/units';

/** Longest side of the preview box, in CSS pixels. */
const PREVIEW_MAX = 260;

/**
 * Draws a single label or a full page at true proportions by running the very same layout code
 * the PDF renderer uses, over the very same TTFs. It is a preview, not a proof:
 * printers vary, which is what the calibration sheet is for.
 */
export function LabelPreview({ spec }: { spec: LabelSpec }) {
  const font = useLabelFont(spec.fontId);
  const [mode, setMode] = useState<'single' | 'page'>('single');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const widthPt = cmToPt(spec.widthCm);
  const heightPt = cmToPt(spec.heightCm);
  
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

  const cellsToRender = useMemo(() => {
    return spec.maxLabels !== undefined
      ? grid.cells.slice(0, spec.maxLabels)
      : grid.cells;
  }, [grid.cells, spec.maxLabels]);

  const renderLabel = (xOffset: number, yOffset: number) => {
    return (
      <g transform={`translate(${xOffset}, ${yOffset})`}>
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

        {mounted && layout.fragments.map((fragment, index) => (
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
      </g>
    );
  };

  const isSingle = mode === 'single';
  const scale = isSingle
    ? Math.min(PREVIEW_MAX / widthPt, PREVIEW_MAX / heightPt, 3)
    : Math.min(PREVIEW_MAX / A4.widthPt, PREVIEW_MAX / A4.heightPt, 3);

  const svgWidth = isSingle ? widthPt * scale : A4.widthPt * scale;
  const svgHeight = isSingle ? heightPt * scale : A4.heightPt * scale;
  const viewBox = isSingle ? `0 0 ${widthPt} ${heightPt}` : `0 0 ${A4.widthPt} ${A4.heightPt}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between">
        <SegmentedControl
          options={[
            { value: 'single', label: 'Label' },
            { value: 'page', label: 'Page' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      
      <div
        className="flex w-full items-center justify-center rounded-md border border-separator-secondary bg-surface p-4"
        style={{ minHeight: PREVIEW_MAX + 32 }}
      >
        <svg
          role="img"
          aria-label={`Preview of the label "${spec.text}"`}
          width={svgWidth}
          height={svgHeight}
          viewBox={viewBox}
          className={!isSingle ? 'bg-white shadow-sm ring-1 ring-black/5' : ''}
        >
          {isSingle ? (
            renderLabel(0, 0)
          ) : (
            cellsToRender.map((cell, index) => (
              // planGrid works in PDF space, whose origin is the bottom-left;
              // SVG's y grows downward, so each cell is flipped about the page.
              <g key={index}>
                {renderLabel(cell.x, A4.heightPt - cell.y - heightPt)}
              </g>
            ))
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Tag icon="lucide:ruler">
          {spec.widthCm} x {spec.heightCm} cm
        </Tag>
        {grid.count > 0 ? (
          <Tag variant="success" icon="lucide:grid-3x3">
            {cellsToRender.length} per A4 page ({grid.columns} x {grid.rows})
          </Tag>
        ) : (
          <Tag variant="error" icon="lucide:triangle-alert">
            Does not fit on A4
          </Tag>
        )}
        {mounted && layout.overflows ? (
          <Tag variant="error" icon="lucide:triangle-alert">
            Text overflows the label
          </Tag>
        ) : null}
      </div>
    </div>
  );
}
