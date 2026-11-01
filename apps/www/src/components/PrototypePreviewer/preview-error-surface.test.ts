import { describe, expect, it } from 'vitest';

import {
  PREVIEW_ERROR_MARKER,
  PREVIEW_RECOVERY_ATTRIBUTE,
  isPreviewErrorSurface,
  previewErrorKind,
} from './preview-error-surface';

function hostWith(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('preview error surface', () => {
  it('recognizes a structured chunk failure surface', () => {
    const host = hostWith(
      `<div ${PREVIEW_RECOVERY_ATTRIBUTE}="chunk"><pre>${PREVIEW_ERROR_MARKER}\nfailed</pre></div>`
    );
    expect(isPreviewErrorSurface(host)).toBe(true);
    expect(previewErrorKind(host)).toBe('chunk');
  });

  it('recognizes a structured generic failure surface', () => {
    const host = hostWith(`<div ${PREVIEW_RECOVERY_ATTRIBUTE}="error"></div>`);
    expect(isPreviewErrorSurface(host)).toBe(true);
    expect(previewErrorKind(host)).toBe('error');
  });

  it('recognizes an unstructured surface that only renders the marker text', () => {
    const host = hostWith(`<pre>${PREVIEW_ERROR_MARKER}\nmount failed</pre>`);
    expect(isPreviewErrorSurface(host)).toBe(true);
    expect(previewErrorKind(host)).toBeNull();
  });

  it('does not classify a healthy host as a preview error', () => {
    const host = hostWith('<div class="host"></div>');
    expect(isPreviewErrorSurface(host)).toBe(false);
    expect(previewErrorKind(host)).toBeNull();
  });

  it('does not classify a missing host as a preview error', () => {
    expect(isPreviewErrorSurface(null)).toBe(false);
    expect(isPreviewErrorSurface(undefined)).toBe(false);
    expect(previewErrorKind(null)).toBeNull();
  });
});
