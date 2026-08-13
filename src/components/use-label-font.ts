'use client';

import { useEffect, useState } from 'react';

import { fontFaceId, type FontId } from '@/lib/fonts';

/** Size the font is measured at; metrics scale linearly from here. */
const REFERENCE_SIZE = 100;

export interface FontMetrics {
  /** CSS font-family name registered for this face. */
  family: string;
  ready: boolean;
  /** Ascent and descent as a fraction of the font size. */
  ascentRatio: number;
  descentRatio: number;
  /** Width of `text` at `size`, in the same units as `size`. */
  measure: (text: string, size: number) => number;
}

const loaded = new Set<string>();

// One offscreen context for every measurement; creating a canvas per call would
// allocate thousands of them while dragging a size slider.
let sharedContext: CanvasRenderingContext2D | null | undefined;

function measuringContext(): CanvasRenderingContext2D | null {
  if (sharedContext === undefined) {
    sharedContext = document.createElement('canvas').getContext('2d');
  }
  return sharedContext;
}

/**
 * Loads the same TTF the PDF is built from and exposes a measuring function, so
 * the preview wraps and aligns text exactly like the renderer does.
 */
export function useLabelFont(fontId: FontId, bold: boolean): FontMetrics {
  const faceId = fontFaceId(fontId, bold);
  const family = `lg-${faceId}`;
  const [ready, setReady] = useState(() => loaded.has(faceId));

  useEffect(() => {
    let cancelled = false;

    if (loaded.has(faceId)) {
      setReady(true);
      return;
    }

    setReady(false);
    const face = new FontFace(family, `url(/api/fonts/${faceId})`);
    face
      .load()
      .then((result) => {
        document.fonts.add(result);
        loaded.add(faceId);
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // Leave `ready` false: the preview then draws with a system font and is
        // approximate, which is better than drawing nothing.
      });

    return () => {
      cancelled = true;
    };
  }, [faceId, family]);

  const [metrics, setMetrics] = useState({
    ascentRatio: 0.8,
    descentRatio: 0.2,
  });

  useEffect(() => {
    if (!ready) return;
    const context = measuringContext();
    if (!context) return;

    context.font = `${bold ? 'bold ' : ''}${REFERENCE_SIZE}px "${family}"`;
    const sample = context.measureText('Hg');
    const ascent =
      sample.fontBoundingBoxAscent ?? sample.actualBoundingBoxAscent ?? 80;
    const descent =
      sample.fontBoundingBoxDescent ?? sample.actualBoundingBoxDescent ?? 20;

    setMetrics({
      ascentRatio: ascent / REFERENCE_SIZE,
      descentRatio: descent / REFERENCE_SIZE,
    });
  }, [ready, family, bold]);

  const measure = (text: string, size: number) => {
    if (typeof document === 'undefined' || text === '') return 0;
    const context = measuringContext();
    if (!context) return 0;
    context.font = `${bold ? 'bold ' : ''}${REFERENCE_SIZE}px "${family}"`;
    return (context.measureText(text).width / REFERENCE_SIZE) * size;
  };

  return { family, ready, ...metrics, measure };
}
