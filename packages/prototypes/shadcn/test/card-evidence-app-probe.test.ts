import { expect, it, vi } from 'vitest';
it('shares the actual four-framework Card evidence factory across every part and nested editor', async () => {
  document.body.innerHTML = '<main></main>';
  const errors: unknown[] = [];
  const onError = (e: ErrorEvent) => errors.push(e.error);
  window.addEventListener('error', onError);
  try {
    // @ts-expect-error The native fixture is deliberately JavaScript.
    await import('../../../../scripts/prototypes/shadcn-card-evidence-app.mjs');
    const app = (window as any).cardEvidence;
    await vi.waitFor(() =>
      expect(app.records.map((r: any) => !!r.editor())).toEqual([true, true, true, true])
    );
    const editors = app.records.map((r: any) => r.editor());
    const check = async (rhea: boolean) => {
      await vi.waitFor(() => {
        for (const [index, r] of app.records.entries()) {
          const card = r.host.querySelector('[data-pui-style~="bg-card"]');
          expect(card, r.kind).toBeTruthy();
          expect(card.getAttribute('data-pui-style'), r.kind).toContain(
            rhea ? 'rounded-[min(var(--pui-radius-4xl),24px)]' : 'rounded-xl'
          );
          expect(card.firstElementChild.getAttribute('data-pui-style'), r.kind).toContain(
            rhea ? 'px-5' : 'px-6'
          );
          expect(r.editor(), r.kind).toBe(editors[index]);
          expect(r.editor().getAttribute('data-pui-style'), r.kind).toContain(
            rhea ? 'rounded-[var(--pui-radius-2xl)]' : 'rounded-md'
          );
        }
      });
    };
    await check(true);
    app.set('new-york', undefined);
    await check(false);
    app.set('rhea', undefined, 'default');
    await check(true);
    app.set('rhea', undefined, 'sm');
    await vi.waitFor(() => {
      for (const r of app.records) {
        expect(
          r.host.querySelector('[data-pui-style~="bg-card"]').getAttribute('data-pui-style')
        ).toContain('py-4');
      }
    });
    // Provider and child props are separate updates, not an atomic cross-owner transaction.
    // Restore a density supported by both profiles before changing the outer scope.
    app.set('rhea', undefined, 'default');
    await check(true);
    app.set('new-york', undefined, 'default');
    await check(false);
    app.set('new-york', 'rhea');
    await check(true);
    expect(errors).toEqual([]);
  } finally {
    (window as any).cardEvidence?.dispose?.();
    await new Promise((r) => setTimeout(r, 30));
    window.removeEventListener('error', onError);
    document.body.replaceChildren();
  }
});
