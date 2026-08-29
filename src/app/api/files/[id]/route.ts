import { NextResponse } from 'next/server';

import { track } from '@/lib/analytics';
import { contentDisposition } from '@/lib/content-disposition';
import { FileRecord, fileRepository } from '@/lib/file-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const file: FileRecord | null = await fileRepository.getFileById(id);

  if (!file) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await track('file_downloaded', {
    fileId: id,
    fileName: file.filename,
    contentType: file.content_type
  });

  return new NextResponse(file.data as unknown as BodyInit, {
    headers: {
      'Content-Type': file.content_type,
      'Content-Length': String(file.data.length),
      'Content-Disposition': contentDisposition(file.filename),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
