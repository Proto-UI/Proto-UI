import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DemoSpec } from './demo-types';

vi.mock('./registry', () => ({ getPrototype: () => ({}) }));
vi.mock('./wc-registry', () => ({ ensurePreviewWcRegistered: () => 'pui-cleanup-test' }));

import { renderDemo } from './demo-renderer';

const demo = (cleanup: () => void): DemoSpec => ({
  type: 'demo',
  setup: () => cleanup,
  root: {
    kind: 'box',
    children: [
      { kind: 'proto', prototypeId: 'cleanup-test', children: ['First'] },
      { kind: 'proto', prototypeId: 'cleanup-test', children: ['Second'] },
    ],
  },
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Previewer demo renderer cleanup', () => {
  it('disconnects rendered instances after composition cleanup throws', async () => {
    const failure = new Error('composition cleanup failed');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const rendered = await renderDemo({
      runtime: 'wc',
      demo: demo(() => {
        throw failure;
      }),
      host,
    });
    const [first, second] = Array.from(host.querySelectorAll<HTMLElement>('pui-cleanup-test'));
    const firstRemove = vi.spyOn(first!, 'remove');
    const secondRemove = vi.spyOn(second!, 'remove').mockImplementation(() => {
      throw new Error('instance disconnect also failed');
    });

    expect(() => rendered.destroy()).toThrow(failure);
    expect(secondRemove).toHaveBeenCalledTimes(1);
    expect(firstRemove).toHaveBeenCalledTimes(1);
    expect(host.childNodes).toHaveLength(0);
  });
});
