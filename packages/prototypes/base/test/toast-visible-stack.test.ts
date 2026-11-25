import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { toastRoot, toastViewport } from '../src/toast';
import { styleContains } from '../../test-utils/style';

let sequence = 0;
const mounted: HTMLElement[] = [];
const flush = async () => {
  for (let tick = 0; tick < 8; tick++) await Promise.resolve();
};

async function fixture(count: number, visibleToasts = 3) {
  const prefix = `toast-visible-${++sequence}`;
  const Viewport = AdaptToWebComponent(toastViewport, { registerAs: `${prefix}-viewport` });
  const Root = AdaptToWebComponent(toastRoot, { registerAs: `${prefix}-root` });
  const viewport = new Viewport();
  setElementProps(viewport, { visibleToasts });
  document.body.append(viewport);
  mounted.push(viewport);
  const roots: InstanceType<typeof Root>[] = [];
  for (let index = 0; index < count; index++) {
    const root = new Root();
    setElementProps(root, { duration: 0 });
    viewport.append(root);
    roots.push(root);
    await flush();
  }
  return { viewport, roots };
}

afterEach(() => {
  for (const node of mounted.splice(0)) node.remove();
});

describe('Toast visible stack', () => {
  it('keeps the configured five newest messages visible beyond the original three tiers', async () => {
    const { roots } = await fixture(8, 5);
    expect(roots.map((root) => root.getExposes().stackTier.get())).toEqual([
      'overflow',
      'overflow',
      'overflow',
      'back',
      'back',
      'third',
      'second',
      'front',
    ]);
  });

  it('retains a complete chronological index for twelve messages', async () => {
    const { roots } = await fixture(12);
    expect(roots.map((root) => root.getExposes().stackIndex?.get())).toEqual([
      11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    ]);
    expect(roots.map((root) => root.getExposes().limited?.get())).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('withdraws limited messages from layout and the accessibility tree, then restores the next one', async () => {
    const { roots } = await fixture(4);
    expect(roots[0].getAttribute('aria-hidden')).toBe('true');
    expect(styleContains(roots[0], 'hidden')).toBe(true);
    roots[3].getExposes().close();
    await flush();
    expect(roots[0].getAttribute('aria-hidden')).not.toBe('true');
    expect(styleContains(roots[0], 'hidden')).toBe(false);
    expect(roots.slice(0, 3).map((root) => root.getExposes().stackIndex?.get())).toEqual([2, 1, 0]);
  });

  it('reconciles a changed visible limit without changing creation order', async () => {
    const { roots, viewport } = await fixture(6, 2);
    setElementProps(viewport, { visibleToasts: 5 });
    await flush();
    expect(roots.map((root) => root.getExposes().stackIndex?.get())).toEqual([5, 4, 3, 2, 1, 0]);
    expect(roots.map((root) => root.getExposes().limited?.get())).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    setElementProps(viewport, { visibleToasts: 1 });
    await flush();
    expect(roots.map((root) => root.getExposes().limited?.get())).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});
