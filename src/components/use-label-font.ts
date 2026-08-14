'use client';

import { useEffect, useMemo, useState } from 'react';

import { fontFaceId, type FontId } from '@/lib/fonts';
import type { FontMetrics } from '@/lib/pdf/layout';

/** Size the font is measured at; metrics scale linearly from here. */
const REFERENCE_SIZE = 100;

export interface LabelFont {
  /** CSS font-family names registered for the two weights. */
  family: (bold: boolean) => string;
  ready: boolean;
  metrics: FontMetrics;
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
 * Loads both weights of the same TTF the PDF is built from and exposes them
 * through the layout module's `FontMetrics` interface, so the preview wraps,
 * stacks and aligns text with exactly the code the renderer uses.
 */
export function useLabelFont(fontId: FontId): LabelFont {
  const faces = useMemo(
    () => ({
      regular: fontFaceId(fontId, false),
      bold: fontFaceId(fontId, true),
    }),
    [fontId],
  );

  const family = useMemo(
    () => (bold: boolean) => `lg-${bold ? faces.bold : faces.regular}`,
    [faces],
  );

  const [ready, setReady] = useState(
    () => loaded.has(faces.regular) && loaded.has(faces.bold),
  );

  useEffect(() => {
    let cancelled = false;

    const load = async (faceId: string) => {
      if (loaded.has(faceId)) return;
      const face = new FontFace(`lg-${faceId}`, `url(/api/fonts/${faceId})`);
      document.fonts.add(await face.load());
      loaded.add(faceId);
    };

    setReady(loaded.has(faces.regular) && loaded.has(faces.bold));

    Promise.all([load(faces.regular), load(faces.bold)])
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // Leave `ready` false: the preview then draws with a system font and is
        // approximate, which is better than drawing nothing.
      });

    return () => {
      cancelled = true;
    };
  }, [faces]);

  // Vertical metrics are a property of the face, so they are read once per face
  // rather than on every measurement.
  const [vertical, setVertical] = useState({
    regular: { ascent: 0.8, descent: 0.2 },
    bold: { ascent: 0.8, descent: 0.2 },
  });

  useEffect(() => {
    if (!ready) return;
    const context = measuringContext();
    if (!context) return;

    const read = (bold: boolean) => {
      context.font = `${REFERENCE_SIZE}px "${family(bold)}"`;
      const sample = context.measureText('Hg');
      return {
        ascent:
          (sample.fontBoundingBoxAscent ?? sample.actualBoundingBoxAscent) /
          REFERENCE_SIZE,
        descent:
          (sample.fontBoundingBoxDescent ?? sample.actualBoundingBoxDescent) /
          REFERENCE_SIZE,
      };
    };

    setVertical({ regular: read(false), bold: read(true) });
  }, [ready, family]);

  const metrics = useMemo<FontMetrics>(
    () => ({
      width: (text, sizePt, bold) => {
        if (text === '' || typeof document === 'undefined') return 0;
        const context = measuringContext();
        if (!context) return 0;
        context.font = `${REFERENCE_SIZE}px "${family(bold)}"`;
        return (context.measureText(text).width / REFERENCE_SIZE) * sizePt;
      },
      ascent: (sizePt, bold) =>
        (bold ? vertical.bold : vertical.regular).ascent * sizePt,
      descent: (sizePt, bold) =>
        (bold ? vertical.bold : vertical.regular).descent * sizePt,
    }),
    [family, vertical],
  );

  return { family, ready, metrics };
}
