import { NextResponse } from 'next/server';

import { currentDeviceId, track } from '@/lib/analytics';
import { parseSpec, pdfFileName } from '@/lib/label-spec';
import { getPdfBucket } from '@/lib/mongo';
import { renderLabelSheet } from '@/lib/pdf/render';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Renders the sheet, stores it in GridFS and answers with the id to download.
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
  const bucket = await getPdfBucket();

  const upload = bucket.openUploadStream(fileName, {
    contentType: 'application/pdf',
    metadata: { kind: 'labels', spec, deviceId, createdAt: new Date() },
  });

  await new Promise<void>((resolve, reject) => {
    upload.once('error', reject);
    upload.once('finish', () => resolve());
    upload.end(Buffer.from(result.bytes));
  });

  const fileId = upload.id.toString();

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
