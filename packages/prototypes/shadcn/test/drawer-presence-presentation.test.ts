import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as drawer from '../src/drawer';

for (const proto of [drawer.drawerRoot, drawer.drawerContent, drawer.drawerMask])
  AdaptToWebComponent(proto);
const roots: HTMLElement[] = [];
const flush = async () => {
  for (let i = 0; i < 35; i++) await Promise.resolve();
};
let now = 0,
  ticket = 0;
const frames = new Map<number, FrameRequestCallback>();
let supported = true;
let preference: 'reduce' | 'no-preference' | 'unknown' = 'no-preference';
beforeEach(() => {
  now = 0;
  frames.clear();
  preference = 'no-preference';
  supported = true;
  vi.stubGlobal('CSS', { ...window.CSS, supports: () => supported });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return query.includes(': ' + preference + ')') && preference !== 'unknown';
        },
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as any
  );
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.set(++ticket, cb);
    return ticket;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
});
afterEach(async () => {
  for (const root of roots.splice(0)) root.remove();
  await flush();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  frames.clear();
});
const frame = async (time: number) => {
  now = time;
  const queued = [...frames.values()];
  frames.clear();
  for (const fn of queued) fn(time);
  await flush();
};
async function fixture(side = 'bottom', open = false, initialDefault = false) {
  const root = document.createElement(drawer.drawerRoot.name) as any;
  const content = document.createElement(drawer.drawerContent.name) as any;
  const mask = document.createElement(drawer.drawerMask.name) as any;
  setElementProps(root, initialDefault ? { defaultOpen: true } : { open });
  setElementProps(content, { side, maxExtent: { unit: 'logical', value: 200 } });
  Object.assign(content.style, { width: '320px', height: '200px', boxSizing: 'border-box' });
  Object.assign(mask.style, { width: '800px', height: '600px', boxSizing: 'border-box' });
  root.append(mask, content);
  roots.push(root);
  document.body.append(root);
  await flush();
  return {
    root,
    content,
    mask,
    target: async (open: boolean) => {
      setElementProps(root, initialDefault ? { defaultOpen: true } : { open });
      await flush();
    },
    phase: () => content.getExposes().transitionState.get(),
    maskPhase: () => mask.getExposes().transitionState.get(),
  };
}

describe('Shadcn Drawer real authored source presentation', () => {
  // Vaul 73d06cdd3fd990bf4b83214cfe240c246908af0d src/index.tsx:107,210,822,908; style.css:80-82.
  // Known upstream parity gap: Base admission arrives after Transition initialization.
  // Expected-failure coverage preserves the desired result without changing lifecycle ownership.
  it.fails(
    'known parity gap: defaultOpen skips initial presentation as pinned Vaul requires',
    async () => {
      const f = await fixture('bottom', true, true);
      expect(f.phase()).toBe('entered');
      expect(f.maskPhase()).toBe('entered');
      expect(f.mask.style.opacity).toBe('');
      expect(f.content.style.getPropertyValue('translate')).not.toContain('200px');
    }
  );
  it.each(['top', 'bottom', 'left', 'right'])(
    'cold %s opens both real parts and retains them through close',
    async (side) => {
      const f = await fixture(side);
      await f.target(true);
      expect(f.phase()).toBe('entering');
      expect(f.maskPhase()).toBe('entering');
      expect(f.mask.style.opacity).toBe('0');
      const start = f.content.style.getPropertyValue('translate');
      expect(start).toContain(
        side === 'top'
          ? '-200px'
          : side === 'bottom'
            ? '200px'
            : side === 'left'
              ? '-320px'
              : '320px'
      );
      await frame(16);
      await frame(266);
      expect(f.phase()).toBe('entering');
      expect(Number(f.mask.style.opacity)).toBeGreaterThan(0);
      expect(Number(f.mask.style.opacity)).toBeLessThan(1);
      expect(f.content.style.getPropertyValue('translate')).not.toBe(start);
      await frame(516);
      expect(f.phase()).toBe('entered');
      expect(f.maskPhase()).toBe('entered');
      await f.target(false);
      expect(f.phase()).toBe('leaving');
      expect(f.maskPhase()).toBe('leaving');
      expect(f.content.hasAttribute('data-pui-view-detached')).toBe(false);
      await frame(532);
      await frame(1032);
      expect(f.phase()).toBe('closed');
      expect(f.maskPhase()).toBe('closed');
    }
  );
  it('controlled refusal starts no leave attempt on either part', async () => {
    const f = await fixture('bottom', true);
    await frame(16);
    await frame(516);
    f.root.getExposes().close('test-refusal');
    await flush();
    expect(f.phase()).toBe('entered');
    expect(f.maskPhase()).toBe('entered');
    expect(f.root.getExposes().open.get()).toBe(true);
  });
  it('reversal retains displayed samples and old callbacks cannot detach reopened parts', async () => {
    const f = await fixture();
    await f.target(true);
    await frame(16);
    await frame(516);
    await f.target(false);
    await frame(532);
    await frame(632);
    const slide = f.content.style.getPropertyValue('translate'),
      opacity = f.mask.style.opacity;
    await f.target(true);
    expect(f.content.style.getPropertyValue('translate')).toBe(slide);
    expect(f.mask.style.opacity).toBe(opacity);
    await frame(648);
    await frame(1148);
    expect(f.phase()).toBe('entered');
    expect(f.maskPhase()).toBe('entered');
    expect(f.content.hasAttribute('data-pui-view-detached')).toBe(false);
  });
  it('accepted side changes retarget motion and preserve an available layout projection', async () => {
    const f = await fixture('bottom');
    await f.target(true);
    await frame(16);
    await frame(116);
    const before = f.content.style.getPropertyValue('translate');
    setElementProps(f.content, { side: 'left', maxExtent: { unit: 'logical', value: 200 } });
    await flush();
    expect(f.phase()).toBe('entering');
    expect(f.content.style.getPropertyValue('translate')).not.toBe('');
    await frame(132);
    await frame(616);
    expect(f.phase()).toBe('entered');
    await f.target(false);
    await frame(632);
    await frame(732);
    expect(f.content.style.getPropertyValue('translate')).toContain('-');
    expect(f.content.style.getPropertyValue('translate')).not.toBe(before);
    await frame(1132);
    expect(f.phase()).toBe('closed');
  });
  it('zero duration overrides settle both real parts without frame waits', async () => {
    const f = await fixture();
    setElementProps(f.content, {
      side: 'bottom',
      enterDuration: 0,
      leaveDuration: 0,
      maxExtent: { unit: 'logical', value: 200 },
    });
    setElementProps(f.mask, { enterDuration: 0, leaveDuration: 0 });
    await flush();
    await f.target(true);
    expect(f.phase()).toBe('entered');
    expect(f.maskPhase()).toBe('entered');
    await f.target(false);
    expect(f.phase()).toBe('closed');
    expect(f.maskPhase()).toBe('closed');
  });
  it('missing translation capability settles Content without waiting for RAF', async () => {
    supported = false;
    const f = await fixture();
    await f.target(true);
    expect(f.phase()).toBe('entered');
    await frame(16);
    await frame(516);
    expect(f.maskPhase()).toBe('entered');
    await f.target(false);
    expect(f.phase()).toBe('closed');
    await frame(532);
    await frame(1032);
    expect(f.maskPhase()).toBe('closed');
  });
  it.each(['reduce', 'unknown'] as const)(
    '%s preference settles through existing completion',
    async (value) => {
      preference = value;
      const f = await fixture();
      await f.target(true);
      expect(f.phase()).toBe('entered');
      expect(f.maskPhase()).toBe('entered');
      await f.target(false);
      expect(f.phase()).toBe('closed');
      expect(f.maskPhase()).toBe('closed');
    }
  );
});
