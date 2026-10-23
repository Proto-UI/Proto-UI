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
