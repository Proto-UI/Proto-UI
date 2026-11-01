import { describe, expect, it } from 'vitest';

import { describeLazyChunkFailure, isLazyChunkFailure } from './lazy-chunk-recovery';

describe('lazy chunk failure detection', () => {
  it('recognizes the Chromium dynamic-import failure', () => {
    expect(
      isLazyChunkFailure(
        new TypeError(
          'Failed to fetch dynamically imported module: https://example.test/_astro/demo.a1b2.js'
        )
      )
    ).toBe(true);
  });

  it('recognizes the Firefox dynamic-import failure', () => {
    expect(
      isLazyChunkFailure(
        new TypeError(
          'error loading dynamically imported module: https://example.test/_astro/demo.a1b2.js'
        )
      )
    ).toBe(true);
  });

  it('recognizes the Safari module-script failure', () => {
    expect(isLazyChunkFailure(new Error('Importing a module script failed.'))).toBe(true);
    expect(isLazyChunkFailure(new Error('Loading module script failed.'))).toBe(true);
  });

  it('recognizes a wrapped prototype loader failure', () => {
    expect(
      isLazyChunkFailure(
        new Error(
          '[PrototypePreviewer] 加载原型模块 "demo" 失败: Failed to fetch dynamically imported module: /_astro/demo.a1b2.js'
        )
      )
    ).toBe(true);
  });

  it('recognizes an unavailable published chunk URL', () => {
    expect(isLazyChunkFailure(new Error('GET /_astro/demo.a1b2.js returned 404'))).toBe(true);
    expect(isLazyChunkFailure(new Error('404 for /_astro/demo.a1b2.js'))).toBe(true);
  });

  it('does not classify unrelated preview defects as chunk failures', () => {
    expect(isLazyChunkFailure(new Error('vue2 failed'))).toBe(false);
    expect(isLazyChunkFailure(new Error('missing prototypeId'))).toBe(false);
    expect(isLazyChunkFailure(new Error('mount rejected'))).toBe(false);
    // A runtime failure that merely mentions a missing port must keep its own
    // message instead of being reported as a chunk failure.
    expect(isLazyChunkFailure(new Error('props port not found'))).toBe(false);
    expect(isLazyChunkFailure(new Error('adapter host 404 response'))).toBe(false);
  });

  it('does not classify an empty or unknown failure as a chunk failure', () => {
    expect(isLazyChunkFailure(undefined)).toBe(false);
    expect(isLazyChunkFailure(null)).toBe(false);
    expect(isLazyChunkFailure('')).toBe(false);
  });

  it('explains the failure without claiming a specific cause', () => {
    const message = describeLazyChunkFailure();
    expect(message).toContain('lazy-loaded chunk');
    expect(message).toContain('no longer valid');
  });
});
