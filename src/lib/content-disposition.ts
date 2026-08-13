/**
 * Builds a Content-Disposition header that survives non-ASCII file names.
 *
 * Label text may be Ukrainian, and the slug derived from it ends up in the file
 * name, so the header carries an ASCII fallback plus an RFC 5987 encoded form.
 */
export function contentDisposition(fileName: string): string {
  const fallback =
    fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'file.pdf';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
