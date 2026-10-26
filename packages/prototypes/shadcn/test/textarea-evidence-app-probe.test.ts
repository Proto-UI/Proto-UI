import { expect, it, vi } from 'vitest';
it('mounts the actual four-framework capture app in one logical-owner factory per tree', async () => {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => errors.push(event.error);
  const onReject = (event: PromiseRejectionEvent) => errors.push(event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onReject);
  document.body.innerHTML = '<main></main>';
  const flush = () => new Promise((resolve) => setTimeout(resolve, 30));
  try {
    // @ts-expect-error The native browser fixture is deliberately JavaScript.
    await import('../../../../scripts/prototypes/shadcn-textarea-evidence-app.mjs');
    await flush();
    const app = (window as any).textareaEvidence;
    expect(app.records.map((record: any) => record.kind)).toEqual(['wc', 'react', 'vue', 'vue2']);
    const editors = app.records.map((record: any) => record.editor());
    expect(editors.every(Boolean)).toBe(true);
    for (const editor of editors) {
      expect(editor.getAttribute('data-pui-style')).toContain('rounded-[var(--pui-radius-2xl)]');
      expect(editor.getAttribute('aria-labelledby')).toBeTruthy();
    }
    app.set('new-york', true);
    await vi.waitFor(
      () =>
        expect(
          app.records.map((r: any) => [r.kind, r.editor()?.getAttribute('aria-invalid')])
        ).toEqual(['wc', 'react', 'vue', 'vue2'].map((kind) => [kind, 'true'])),
      { timeout: 1000 }
    );
    for (const [index, record] of app.records.entries()) {
      expect(record.editor()).toBe(editors[index]);
      expect(record.editor().getAttribute('aria-invalid'), record.kind).toBe('true');
      expect(record.editor().getAttribute('data-pui-style')).toContain('rounded-md');
    }
    app.set('rhea', false);
    await vi.waitFor(
      () =>
        expect(
          app.records.map((r: any) => [r.kind, r.editor()?.getAttribute('aria-invalid')])
        ).toEqual(['wc', 'react', 'vue', 'vue2'].map((kind) => [kind, 'false'])),
      { timeout: 1000 }
    );
    for (const [index, record] of app.records.entries()) {
      expect(record.editor()).toBe(editors[index]);
      expect(record.editor().getAttribute('aria-invalid')).toBe('false');
    }
    expect(errors).toEqual([]);
  } finally {
    (window as any).textareaEvidence?.dispose();
    await flush();
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onReject);
    document.body.replaceChildren();
  }
});

it('compares ring paint using the same CSS property and rejects wrong color or geometry', async () => {
  const { containsExpectedRingShadow } =
    // @ts-expect-error Native capture helpers intentionally use JavaScript.
    await import('../../../../scripts/prototypes/shadcn-textarea-shadow-oracle.mjs');
  const colorProperty = 'oklab(0.715469 0.0000326335 0.0000143051 / 0.3)';
  const expectedShadow = 'oklab(0.715469 0.0000326336 0.0000143052 / 0.3) 0px 0px 0px 3px';
  const actual = `rgb(255, 255, 255) 0px 0px 0px 0px, ${expectedShadow}, rgba(0, 0, 0, 0) 0px 0px 0px 0px`;
  expect(actual.includes(colorProperty)).toBe(false); // Original native failure.
  expect(containsExpectedRingShadow(actual, expectedShadow)).toBe(true);
  expect(containsExpectedRingShadow(actual.replace('/ 0.3)', '/ 0.2)'), expectedShadow)).toBe(
    false
  );
  expect(containsExpectedRingShadow(actual.replace('0.715469', '0.577107'), expectedShadow)).toBe(
    false
  );
  expect(containsExpectedRingShadow(actual.replace('3px', '2px'), expectedShadow)).toBe(false);
  expect(containsExpectedRingShadow('none', expectedShadow)).toBe(false);
  expect(containsExpectedRingShadow(`${expectedShadow} inset`, expectedShadow)).toBe(false);
  expect(containsExpectedRingShadow(`${expectedShadow} 1px`, expectedShadow)).toBe(false);
  expect(containsExpectedRingShadow(`inset ${expectedShadow}`, expectedShadow)).toBe(false);
  expect(containsExpectedRingShadow(`${actual})`, expectedShadow)).toBe(false);
  expect(containsExpectedRingShadow(`(${actual}`, expectedShadow)).toBe(false);
  expect(containsExpectedRingShadow(actual, '')).toBe(false);
  expect(containsExpectedRingShadow('none', 'none')).toBe(false);
});
