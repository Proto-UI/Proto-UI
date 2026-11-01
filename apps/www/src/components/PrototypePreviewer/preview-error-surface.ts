/**
 * Canonical markers and detection for the preview error surface.
 *
 * Three renderers report a failed preview:
 *
 * - the generic previewer (`previewer-client.ts`), which additionally marks
 *   the failure kind so a recovery control can be offered for a failed lazy
 *   chunk;
 * - the projected previewer (`projected-previewer-client.ts`);
 * - the bootstrap fallback (`previewer-bootstrap.ts`).
 *
 * The demo matrix and the browser harness recognize a failed preview by
 * reading the rendered host. This module owns that contract so the marker
 * text and the structured attribute have exactly one definition.
 */

/** Marker text every preview error surface renders. */
export const PREVIEW_ERROR_MARKER = '[Preview Error]';

/**
 * Attribute that marks a structured preview error surface and carries the
 * failure kind. `chunk` failures are recoverable by retrying the lazy
 * import; `error` failures are not offered a chunk retry.
 */
export const PREVIEW_RECOVERY_ATTRIBUTE = 'data-preview-recovery';

/** The failure kinds a structured preview error surface distinguishes. */
export type PreviewErrorKind = 'chunk' | 'error';

/**
 * Returns true when the host renders a preview error, whether it is a
 * structured surface or one of the surfaces that only renders the marker
 * text.
 */
export function isPreviewErrorSurface(host: Element | null | undefined): boolean {
  if (!host) return false;
  if (host.querySelector(`[${PREVIEW_RECOVERY_ATTRIBUTE}]`)) return true;
  return host.textContent?.includes(PREVIEW_ERROR_MARKER) === true;
}

/**
 * Returns the failure kind of a structured preview error surface, or null
 * when the host renders an unstructured preview error.
 */
export function previewErrorKind(host: Element | null | undefined): PreviewErrorKind | null {
  const value = host
    ?.querySelector(`[${PREVIEW_RECOVERY_ATTRIBUTE}]`)
    ?.getAttribute(PREVIEW_RECOVERY_ATTRIBUTE);
  return value === 'chunk' || value === 'error' ? value : null;
}
