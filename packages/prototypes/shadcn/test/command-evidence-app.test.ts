import { expect, it, vi } from 'vitest';
it('mounts the actual four-adapter two-consumer evidence app with shared scope and owned bindings', async () => {
  document.body.innerHTML = '<main></main>';
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => errors.push(event.error);
  window.addEventListener('error', onError);
  try {
    // @ts-expect-error The same native evidence fixture is JavaScript.
    await import('../../../../scripts/prototypes/shadcn-command-evidence-app.mjs');
    const app = (window as any).commandEvidence;
    await vi.waitFor(() => expect(document.documentElement.dataset.ready).toBe('true'));
    expect(app.records.map((r: any) => [r.kind, r.type])).toEqual(
      ['wc', 'react', 'vue', 'vue2'].flatMap((kind) => [
        [kind, 'command'],
        [kind, 'input'],
      ])
    );
    const editors = app.records.map((r: any) => r.editor());
    for (const [style, radius] of [
      ['rhea', 'rounded-[var(--pui-radius-2xl)]'],
      ['new-york-v4', 'rounded-md'],
      ['rhea', 'rounded-[var(--pui-radius-2xl)]'],
    ]) {
      app.set({ style });
      await vi.waitFor(() => {
        for (const [i, record] of app.records.entries()) {
          // Locate the actual shell owner above the editor's own Root, not a
          // transition token that New York Command does not author.
          const control = record.editor().closest('[data-pui-root]');
          const shell = control?.parentElement?.closest('[data-pui-root]');
          expect(shell, `${record.kind}/${record.type}`).not.toBeNull();
          expect(shell?.getAttribute('data-pui-style'), `${record.kind}/${record.type}`).toContain(
            style === 'new-york-v4' && record.type === 'command' ? 'rounded-none' : radius
          );
          expect(record.editor()).toBe(editors[i]);
          expect(record.editor().getAttribute('data-pui-style')).toContain('border-0');
        }
      });
    }
    for (const r of app.records.filter((record: any) => record.type === 'command')) {
      const input = r.editor();
      input.focus();
      input.value = 'Alpha';
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Alpha' })
      );
      await vi.waitFor(() => expect(r.refs.root.getExposes().visibleCount.get(), r.kind).toBe(1));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await vi.waitFor(() => expect(r.executions.at(-1)?.value, r.kind).toBe('alpha'));
      expect(r.executions).toHaveLength(1);
    }
    app.set({ disabled: true });
    await vi.waitFor(() => {
      for (const r of app.records) expect(r.editor().disabled, `${r.kind}/${r.type}`).toBe(true);
    });
    app.set({ disabled: false });
    await vi.waitFor(() => {
      for (const r of app.records) expect(r.editor().disabled, `${r.kind}/${r.type}`).toBe(false);
    });
    expect(errors).toEqual([]);
  } finally {
    (window as any).commandEvidence?.dispose();
    await new Promise((resolve) => setTimeout(resolve, 30));
    window.removeEventListener('error', onError);
    document.body.replaceChildren();
    delete document.documentElement.dataset.ready;
  }
});
