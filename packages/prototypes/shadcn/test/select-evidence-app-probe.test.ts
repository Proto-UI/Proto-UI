import { expect, it, vi } from 'vitest';
// @ts-expect-error Existing adapter-local JavaScript runtime, shared with the browser fixture.
import { act } from '../../../adapters/react/node_modules/react';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
it('mounts the actual four-framework Select evidence app with shared Field ownership', async () => {
  document.body.innerHTML = '<main></main>';
  await act(async () => {
    // @ts-expect-error The same native browser fixture is deliberately JavaScript.
    await import('../../../../scripts/prototypes/shadcn-select-evidence-app.mjs');
  });
  const app = (window as any).selectEvidence;
  try {
    await vi.waitFor(() => expect(document.querySelectorAll('[role=combobox]')).toHaveLength(4));
    for (const record of app.records) {
      const trigger = record.trigger();
      expect(trigger.getAttribute('aria-labelledby')).toBeTruthy();
      expect(trigger.textContent?.trim(), record.kind).toBe('alpha');
      expect(trigger.getAttribute('data-pui-style')).toContain('rounded-[var(--pui-radius-2xl)]');
    }
    await act(async () => app.set('new-york-v4', true));
    await vi.waitFor(() => {
      for (const record of app.records) {
        expect(record.trigger().getAttribute('aria-invalid')).toBe('true');
        expect(record.trigger().getAttribute('data-pui-style')).toContain('rounded-md');
      }
    });
    await act(async () => app.set('rhea', false));
    await vi.waitFor(() => {
      for (const record of app.records) {
        expect(record.trigger().getAttribute('aria-invalid'), record.kind).not.toBe('true');
        expect(record.trigger().getAttribute('data-pui-style')).toContain(
          'rounded-[var(--pui-radius-2xl)]'
        );
      }
    });
    for (const record of [...app.records].sort((a, b) =>
      a.kind === 'wc' ? 1 : b.kind === 'wc' ? -1 : 0
    )) {
      await act(async () => record.trigger().focus());
      await vi.waitFor(() =>
        expect(record.trigger().hasAttribute('data-focused'), record.kind).toBe(true)
      );
      await act(async () =>
        record
          .trigger()
          .dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
          )
      );
      await vi.waitFor(() =>
        expect(record.trigger().getAttribute('aria-expanded'), record.kind).toBe('true')
      );
      let leaf: Element, surface: Element;
      await vi.waitFor(() => {
        const popup = document.getElementById(record.trigger().getAttribute('aria-controls')!);
        leaf = popup?.querySelector('[data-pui-owned-decoration]')!;
        expect(leaf, record.kind).toBeTruthy();
        expect(leaf.getAttribute('data-pui-style'), record.kind).toContain('backdrop-filter-');
        surface = leaf.parentElement!;
      });
      const triggerBefore = record.trigger();
      const focusedBefore = document.activeElement;
      const popupBefore = document.getElementById(triggerBefore.getAttribute('aria-controls')!)!;
      const optionsBefore = [...popupBefore.querySelectorAll('[role=option]')];
      expect(focusedBefore, record.kind).not.toBe(document.body);
      expect(optionsBefore.length, record.kind).toBe(3);
      for (const profile of ['new-york', 'rhea', 'inherit']) {
        await act(async () => record.setSurfaceStyle(profile));
        await vi.waitFor(() => {
          expect(surface.getAttribute('data-pui-style'), record.kind).toContain(
            profile === 'new-york' ? 'rounded-md' : 'bg-popover/70'
          );
          expect(surface.querySelector('[data-pui-owned-decoration]'), record.kind).toBe(leaf);
          expect(record.trigger(), record.kind).toBe(triggerBefore);
          expect(record.trigger().textContent?.trim(), record.kind).toBe('alpha');
          expect(document.activeElement, record.kind).toBe(focusedBefore);
          const options = [...popupBefore.querySelectorAll('[role=option]')];
          expect(options.length, record.kind).toBe(optionsBefore.length);
          options.forEach((option, index) =>
            expect(option, record.kind).toBe(optionsBefore[index])
          );
        });
      }
      await act(async () => record.set('new-york-v4', true));
      await vi.waitFor(() => {
        expect(record.trigger().getAttribute('aria-invalid'), record.kind).toBe('true');
        expect(record.trigger().getAttribute('data-pui-style'), record.kind).toContain(
          'rounded-md'
        );
      });
      await vi.waitFor(() => {
        expect(surface.querySelector('[data-pui-owned-decoration]'), record.kind).toBe(leaf);
        expect(leaf.getAttribute('data-pui-style') ?? '', record.kind).not.toContain(
          'backdrop-filter-'
        );
        expect(record.trigger(), record.kind).toBe(triggerBefore);
        expect(document.activeElement, record.kind).toBe(focusedBefore);
      });
      await act(async () => record.trigger().focus());
      await vi.waitFor(() =>
        expect(record.trigger().hasAttribute('data-focused'), record.kind).toBe(true)
      );
      await act(async () =>
        record
          .trigger()
          .dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
          )
      );
      await vi.waitFor(() =>
        expect(record.trigger().getAttribute('aria-expanded'), record.kind).toBe('false')
      );
    }
  } finally {
    await act(async () => app?.dispose());
    document.body.replaceChildren();
    vi.restoreAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
  }
});
