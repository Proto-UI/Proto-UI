import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  messageScrollerRoot,
  messageScrollerViewport,
  messageScrollerJump,
} from '../src/message-scroller';

for (const prototype of [messageScrollerRoot, messageScrollerViewport, messageScrollerJump])
  AdaptToWebComponent(prototype, { registerAs: `anchor-${prototype.name}` });

type FrameHarness = {
  runAll: () => void;
};

function installFrameHarness(): FrameHarness {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });
  return {
    runAll() {
      const pending = [...callbacks.entries()];
      callbacks.clear();
      for (const [, callback] of pending) callback(performance.now());
    },
  };
}

type ScrollerFixture = {
  root: HTMLElement;
  viewport: HTMLElement;
  jump: HTMLElement;
  frames: FrameHarness;
  updateMetrics: (patch: { clientHeight?: number; scrollHeight?: number }) => void;
};

async function fixture(): Promise<ScrollerFixture> {
  const frames = installFrameHarness();
  const root = document.createElement('anchor-base-message-scroller-root') as HTMLElement;
  const viewport = document.createElement('anchor-base-message-scroller-viewport') as HTMLElement;
  const jump = document.createElement('anchor-base-message-scroller-jump') as HTMLElement;
  const metrics = { clientHeight: 100, scrollHeight: 400 };
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, get: () => 100 },
    scrollWidth: { configurable: true, get: () => 100 },
    clientHeight: { configurable: true, get: () => metrics.clientHeight },
    scrollHeight: { configurable: true, get: () => metrics.scrollHeight },
    scrollLeft: { configurable: true, value: 0, writable: true },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
  for (let n = 0; n < 3; n++) viewport.append(document.createElement('div'));
  root.append(viewport, jump);
  document.body.append(root);
  await flush();
  frames.runAll();
  window.dispatchEvent(new Event('resize'));
  await flush();
  frames.runAll();
  return {
    root,
    viewport,
    jump,
    frames,
    updateMetrics(patch: { clientHeight?: number; scrollHeight?: number }) {
      Object.assign(metrics, patch);
    },
  };
}

async function flush() {
  for (let n = 0; n < 30; n++) await Promise.resolve();
}

// Waits for a host-observed condition instead of a fixed duration; the
// zero-delay timer pumps pending MutationObserver delivery macrotasks.
async function until(predicate: () => boolean, label: string, pump?: () => void) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${label}`);
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    pump?.();
  }
}

afterEach(async () => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  await flush();
});

describe('base message scroller anchor and announce facts', () => {
  it('pins at end initially, preserves visible position across prepend and resize, then resumes end-follow', async () => {
    const f = await fixture();
    const { viewport, jump } = f;
    expect(viewport.scrollTop).toBe(300);
    expect((viewport as any).getExposes().following.get()).toBe('following');
    expect((viewport as any).getExposes().atEnd.get()).toBe(true);

    // Reader departs the end through host-classified pointer input.
    viewport.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientY: -50 }));
    viewport.scrollTop = 100;
    viewport.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new PointerEvent('pointerup'));
    await flush();
    expect(viewport.scrollTop).toBe(100);
    expect((viewport as any).getExposes().following.get()).toBe('paused');
    expect((viewport as any).getExposes().atEnd.get()).toBe(false);

    // Head growth away from end preserves the anchored visible position.
    const message = document.createElement('div');
    viewport.prepend(message);
    f.updateMetrics({ scrollHeight: 500 });
    await until(() => viewport.scrollTop === 200, 'anchor compensation');
    expect((viewport as any).getExposes().following.get()).toBe('paused');

    // Application-owned announce facts travel through the scroller context.
    setElementProps(f.root, { newContentCount: 1 });
    await flush();
    expect((jump as any).getExposes().newContentCount.get()).toBe(1);

    // Viewport resize does not disturb the non-atEnd reader.
    f.updateMetrics({ clientHeight: 80 });
    window.dispatchEvent(new Event('resize'));
    await flush();
    f.frames.runAll();
    expect(viewport.scrollTop).toBe(200);
    expect((viewport as any).getExposes().atEnd.get()).toBe(false);

    // Returning to the end resumes end-follow for subsequent growth.
    (viewport as any).getExposes().jumpToEnd();
    f.frames.runAll();
    await flush();
    expect(viewport.scrollTop).toBe(420);
    expect((viewport as any).getExposes().following.get()).toBe('following');
    expect((viewport as any).getExposes().requestStatus.get()).toBe('applied');

    const another = document.createElement('div');
    viewport.prepend(another);
    f.updateMetrics({ scrollHeight: 550 });
    await flush();
    f.frames.runAll();
    await until(
      () => viewport.scrollTop === 470,
      'end-follow realignment',
      () => f.frames.runAll()
    );
    expect((viewport as any).getExposes().following.get()).toBe('following');
    viewport.remove();
    f.root.remove();
  });
});
