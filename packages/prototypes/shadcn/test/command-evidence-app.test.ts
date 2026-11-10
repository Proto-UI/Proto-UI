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
          const { shell, control, input } = record.elements();
          expect(shell, `${record.kind}/${record.type}`).not.toBeNull();
          expect(control.parentElement.closest('[data-pui-root]')).toBe(shell);
          expect(input).toBe(editors[i]);
          expect(shell.getAttribute('data-pui-style'), `${record.kind}/${record.type}`).toContain(
            style === 'new-york-v4' && record.type === 'command' ? 'rounded-none' : radius
          );
          const legacy = record.host.querySelector(
            '[data-pui-style~="transition-[color,box-shadow]"]'
          );
          // A real, ready New York Command is the original selector's
          // negative control. Ordinary Input and Rhea retain its positive.
          expect(legacy, `${record.kind}/${record.type}/${style}`).toBe(
            style === 'new-york-v4' && record.type === 'command' ? null : shell
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
    for (const r of app.records) {
      const { shell, input } = r.elements();
      shell.removeAttribute('data-demo-ref');
      try {
        expect(() => r.elements()).toThrow(`${r.kind}/${r.type}: expected one shell, found 0`);
      } finally {
        shell.setAttribute('data-demo-ref', 'shell');
      }
      const decoy = document.createElement('div');
      decoy.setAttribute('data-demo-ref', 'shell');
      r.host.append(decoy);
      try {
        expect(() => r.elements()).toThrow(`${r.kind}/${r.type}: expected one shell, found 2`);
        shell.removeAttribute('data-demo-ref');
        expect(() => r.elements()).toThrow('shell/control marker is not a Prototype Root');
        decoy.setAttribute('data-pui-root', '');
        expect(() => r.elements()).toThrow('incorrect shell/control ownership');
      } finally {
        decoy.remove();
        shell.setAttribute('data-demo-ref', 'shell');
      }
      const replacement = input.cloneNode(true);
      input.replaceWith(replacement);
      try {
        expect(() => r.elements()).toThrow('replaced physical shell/control/editor');
      } finally {
        replacement.replaceWith(input);
      }
      expect(r.elements().input).toBe(input);
    }
    // Changing only the public instance cannot authorize an old physical
    // target. WC exposes the actual instances directly in this fixture.
    const wc = app.records[0];
    const shellInstance = wc.refs.shell;
    wc.refs.shell = wc.refs.control;
    try {
      expect(() => wc.elements()).toThrow('replaced public shell/control instance');
    } finally {
      wc.refs.shell = shellInstance;
    }
    app.dispose();
    for (const r of app.records)
      expect(() => r.elements()).toThrow(`${r.kind}/${r.type}: retired owner`);
    expect(errors).toEqual([]);
  } finally {
    (window as any).commandEvidence?.dispose();
    await new Promise((resolve) => setTimeout(resolve, 30));
    window.removeEventListener('error', onError);
    document.body.replaceChildren();
    delete document.documentElement.dataset.ready;
  }
// Four adapter runtimes mounting two live consumers each can exceed the 5s
// default when the suite host is loaded; it measures real mounts, not a stub.
}, 30_000);
