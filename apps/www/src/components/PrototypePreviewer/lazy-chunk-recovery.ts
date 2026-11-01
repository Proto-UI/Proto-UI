/**
 * Detection and explanation for lazy-loaded chunk failures in the website
 * previewer.
 *
 * A documentation page references its preview runtime through a lazily loaded
 * chunk. When `main` advances, the previously published chunk URL can become
 * unavailable (404) or the browser can refuse to evaluate it. The page must
 * then show an explainable recovery path instead of a silent blank surface.
 *
 * Browser engines report the same failure with different messages, so the
 * detection covers the native wording of each engine rather than a single
 * string.
 */

/** Native dynamic-import failure wording, per engine. */
const CHUNK_FAILURE_PATTERNS: readonly RegExp[] = [
  // Chrome / Edge / Chromium: "Failed to fetch dynamically imported module"
  /failed to fetch dynamically imported module/i,
  // Firefox: "error loading dynamically imported module"
  /error loading dynamically imported module/i,
  // Safari: "Importing a module script failed."
  /importing a module script failed/i,
  // Older Safari wording.
  /loading module scripts? failed/i,
  // Generic transport failures.
  /failed to fetch/i,
  /network ?error/i,
  /failed to load resource/i,
  // A published chunk URL that no longer resolves.
  /\b404\b/,
  /not found/i,
];

function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    try {
      return String(err);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Returns true when the failure is a lazy-chunk load failure that the page
 * can offer a retry for, rather than an unrelated preview defect.
 */
export function isLazyChunkFailure(err: unknown): boolean {
  const text = errorText(err);
  if (!text) return false;
  return CHUNK_FAILURE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * The user-facing explanation for a failed lazy chunk load.
 */
export function describeLazyChunkFailure(): string {
  return (
    'The lazy-loaded chunk for this prototype is unavailable. ' +
    'This can happen when the site was updated and the previously published ' +
    'chunk URL is no longer valid. Try retrying, or reload the page.'
  );
}
