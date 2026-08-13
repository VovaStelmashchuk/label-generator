import { NextResponse } from 'next/server';

import { ACTIONS, track } from '@/lib/analytics';
import { contentDisposition } from '@/lib/content-disposition';
import {
  CALIBRATION_FILE_NAME,
  renderCalibrationSheet,
} from '@/lib/pdf/calibration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The calibration sheet is identical for everyone, so it is generated on the fly
 * and streamed back rather than stored - there is nothing to keep.
 */
export async function GET() {
  const bytes = await renderCalibrationSheet();

  await track(ACTIONS.calibrationDownloaded, {
    fileName: CALIBRATION_FILE_NAME,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.length),
      'Content-Disposition': contentDisposition(CALIBRATION_FILE_NAME),
      'Cache-Control': 'no-store',
    },
  });
}
