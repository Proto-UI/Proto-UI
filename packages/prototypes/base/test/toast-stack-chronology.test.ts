import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { toastRoot, toastViewport, type ToastRootProps } from '../src/toast';

let sequence = 0;
const mounted: HTMLElement[] = [];

async function flush() {
  for (let tick = 0; tick < 6; tick++) await Promise.resolve();
}

async function fixture(controlled: boolean) {
  const prefix = `toast-chronology-${++sequence}`;
  const Viewport = AdaptToWebComponent(toastViewport, { registerAs: `${prefix}-viewport` });
  const Root = AdaptToWebComponent(toastRoot, { registerAs: `${prefix}-root` });
  const viewport = new Viewport();
  document.body.append(viewport);
  mounted.push(viewport);
  const roots: InstanceType<typeof Root>[] = [];
  for (let index = 0; index < 4; index++) {
    const root = new Root();
    setElementProps(root, controlled ? { open: true, duration: 0 } : { duration: 0 });
    viewport.append(root);
    roots.push(root);
    await flush();
  }
  return { roots, tiers: () => roots.map((root) => root.getExposes().stackTier.get()) };
}

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
});

describe('Toast opening chronology', () => {
  it.each([
    ['type', { type: 'success' }],
    ['duration', { duration: 10_000 }],
    ['paused', { paused: true }],
    ['politeness', { politeness: 'assertive' }],
  ] satisfies Array<[string, Partial<ToastRootProps>]>)(
    'keeps an older controlled Toast in place when only %s changes',
    async (_property, patch) => {
      const { roots, tiers } = await fixture(true);
      expect(tiers()).toEqual(['overflow', 'third', 'second', 'front']);

      setElementProps(roots[0], { open: true, duration: 0, ...patch });
      await flush();

      expect(roots.every((root) => root.getExposes().open.get())).toBe(true);
      expect(tiers()).toEqual(['overflow', 'third', 'second', 'front']);
    }
  );

  it('gives a controlled Toast a new position only after it closes and reopens', async () => {
    const { roots, tiers } = await fixture(true);
    expect(tiers()).toEqual(['overflow', 'third', 'second', 'front']);

    setElementProps(roots[0], { open: false, duration: 0 });
    await flush();
    expect(roots[0].getExposes().open.get()).toBe(false);
    expect(tiers().slice(1)).toEqual(['third', 'second', 'front']);

    setElementProps(roots[0], { open: true, duration: 0 });
    await flush();
    expect(tiers()).toEqual(['front', 'overflow', 'third', 'second']);
  });

  it('keeps openToast idempotent while an uncontrolled Toast is already open', async () => {
    const { roots, tiers } = await fixture(false);
    const requests: unknown[] = [];
    roots[0].addEventListener('openChange', (event) =>
      requests.push((event as CustomEvent).detail)
    );

    roots[0].getExposes().openToast();
    await flush();
    expect(tiers()).toEqual(['overflow', 'third', 'second', 'front']);
    expect(requests).toEqual([]);

    roots[0].getExposes().close();
    await flush();
    roots[0].getExposes().openToast();
    await flush();
    expect(tiers()).toEqual(['front', 'overflow', 'third', 'second']);
    expect(requests).toEqual([
      { open: false, reason: 'programmatic' },
      { open: true, reason: 'programmatic' },
    ]);
  });
});
