/**
 * Saving a file the API produced.
 *
 * Exports and documents sit behind the bearer token, so a plain `<a href>`
 * can't fetch them — the browser wouldn't send the header. They come
 * through axios as a Blob instead, and this hands the Blob to the browser
 * as a download under the server's own filename.
 */

/** The filename from a `Content-Disposition` header, or `fallback`. */
export function filenameFromDisposition(
  header: string | null | undefined,
  fallback: string,
): string {
  if (!header) return fallback;

  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // Fall through to the plain form.
    }
  }

  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i);
  return plain ? plain[1].trim() : fallback;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: some browsers start the download
  // asynchronously and would find the URL already gone.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
