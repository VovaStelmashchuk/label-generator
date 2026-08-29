import { NextResponse } from 'next/server';

import { currentDeviceId, track } from '@/lib/analytics';
import { parseSpec, pdfFileName } from '@/lib/label-spec';
import { renderLabelSheet } from '@/lib/pdf/render';
import { fileRepository } from '@/lib/file-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Renders the sheet, stores it in Postgres and answers with the id to download.
 *
 * Generation takes a few tens of milliseconds, so it happens inline; the file
 * is persisted so the resulting link keeps working after the response is gone.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const spec = parseSpec(body);
  if (spec.text.trim() === '') {
    return NextResponse.json(
      { error: 'The label text is empty' },
      { status: 400 },
    );
  }

  const result = await renderLabelSheet(spec);
  if (result.labelCount === 0) {
    return NextResponse.json(
      { error: 'A label that size does not fit on an A4 page' },
      { status: 400 },
    );
  }

  const deviceId = await currentDeviceId();
  const fileName = pdfFileName(spec);
  
  const metadata = { kind: 'labels', spec, deviceId, createdAt: new Date() };
  
  const fileId = await fileRepository.saveFile({
    filename: fileName,
    content_type: 'application/pdf',
    metadata,
    data: Buffer.from(result.bytes)
  });

  await track(
    'labels_generated',
    {
      fileId,
      fileName,
      labelCount: result.labelCount,
      columns: result.columns,
      rows: result.rows,
      widthCm: spec.widthCm,
      heightCm: spec.heightCm,
      fontId: spec.fontId,
      bold: spec.bold,
      textLength: spec.text.length,
      spanCount: spec.spans.length,
    },
    deviceId,
  );

  return NextResponse.json({
    fileId,
    fileName,
    downloadUrl: `/api/files/${fileId}`,
    labelCount: result.labelCount,
    columns: result.columns,
    rows: result.rows,
    overflows: result.overflows,
  });
}
