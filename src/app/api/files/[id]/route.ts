import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';

import { track } from '@/lib/analytics';
import { contentDisposition } from '@/lib/content-disposition';
import { getPdfBucket } from '@/lib/mongo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Streams a stored PDF straight out of GridFS. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const objectId = new ObjectId(id);
  const bucket = await getPdfBucket();
  const [file] = await bucket.find({ _id: objectId }).limit(1).toArray();

  if (!file) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await track('file_downloaded', {
    fileId: id,
    fileName: file.filename,
    kind: file.metadata?.kind ?? 'unknown',
  });

  const stream = Readable.toWeb(
    bucket.openDownloadStream(objectId),
  ) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    headers: {
      'Content-Type': file.contentType ?? 'application/pdf',
      'Content-Length': String(file.length),
      'Content-Disposition': contentDisposition(file.filename),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
