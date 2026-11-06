// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installSizingMotionTrace,
  sizingMotionIssues,
  type SizingMotionTrigger,
} from './demo-select-item-sizing-motion';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});
function fixture() {
  vi.useFakeTimers();
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++next, callback);
    return next;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  document.body.innerHTML =
    '<button aria-controls="content" aria-expanded="false" data-projection-owner="owner" data-projection-runtime="wc"></button><div id="content" data-projection-owner="owner"><div data-projection-owner="owner" data-projection-prototype="shadcn-select-surface"><div data-projection-owner="owner" data-projection-prototype="shadcn-select-viewport">' +
    '<button role="option" data-projection-owner="owner"></button>'.repeat(4) +
    '</div></div></div>';
  const trigger = document.querySelector('button')! as SizingMotionTrigger;
  const content = document.getElementById('content')!;
  const surface = content.firstElementChild as HTMLElement;
  const viewport = surface.firstElementChild as HTMLElement;
  const items = [...viewport.children] as HTMLElement[];
  let scale = 0.95;
  let running = true;
  let pending = false;
  let state = 'running';
  let itemWidth = 224;
  for (const element of [trigger, content, surface, viewport, ...items]) {
    Object.defineProperty(element, 'getAnimations', { configurable: true, value: () => [] });
    element.style.cssText =
      'box-sizing:border-box;width:224px;height:36px;padding:0;border:0;opacity:1;transform:none;visibility:visible';
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
      const width = items.includes(element) ? itemWidth : 224;
      const factor = element === trigger || element === content ? 1 : scale;
      return new DOMRect(0, 0, width * factor, 36 * factor);
    });
  }
  const animation = {
    animationName: 'enter',
    get playState() {
      return state;
    },
    get pending() {
      return pending;
    },
    currentTime: 50,
    effect: { getComputedTiming: () => ({ endTime: 150 }) },
  };
  Object.defineProperty(surface, 'getAnimations', {
    configurable: true,
    value: () => (running ? [animation] : []),
  });
  const update = () => {
    surface.style.transform = `matrix(${scale}, 0, 0, ${scale}, 0, 0)`;
  };
  update();
  installSizingMotionTrace(trigger);
  const frame = () => {
    const callbacks = [...frames];
    frames.clear();
    for (const [, callback] of callbacks) callback(performance.now());
  };
  const open = () => {
    trigger.setAttribute('aria-expanded', 'true');
    items[0].focus();
    frame();
  };
  const settle = () => {
    running = false;
    state = 'finished';
    scale = 1;
    update();
    frame();
    frame();
  };
  return {
    trigger,
    content,
    surface,
    viewport,
    items,
    frames,
    frame,
    open,
    settle,
    done: trigger.__puiSizingMotion!.done,
    scale(value: number) {
      scale = value;
      update();
    },
    finish() {
      running = false;
      state = 'finished';
    },
    cancel() {
      running = false;
      state = 'idle';
    },
    disappear() {
      running = false;
    },
    pause() {
      state = 'paused';
    },
    pending(value: boolean) {
      pending = value;
    },
    itemWidth(value: number) {
      itemWidth = value;
      for (const item of items) item.style.width = `${value}px`;
    },
  };
}
describe('Select sizing animation prerequisite', () => {
  it('retains the early scale95 frame and accepts only actual finished motion plus two frames', async () => {
    const f = fixture();
    f.open();
    expect(f.frames.size).toBe(1);
    f.settle();
    const result = await f.done;
    expect(result.samples.map((s) => s.surface.transform[0])).toEqual([0.95, 1, 1]);
    expect(result.samples[0].items[0].width).toBeCloseTo(212.8);
    expect(result.samples[0].items[0].layoutWidth).toBe(224);
    expect(sizingMotionIssues(result, 'wc')).toEqual([]);
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not accept layout214 simply because a later painted sample reaches224', async () => {
    const f = fixture();
    f.itemWidth(214);
    f.open();
    f.settle();
    expect(sizingMotionIssues(await f.done, 'wc')).toContain('layout mismatch during motion');
  });
  it('rejects a finished animation frozen at scale95 without waiting for geometry to pass', async () => {
    const f = fixture();
    f.open();
    f.finish();
    f.frame();
    f.frame();
    const result = await f.done;
    expect(result.status).toBe('settled');
    expect(sizingMotionIssues(result, 'wc')).toContain('non-unit settled scale');
  });
  it('does not substitute a matching painted frame while animation is still running', async () => {
    const f = fixture();
    f.scale(1);
    f.open();
    f.frame();
    expect(f.frames.size).toBe(1);
    await vi.advanceTimersByTimeAsync(1200);
    const result = await f.done;
    expect(result.status).toBe('deadline');
    expect(sizingMotionIssues(result, 'wc').length).toBeGreaterThan(0);
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('fails a paused animation with a wall-clock deadline even if rAF never resumes', async () => {
    const f = fixture();
    f.pause();
    f.open();
    await vi.advanceTimersByTimeAsync(1200);
    expect((await f.done).status).toBe('deadline');
    expect(f.frames.size).toBe(0);
  });
  it('resets the two-frame prerequisite if an animation restarts', async () => {
    const f = fixture();
    f.open();
    f.finish();
    f.scale(1);
    f.frame();
    // A pending browser animation must invalidate the previous idle frame.
    const restarted = {
      playState: 'finished',
      pending: true,
      currentTime: 0,
      effect: { getComputedTiming: () => ({ endTime: 150 }) },
    };
    Object.defineProperty(f.surface, 'getAnimations', { value: () => [restarted] });
    f.frame();
    expect(f.frames.size).toBe(1);
    restarted.pending = false;
    Object.defineProperty(f.surface, 'getAnimations', { value: () => [] });
    f.frame();
    expect(f.frames.size).toBe(1);
    f.frame();
    expect((await f.done).status).toBe('settled');
  });
  it('handles genuine zero-duration motion without inventing an animation event', async () => {
    const f = fixture();
    f.surface.style.animationName = 'enter';
    f.surface.style.animationDuration = '0s';
    f.finish();
    f.scale(1);
    f.open();
    f.frame();
    expect(sizingMotionIssues(await f.done, 'wc')).toEqual([]);
  });
  it('rejects close then reopen as the original open-cycle trace, not a replacement success', async () => {
    const f = fixture();
    f.open();
    f.trigger.setAttribute('aria-expanded', 'false');
    f.frame();
    f.trigger.setAttribute('aria-expanded', 'true');
    f.settle();
    expect((await f.done).status).toBe('invalid-owner');
  });
  it('rejects a replaced Surface even when its attributes copy the same owner', async () => {
    const f = fixture();
    f.open();
    f.surface.replaceWith(f.surface.cloneNode(true));
    f.frame();
    expect((await f.done).status).toBe('invalid-owner');
  });
  it('rejects a detached Trigger and removes all future work', async () => {
    const f = fixture();
    f.open();
    f.trigger.remove();
    f.frame();
    expect((await f.done).status).toBe('invalid-owner');
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('retains capture failure and cleans both scheduling mechanisms', async () => {
    const f = fixture();
    Object.defineProperty(f.surface, 'getAnimations', {
      value: () => {
        throw new Error('capture failed');
      },
    });
    f.open();
    const result = await f.done;
    expect(result.status).toBe('error');
    expect(result.error).toContain('capture failed');
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('explicit stop preserves samples and cannot be relabeled settled', async () => {
    const f = fixture();
    f.open();
    f.trigger.__puiSizingMotion!.stop();
    const result = await f.done;
    expect(result.status).toBe('stopped');
    expect(result.samples).toHaveLength(1);
    expect(sizingMotionIssues(result, 'wc').length).toBeGreaterThan(0);
  });
  it('frame cancellation failure remains visible while timer cleanup continues', async () => {
    const f = fixture();
    f.open();
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      throw 0;
    });
    f.trigger.__puiSizingMotion!.stop();
    const result = await f.done;
    expect(result.status).toBe('stopped');
    expect(result.error).toContain('cancelAnimationFrame failed: 0');
    expect(result.cleanup).toEqual({ frame: false, timer: true });
    expect(sizingMotionIssues(result, 'wc')).toContain('trace cleanup incomplete');
    expect(f.frames.size).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('timer cancellation failure remains visible while frame cleanup continues', async () => {
    const f = fixture();
    f.open();
    vi.spyOn(window, 'clearTimeout').mockImplementation(() => {
      throw false;
    });
    try {
      f.trigger.__puiSizingMotion!.stop();
      const result = await f.done;
      expect(result.status).toBe('stopped');
      expect(result.error).toContain('clearTimeout failed: false');
      expect(result.cleanup).toEqual({ frame: true, timer: false });
      expect(sizingMotionIssues(result, 'wc')).toContain('trace cleanup incomplete');
      expect(f.frames.size).toBe(0);
      expect(vi.getTimerCount()).toBe(1);
    } finally {
      vi.clearAllTimers();
    }
  });
});

describe('retained animation identity and trajectory falsifiers', () => {
  it('does not call cancellation a completed animation when the browser list becomes empty', async () => {
    const f = fixture();
    f.open();
    f.cancel();
    f.scale(1);
    f.frame();
    f.frame();
    const result = await f.done;
    expect(result.status).toBe('interrupted');
    expect(sizingMotionIssues(result, 'wc').length).toBeGreaterThan(0);
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('retains an observed running object even if the current browser list omits it', async () => {
    const f = fixture();
    f.open();
    f.disappear();
    f.scale(1);
    f.frame();
    f.frame();
    await vi.advanceTimersByTimeAsync(1200);
    expect((await f.done).status).toBe('deadline');
  });
  it('rejects a trace whose retained owner identity changes', async () => {
    const f = fixture();
    f.open();
    f.settle();
    const result = await f.done;
    result.samples[1].owner = 'different-owner';
    expect(sizingMotionIssues(result, 'wc')).toContain('sample identity/time');
  });
  it('rejects a non-finite frame timestamp rather than treating it as ordered', async () => {
    const f = fixture();
    f.open();
    f.settle();
    const result = await f.done;
    result.samples[1].at = NaN;
    expect(sizingMotionIssues(result, 'wc')).toContain('sample identity/time');
  });
});

describe('continuous visible open-cycle prerequisite', () => {
  it('rejects hidden Content between two finished samples instead of joining the samples', async () => {
    const f = fixture();
    f.open();
    f.finish();
    f.scale(1);
    f.frame();
    f.content.style.visibility = 'hidden';
    f.frame();
    f.content.style.visibility = 'visible';
    f.frame();
    expect((await f.done).status).toBe('invalid-owner');
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects disappearing Content between finished samples even if the same node returns', async () => {
    const f = fixture();
    f.open();
    f.finish();
    f.scale(1);
    f.frame();
    f.content.remove();
    f.frame();
    document.body.append(f.content);
    f.items[0].focus();
    f.frame();
    expect((await f.done).status).toBe('invalid-owner');
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('all measured nodes and unobserved entry motion', () => {
  for (const target of ['content', 'viewport'] as const)
    it(`does not settle while ${target} opacity animation is running`, async () => {
      const f = fixture();
      f.finish();
      f.scale(1);
      const animation = {
        playState: 'running',
        pending: false,
        currentTime: 0,
        effect: { getComputedTiming: () => ({ endTime: 150 }) },
      };
      Object.defineProperty(f[target], 'getAnimations', { value: () => [animation] });
      f.open();
      f.frame();
      expect(f.frames.size).toBe(1);
      animation.playState = 'finished';
      f.frame();
      f.frame();
      expect(sizingMotionIssues(await f.done, 'wc')).toEqual([]);
    });
  it('rejects nonzero CSS entry motion that was cancelled before the first sampled frame', async () => {
    const f = fixture();
    f.surface.style.animationName = 'enter';
    f.surface.style.animationDuration = '0.15s';
    f.cancel();
    f.scale(1);
    f.open();
    f.frame();
    const result = await f.done;
    expect(result.status).toBe('missing-animation');
    expect(sizingMotionIssues(result, 'wc').length).toBeGreaterThan(0);
  });
  it('bounds an infinite running animation without pretending it finished', async () => {
    const f = fixture();
    Object.defineProperty(f.surface, 'getAnimations', {
      value: () => [
        {
          playState: 'running',
          pending: false,
          currentTime: 500,
          effect: { getComputedTiming: () => ({ endTime: Infinity }) },
        },
      ],
    });
    f.open();
    f.frame();
    await vi.advanceTimersByTimeAsync(1200);
    const result = await f.done;
    expect(result.status).toBe('deadline');
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

it('accepts a declared nonzero entry only when the matching CSS Animation was observed and finished', async () => {
  const f = fixture();
  f.surface.style.animationName = 'enter';
  f.surface.style.animationDuration = '0.15s';
  f.open();
  f.settle();
  expect(sizingMotionIssues(await f.done, 'wc')).toEqual([]);
});

it('installs from its serialized function without an imported module closure', async () => {
  const f = fixture();
  f.trigger.__puiSizingMotion!.stop();
  const serialized = new Function(
    `return (${installSizingMotionTrace.toString()});`
  )() as typeof installSizingMotionTrace;
  const handle = serialized(f.trigger);
  expect(handle).toBe(f.trigger.__puiSizingMotion);
  const done = handle.done;
  f.open();
  f.settle();
  expect(sizingMotionIssues(await done, 'wc')).toEqual([]);
});

it('rejects a finished unit-scale Surface that remains fully transparent', async () => {
  const f = fixture();
  f.surface.style.opacity = '0';
  f.open();
  f.settle();
  const result = await f.done;
  expect(result.status).toBe('settled');
  expect(sizingMotionIssues(result, 'wc')).toContain('non-unit settled opacity');
});

describe('exact trace handles survive later locator changes', () => {
  it('returns the exact installed handle and stops the previous trace before replacing it', async () => {
    const f = fixture();
    const handle = installSizingMotionTrace(f.trigger);
    expect(handle).toBe(f.trigger.__puiSizingMotion);
    expect((await f.done).status).toBe('stopped');
    f.open();
    f.settle();
    expect(sizingMotionIssues(await handle.done, 'wc')).toEqual([]);
  });

  it('retains the original invalid-owner result when a new Trigger copies the locator attributes', async () => {
    const f = fixture();
    const handle = installSizingMotionTrace(f.trigger);
    f.open();
    const replacement = f.trigger.cloneNode(true) as SizingMotionTrigger;
    f.trigger.replaceWith(replacement);
    expect(replacement.__puiSizingMotion).toBeUndefined();
    f.frame();
    const result = await handle.done;
    expect(result.status).toBe('invalid-owner');
    expect(result.samples).toHaveLength(1);
    expect(result.cleanup).toEqual({ frame: true, timer: true });
    expect(sizingMotionIssues(result, 'wc').length).toBeGreaterThan(0);
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let cleanup through an old handle stop a newer same-node trace', async () => {
    const f = fixture();
    const oldHandle = installSizingMotionTrace(f.trigger);
    f.open();
    const newHandle = installSizingMotionTrace(f.trigger);
    expect((await oldHandle.done).status).toBe('stopped');
    oldHandle.stop();
    expect(f.trigger.__puiSizingMotion).toBe(newHandle);
    f.settle();
    expect(sizingMotionIssues(await newHandle.done, 'wc')).toEqual([]);
    expect(f.frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
