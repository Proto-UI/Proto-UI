// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import demo from '../../../../apps/www/src/content/docs/demo-shadcn-drawer.demo';
import { createPublicDrawerEntryFixture } from './fixtures/drawer-www-entry';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it.each([false, true])(
  'public Drawer cold entry clicks the sole physical action (fixed control=%s)',
  async (fixedControl) => {
    // Same CSS capability input as the existing real-demo DOM controls. This
    // test proves event targeting and public state, not CSS or native animation.
    vi.stubGlobal('CSS', { supports: () => true });
    const fixture = await createPublicDrawerEntryFixture(fixedControl, demo);
    const root = document.querySelector<
      HTMLElement & {
        getExposes(): { open: { get(): boolean } };
      }
    >('wc-shadcn-drawer-root')!;
    const anchor = document.querySelector<HTMLElement>('wc-shadcn-drawer-trigger')!;
    const action = anchor.querySelector<HTMLElement>('[data-demo-ref="trigger-action"]')!;
    const changes: unknown[] = [];
    const clicks: Array<{
      ref: string | null;
      trusted: boolean | undefined;
      mouse: boolean;
      custom: boolean;
    }> = [];
    const recordClick = (event: Event) => {
      clicks.push({
        ref: (event.target as HTMLElement).getAttribute('data-demo-ref'),
        trusted: event.isTrusted,
        mouse: event instanceof MouseEvent,
        custom: event instanceof CustomEvent,
      });
    };
    const recordChange = (event: Event) => changes.push((event as CustomEvent).detail);
    document.addEventListener('click', recordClick, true);
    root.addEventListener('openChange', recordChange);
    try {
      expect(root.isConnected).toBe(true);
      expect(root.getExposes().open.get()).toBe(false);
      expect(anchor.hasAttribute('role')).toBe(false);
      expect(anchor.tabIndex).toBeLessThan(0);
      await vi.waitFor(() => {
        expect(action.getAttribute('role')).toBe('button');
        expect(action.tabIndex).toBe(0);
        expect(action.matches('[disabled], [aria-disabled="true"]')).toBe(false);
      });

      // Same owner and the same HTMLElement.click mechanism on both sides.
      // C-AS-TRIGGER-0001-J correctly rejects the extra headless anchor box.
      anchor.click();
      for (let index = 0; index < 50; index += 1) await Promise.resolve();
      expect(clicks.map((click) => click.ref)).toEqual(['trigger']);
      // Happy DOM 15 leaves isTrusted unavailable for HTMLElement.click.
      // Keep that raw fact and compare both inputs; only Chromium can prove it.
      const observedTrust = clicks[0]!.trusted;
      expect(changes).toEqual([]);
      expect(root.getExposes().open.get()).toBe(false);
      expect(document.querySelector('wc-shadcn-drawer-root')).toBe(root);

      fixture.open();
      // The Button also publishes its public `click` as a CustomEvent. Keep it
      // separate from the physical MouseEvent rather than counting two inputs.
      expect(clicks.every((click) => click.mouse !== click.custom)).toBe(true);
      expect(clicks.filter((click) => click.custom).map((click) => click.ref)).toEqual([
        'trigger-action',
      ]);
      expect(
        clicks.filter((click) => click.mouse).map(({ ref, trusted }) => ({ ref, trusted }))
      ).toEqual([
        { ref: 'trigger', trusted: observedTrust },
        { ref: 'trigger-action', trusted: observedTrust },
      ]);
      await vi.waitFor(() => expect(root.getExposes().open.get()).toBe(true));
      expect(changes).toMatchObject([{ open: true }]);
      expect(document.querySelector('wc-shadcn-drawer-root')).toBe(root);
      // The public recipe now renders the goal editor inside the same Drawer.
      // Exercise its actual composed callbacks instead of a removed status ref.
      const goal = document.querySelector('[data-demo-ref="goal-value"]')!;
      expect(goal.textContent).toBe('350');
      document.querySelector<HTMLElement>('[data-demo-ref="increase"]')!.click();
      await vi.waitFor(() => expect(goal.textContent).toBe('360'));
      document.querySelector<HTMLElement>('[data-demo-ref="decrease"]')!.click();
      await vi.waitFor(() => expect(goal.textContent).toBe('350'));
      document.querySelector<HTMLElement>('[data-demo-ref="submit"]')!.click();
      await vi.waitFor(() => expect(root.getExposes().open.get()).toBe(false));
      expect(changes).toMatchObject([{ open: true }, { open: false, reason: 'submit' }]);
    } finally {
      document.removeEventListener('click', recordClick, true);
      root.removeEventListener('openChange', recordChange);
      await fixture.dispose();
    }
  }
);
