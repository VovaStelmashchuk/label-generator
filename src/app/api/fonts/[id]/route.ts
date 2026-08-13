import { NextResponse } from 'next/server';

import { parseFontFaceId } from '@/lib/fonts';
import { readFontFile } from '@/lib/pdf/render';

export const runtime = 'nodejs';

/**
 * Serves a bundled TTF to the browser so the live preview can render with the
 * same file the PDF is built from - otherwise the preview would silently fall
 * back to a system font and lie about how the label will look.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const face = parseFontFaceId(id);

  if (!face) {
    return NextResponse.json({ error: 'Unknown font' }, { status: 404 });
  }

  const bytes = await readFontFile(face.font.id, face.bold);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'font/ttf',
      'Content-Length': String(bytes.length),
      // The files are immutable build artefacts; let the browser keep them.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
