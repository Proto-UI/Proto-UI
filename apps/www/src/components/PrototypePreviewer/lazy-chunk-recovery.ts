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
  // Chromium: "Failed to fetch dynamically imported module: <url>"
  // Chromium: "Failed to load dynamically imported module: <url>"
  // Firefox: "error loading dynamically imported module: <url>"
  /dynamically imported module/i,
  // Safari: "Importing a module script failed."
  // Older Safari: "Loading module script failed."
  /(importing|loading) (a )?module scripts? failed/i,
];

/**
 * A published chunk URL that no longer resolves. The status and the asset
 * name can appear in either order, so both have to be present.
 */
function mentionsUnavailableChunk(text: string): boolean {
  return /\b404\b/.test(text) && /\.js\b/.test(text);
}

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
  if (CHUNK_FAILURE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return mentionsUnavailableChunk(text);
}

/**
 * The user-facing explanation for a failed lazy chunk load.
 */
export function describeLazyChunkFailure(): string {
  return (
    'The lazy-loaded chunk for this prototype is unavailable. ' +
    'This can happen when the site was updated and the previously published ' +
    'chunk URL is no longer valid. Reload the page to load the current build.'
  );
}
