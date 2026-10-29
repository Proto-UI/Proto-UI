import { expect, it, vi } from 'vitest';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
it('mounts all four real Switch trees and retains both controls across scope and Field updates', async () => {
  const errors: unknown[] = [];
  const onError = (e: ErrorEvent) => errors.push(e.error);
  const onReject = (e: PromiseRejectionEvent) => errors.push(e.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onReject);
  const sheet = document.createElement('style');
  sheet.textContent = renderProtoStyleTokenCss(['inline-flex', 'relative'])
    .replace('@layer proto-ui {', '')
    .replace(/}\s*$/, '');
  document.head.append(sheet);
  document.body.innerHTML = '<main></main>';
  const flush = () => new Promise((r) => setTimeout(r, 30));
  try {
    // @ts-expect-error Native fixture is authored JavaScript.
    await import('../../../../scripts/prototypes/shadcn-switch-evidence-app.mjs');
    await flush();
    const app = (window as any).switchEvidence;
    expect(app.records.map((r: any) => r.kind)).toEqual(['wc', 'react', 'vue', 'vue2']);
    const initial = app.records.map((r: any) => r.controls());
    for (const controls of initial) {
      expect(controls).toHaveLength(2);
      expect(controls[0].getAttribute('aria-labelledby')).toBeTruthy();
    }
    // A positive signal control prevents a permanently empty event sink from
    // making later no-change/once-only assertions pass vacuously.
    for (const record of app.records) {
      const before = record.events.length;
      record.controls()[1].click();
      await vi.waitFor(() => {
        expect(record.events).toHaveLength(before + 1);
        expect(record.events.at(-1).checked).toBe(true);
      });
    }
    for (const profile of ['rhea', 'new-york-v4', 'rhea']) {
      app.set({ profile, invalid: true });
      await vi.waitFor(
        () => {
          for (const [i, r] of app.records.entries()) {
            const controls = r.controls();
            expect(controls).toHaveLength(2);
            controls.forEach((c: HTMLElement, j: number) => expect(c).toBe(initial[i][j]));
            expect(controls[0].getAttribute('aria-invalid')).toBe('true');
            expect(controls[1].hasAttribute('aria-invalid')).toBe(false);
            expect(controls[0].hasAttribute('data-pui-static-hit')).toBe(profile === 'rhea');
            expect(controls[1].hasAttribute('data-pui-static-hit')).toBe(profile === 'rhea');
          }
        },
        { timeout: 1000 }
      );
      app.set({ invalid: false });
      await flush();
    }
    expect(errors).toEqual([]);
  } finally {
    (window as any).switchEvidence?.dispose();
    await flush();
    sheet.remove();
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onReject);
    document.body.replaceChildren();
  }
});
