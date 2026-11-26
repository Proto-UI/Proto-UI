import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import {
  captureLiquidHoverClips,
  prepareLiquidHoverFrame,
  observeLiquidHoverIdle,
  type LiquidHoverCaptureIO,
  type LiquidHoverFrame,
  type LiquidHoverFramingEvidence,
  type LiquidHoverFramingIO,
  type ScreenshotFrame,
} from './liquid-hover-capture';

const clone = <T>(value: T): T => structuredClone(value);
function frame(): LiquidHoverFrame {
  return {
    subject: { x: 200, y: 200, width: 160, height: 48 },
    viewport: { width: 800, height: 600 },
    scroll: { x: 0, y: 1000 },
    states: {
      hovered: false,
      pressed: false,
      focused: false,
      focusVisible: false,
      disabled: false,
      active: false,
    },
    requests: [],
    material: {
      quality: 'self-optical',
      contact: 'rest',
      carrier: 'contact-v1',
      paintOutset: 30,
    },
  };
}
function geometry(value: ScreenshotFrame): ScreenshotFrame {
  return clone({ subject: value.subject, viewport: value.viewport, scroll: value.scroll });
}
function framing(initial = frame()) {
  let current = clone(initial);
  const calls: string[] = [];
  const moves: Array<{ x: number; y: number }> = [];
  const evidence: LiquidHoverFramingEvidence = { boundary: 'idle', actions: [] };
  const move = ({ x, y }: { x: number; y: number }) => {
    current.scroll.x += x;
    current.scroll.y += y;
    current.subject.x -= x;
    current.subject.y -= y;
  };
  const io: LiquidHoverFramingIO = {
    readFrame: async () => {
      calls.push('read');
      return clone(current);
    },
    scrollIntoView: async () => {
      calls.push('scroll-into-view');
      move({ x: 0, y: current.subject.y - 20 });
    },
    scrollBy: async (delta) => {
      calls.push('scroll-by');
      moves.push(clone(delta));
      move(delta);
    },
    settleFrames: async () => {
      calls.push('settle');
    },
  };
  return {
    io,
    calls,
    moves,
    evidence,
    current: () => current,
    set: (next: LiquidHoverFrame) => (current = next),
  };
}
function capture(initial = frame()) {
  let current = geometry(initial);
  const calls: string[] = [];
  const clips: Array<{ kind: string; clip: unknown }> = [];
  const io: LiquidHoverCaptureIO<Uint8Array> = {
    readGeometry: async () => {
      calls.push('read');
      return clone(current);
    },
    screenshotViewportClip: async (kind, clip) => {
      calls.push(kind);
      clips.push({ kind, clip: clone(clip) });
      return new TextEncoder().encode(kind);
    },
  };
  return {
    io,
    calls,
    clips,
    current: () => current,
    set: (next: ScreenshotFrame) => (current = next),
  };
}

describe('shared idle framing controller (offline IO evidence)', () => {
  it('leaves an eligible fully padded frame untouched', async () => {
    const test = framing();
    const result = await prepareLiquidHoverFrame(test.io, test.evidence);
    expect(test.calls).toEqual(['read']);
    expect(test.evidence.actions).toEqual([]);
    expect(test.evidence.before).toEqual(frame());
    expect(test.evidence.after).toEqual(frame());
    expect(result).toEqual(frame());
  });

  it('uses only the planner delta for an in-view top-edge subject and reads actual post-scroll geometry', async () => {
    const start = frame();
    start.subject.y = 20;
    const test = framing(start);
    const result = await prepareLiquidHoverFrame(test.io, test.evidence);
    expect(test.calls).toEqual(['read', 'scroll-by', 'settle', 'read']);
    expect(test.moves).toEqual([{ x: 0, y: -256 }]);
    expect(test.evidence.actions).toEqual([{ kind: 'scroll-by', delta: { x: 0, y: -256 } }]);
    expect(result.subject.y).toBe(276);
    expect(result.scroll.y).toBe(744);
    expect(test.evidence.before!.subject.y).toBe(20);
    expect(test.evidence.after).toEqual(test.current());
  });

  it('scrolls an offscreen idle root into view, rereads, then frames from the new observation', async () => {
    const start = frame();
    start.subject.y = 1200;
    start.material = { quality: 'opaque-fallback', contact: null, carrier: null, paintOutset: 0 };
    const test = framing(start);
    const original = test.io.scrollIntoView;
    test.io.scrollIntoView = async () => {
      await original();
      // At y=40, the old fallback's margin32 would falsely appear sufficient.
      // The new real receipt requires margin46 and therefore a second scroll.
      test.current().subject.y += 20;
      test.current().scroll.y -= 20;
      test.current().material = clone(frame().material);
    };
    const result = await prepareLiquidHoverFrame(test.io, test.evidence);
    expect(test.calls).toEqual([
      'read',
      'scroll-into-view',
      'settle',
      'read',
      'scroll-by',
      'settle',
      'read',
    ]);
    expect(test.moves).toEqual([{ x: 0, y: -236 }]);
    expect(test.evidence.actions.map(({ kind }) => kind)).toEqual([
      'scroll-into-view',
      'scroll-by',
    ]);
    expect(result.material.quality).toBe('self-optical');
    expect(result.subject.y + result.scroll.y).toBe(2200);
  });

  it.each([
    ['held', 'held', {}],
    ['hover', 'hover', {}],
    ['focus', 'focus', {}],
    ['unknown boundary', 'future-idle', {}],
    ['hovered', 'idle', { hovered: true }],
    ['pressed', 'idle', { pressed: true }],
    ['focused', 'idle', { focused: true }],
    ['focusVisible', 'idle', { focusVisible: true }],
    ['unknown hover', 'idle', { hovered: undefined }],
    ['unknown press', 'idle', { pressed: null }],
    ['unknown focus', 'idle', { focused: undefined }],
    ['unknown focus visibility', 'idle', { focusVisible: null }],
  ])('never scrolls %s even when offscreen', async (_name, boundary, states) => {
    const start = frame();
    start.subject.y = 1200;
    Object.assign(start.states, states);
    const test = framing(start);
    test.evidence.boundary = boundary as string;
    await expect(prepareLiquidHoverFrame(test.io, test.evidence)).rejects.toThrow('verified idle');
    expect(test.calls).toEqual(['read']);
    expect(test.evidence.actions).toEqual([]);
    expect(test.evidence.failure).toContain('verified idle');
  });

  it.each(['held', 'release', undefined, 'unknown'])(
    'rejects unsafe contact %s',
    async (contact) => {
      const start = frame();
      start.subject.y = 20;
      start.material.contact = contact;
      const test = framing(start);
      await expect(prepareLiquidHoverFrame(test.io, test.evidence)).rejects.toThrow(
        'verified idle'
      );
      expect(test.calls).toEqual(['read']);
    }
  );

  it('does not trust an unapplied planned scroll', async () => {
    const start = frame();
    start.subject.y = 20;
    const test = framing(start);
    test.io.scrollBy = async () => {
      test.calls.push('scroll-refused');
    };
    await expect(prepareLiquidHoverFrame(test.io, test.evidence)).rejects.toThrow('still lacks');
    expect(test.calls).toEqual(['read', 'scroll-refused', 'settle', 'read']);
    expect(test.evidence.after!.subject.y).toBe(20);
    expect(test.evidence.failure).toContain('still lacks');
  });

  it.each([
    [
      'Base states',
      (value: LiquidHoverFrame) => {
        value.states.hovered = true;
      },
    ],
    [
      'semantic requests',
      (value: LiquidHoverFrame) => {
        value.requests = [{ kind: 'OpenChange', detail: true }];
      },
    ],
    [
      'document layout',
      (value: LiquidHoverFrame) => {
        value.subject.width += 0.000001;
      },
    ],
    [
      'document layout',
      (value: LiquidHoverFrame) => {
        value.subject.x += 0.000001;
      },
    ],
    [
      'document layout',
      (value: LiquidHoverFrame) => {
        value.viewport.height += 1;
      },
    ],
  ])('retains and rejects post-scroll drift in %s', async (reason, mutate) => {
    const start = frame();
    start.subject.y = 20;
    const test = framing(start);
    const original = test.io.scrollBy;
    test.io.scrollBy = async (delta) => {
      await original(delta);
      mutate(test.current());
    };
    await expect(prepareLiquidHoverFrame(test.io, test.evidence)).rejects.toThrow(reason);
    expect(test.evidence.after).toEqual(test.current());
    expect(test.evidence.before).toEqual(start);
    expect(test.evidence.failure).toContain(reason);
  });

  it('rechecks actual contact after scrollIntoView before any second movement', async () => {
    const start = frame();
    start.subject.y = 1200;
    const test = framing(start);
    const original = test.io.scrollIntoView;
    test.io.scrollIntoView = async () => {
      await original();
      test.current().material.contact = 'held';
    };
    await expect(prepareLiquidHoverFrame(test.io, test.evidence)).rejects.toThrow('verified idle');
    expect(test.evidence.actions).toEqual([{ kind: 'scroll-into-view' }]);
    expect(test.calls).toEqual(['read', 'scroll-into-view', 'settle', 'read']);
  });

  it('keeps the before snapshot independent of an IO returning the same mutable object', async () => {
    const start = frame();
    start.subject.y = 20;
    const test = framing(start);
    test.io.readFrame = async () => test.current();
    await prepareLiquidHoverFrame(test.io, test.evidence);
    expect(test.evidence.before!.subject.y).toBe(20);
    expect(test.evidence.after!.subject.y).toBe(276);
  });

  it('checks the newly observed paint outset after scrollBy rather than accepting the old margin', async () => {
    const start = frame();
    start.subject.y = 20;
    const test = framing(start);
    const original = test.io.scrollBy;
    test.io.scrollBy = async (delta) => {
      await original(delta);
      test.current().material.paintOutset = 300;
    };
    await expect(prepareLiquidHoverFrame(test.io, test.evidence)).rejects.toThrow('still lacks');
    expect(test.evidence.after!.material.paintOutset).toBe(300);
    expect(test.evidence.actions).toHaveLength(1);
  });

  it('preserves a selected Toggle while allowing an otherwise verified idle frame', async () => {
    const start = frame();
    start.states.active = true;
    start.subject.y = 20;
    const test = framing(start);
    const result = await prepareLiquidHoverFrame(test.io, test.evidence);
    expect(result.states.active).toBe(true);
    expect(test.calls).toEqual(['read', 'scroll-by', 'settle', 'read']);
  });
});

describe('idle observation across awaited material readiness (offline IO)', () => {
  function observation() {
    const test = framing();
    let reads = 0;
    let waits = 0;
    const io = {
      ...test.io,
      settleMaterial: async () => {
        waits++;
      },
      observeMaterial: async () => ({
        value: `fresh-material-${++reads}`,
        geometry: clone(test.current().subject),
        paintOutset: test.current().material.paintOutset,
      }),
    };
    return { ...test, io, reads: () => reads, waits: () => waits };
  }
  function lateScroll(test: ReturnType<typeof observation>, delta: number) {
    test.current().scroll.y += delta;
    test.current().subject.y -= delta;
  }

  it('resamples a fully visible no-op setup that scrolls 962px during readiness', async () => {
    const test = observation();
    let once = true;
    test.io.settleMaterial = async () => {
      if (once) {
        once = false;
        lateScroll(test, 962);
      }
    };
    await observeLiquidHoverIdle(test.io, test.evidence);
    const screenshot = capture(test.current());
    const receipt = await captureLiquidHoverClips(screenshot.io, geometry(test.current()), 30);
    expect(receipt.errors).toEqual([]);
    expect(test.evidence.attempts).toHaveLength(2);
    expect(test.evidence.attempts![0].failure).toContain('readiness');
    expect(test.evidence.attempts![0].ready!.subject.y).toBe(-762);
    expect(test.evidence.attempts![1].accepted).toBe(true);
    expect(test.current().subject.y + test.current().scroll.y).toBe(1200);
    expect(test.current().requests).toEqual([]);
  });

  it('takes a fresh material observation after movement during snapshot decoding', async () => {
    const test = observation();
    const observe = test.io.observeMaterial;
    let once = true;
    test.io.observeMaterial = async () => {
      const snapshot = await observe();
      if (once) {
        once = false;
        lateScroll(test, 962);
      }
      return snapshot;
    };
    expect(await observeLiquidHoverIdle(test.io, test.evidence)).toBe('fresh-material-2');
    expect(test.evidence.attempts).toHaveLength(2);
    expect(test.evidence.attempts![0].failure).toContain('observation');
    expect(test.evidence.attempts![0].materialGeometry!.y).toBe(200);
    expect(test.evidence.attempts![0].observed!.subject.y).toBe(-762);
  });

  it('fails after four unstable attempts instead of accepting a moving idle subject', async () => {
    const test = observation();
    test.io.settleMaterial = async () => {
      lateScroll(test, 1);
    };
    await expect(observeLiquidHoverIdle(test.io, test.evidence)).rejects.toThrow('four attempts');
    expect(test.evidence.attempts).toHaveLength(4);
    expect(test.evidence.attempts!.every((attempt) => !attempt.accepted && attempt.failure)).toBe(
      true
    );
    expect(test.moves).toEqual([]);
  });

  it.each([
    ['hovered', true],
    ['pressed', true],
    ['focused', true],
    ['focusVisible', true],
  ])('rejects readiness-time %s activation before any corrective scroll', async (state, value) => {
    const test = observation();
    test.io.settleMaterial = async () => {
      lateScroll(test, 962);
      test.current().states[state] = value;
    };
    await expect(observeLiquidHoverIdle(test.io, test.evidence)).rejects.toThrow('Base states');
    expect(test.moves).toEqual([]);
    expect(test.calls).not.toContain('scroll-into-view');
  });

  it.each(['requests', 'document layout', 'viewport'])(
    'rejects readiness-time %s mutation',
    async (kind) => {
      const test = observation();
      test.io.settleMaterial = async () => {
        if (kind === 'requests') test.current().requests = ['unexpected-commit'];
        else if (kind === 'viewport') test.current().viewport.width += 1;
        else test.current().subject.y += 1;
      };
      await expect(observeLiquidHoverIdle(test.io, test.evidence)).rejects.toThrow(
        kind === 'requests' ? 'semantic requests' : 'document layout'
      );
      expect(test.moves).toEqual([]);
    }
  );

  it('keeps a stable eligible capture to one new material observation', async () => {
    const test = observation();
    expect(await observeLiquidHoverIdle(test.io, test.evidence)).toBe('fresh-material-1');
    expect(test.reads()).toBe(1);
    expect(test.waits()).toBe(1);
    expect(test.evidence.attempts).toHaveLength(1);
    expect(test.evidence.attempts![0].accepted).toBe(true);
    expect(test.evidence.actions).toEqual([]);
  });

  it.each(['reenabled-item', 'reenabled-owner'])(
    'waits for the initial receipt to recover at %s within the existing deadline',
    async (boundary) => {
      const test = observation();
      test.evidence.boundary = boundary;
      const current = test.current();
      const restored = { ...current.material };
      current.states.disabled = false;
      current.material = {
        ...restored,
        quality: 'opaque-fallback',
        contact: 'held',
        carrier: null,
      };
      let clock = 0;
      const budgets: number[] = [];
      const io = {
        ...test.io,
        now: () => clock,
        settleMaterial: async (budget: number) => {
          expect(test.moves).toEqual([]);
          budgets.push(budget);
          clock += 2500;
          current.material = { ...restored };
        },
      };
      expect(await observeLiquidHoverIdle(io, test.evidence)).toBe('fresh-material-1');
      expect(budgets).toEqual([8000, 5500]);
      expect(test.evidence.attempts![0].reads[0].material.contact).toBe('held');
      expect(test.evidence.attempts![0].reads[1].material.contact).toBe('rest');
      expect(test.moves).toEqual([]);
    }
  );

  it('shares the existing eight-second readiness budget across repeated attempts', async () => {
    const test = observation();
    let clock = 0;
    const budgets: number[] = [];
    const io = {
      ...test.io,
      now: () => clock,
      settleMaterial: async (budget: number) => {
        budgets.push(budget);
        clock += 5000;
        lateScroll(test, 1);
      },
    };
    await expect(observeLiquidHoverIdle(io, test.evidence)).rejects.toThrow('8000ms');
    expect(budgets).toEqual([8000, 3000]);
    expect(test.evidence.attempts).toHaveLength(2);
    expect(test.evidence.attempts!.every((attempt) => !attempt.accepted)).toBe(true);
  });

  it('does not accept a material observation that completes after the readiness budget', async () => {
    const test = observation();
    let clock = 0;
    const io = {
      ...test.io,
      now: () => clock,
      observeMaterial: async () => {
        clock = 8001;
        return test.io.observeMaterial();
      },
    };
    await expect(observeLiquidHoverIdle(io, test.evidence)).rejects.toThrow('8000ms');
    expect(test.evidence.attempts![0].accepted).toBe(false);
  });

  it('preserves every rejected actual frame and refuses a newly held contact before moving', async () => {
    const test = observation();
    test.io.settleMaterial = async () => {
      lateScroll(test, 962);
      test.current().material.contact = 'held';
    };
    await expect(observeLiquidHoverIdle(test.io, test.evidence)).rejects.toThrow();
    expect(test.evidence.attempts![0].reads.at(-1)!.material.contact).toBe('held');
    expect(test.evidence.attempts![0].reads.at(-1)!.subject.y).toBe(-762);
    expect(test.calls).not.toContain('scroll-into-view');
  });

  it('retains readiness errors without starting a corrective scroll or material retry', async () => {
    const test = observation();
    test.io.settleMaterial = async () => {
      throw new Error('original readiness timeout');
    };
    await expect(observeLiquidHoverIdle(test.io, test.evidence)).rejects.toThrow(
      'original readiness timeout'
    );
    expect(test.evidence.attempts).toHaveLength(1);
    expect(test.reads()).toBe(0);
    expect(test.calls).not.toContain('scroll-into-view');
  });

  it('requires the new observed material outset instead of trusting the setup margin', async () => {
    const test = observation();
    test.current().subject.y = 40;
    test.current().material.paintOutset = 0;
    const observe = test.io.observeMaterial;
    let once = true;
    test.io.observeMaterial = async () => {
      if (once) {
        once = false;
        test.current().material.paintOutset = 30;
      }
      return observe();
    };
    expect(await observeLiquidHoverIdle(test.io, test.evidence)).toBe('fresh-material-2');
    expect(test.evidence.attempts![0].failure).toContain('additional screenshot context');
    expect(test.evidence.attempts![0].materialPaintOutset).toBe(30);
    expect(test.evidence.actions).toHaveLength(1);
  });

  it('fails a persistently mismatched material receipt without translating its pixels', async () => {
    const test = observation();
    const observe = test.io.observeMaterial;
    test.io.observeMaterial = async () => {
      const result = await observe();
      result.geometry.y += 1;
      return result;
    };
    await expect(observeLiquidHoverIdle(test.io, test.evidence)).rejects.toThrow('four attempts');
    expect(test.evidence.attempts).toHaveLength(4);
    expect(test.reads()).toBe(4);
    expect(test.evidence.attempts!.every((attempt) => attempt.materialGeometry!.y === 201)).toBe(
      true
    );
    expect(test.evidence.actions).toEqual([]);
  });
});

describe('shared viewport capture controller (offline IO evidence)', () => {
  it('uses integer-enclosed viewport CSS clips at nonzero document scroll', async () => {
    const frozen = frame();
    frozen.subject = { x: 200.25, y: 200.75, width: 160.25, height: 48.5 };
    const test = capture(frozen);
    const result = await captureLiquidHoverClips(test.io, geometry(frozen), 30);
    expect(test.calls).toEqual(['read', 'root', 'read', 'context', 'read']);
    expect(result.root.clip).toEqual({ x: 200, y: 200, width: 161, height: 50 });
    expect(result.context.clip).toEqual({ x: 154, y: 154, width: 253, height: 142 });
    expect(test.clips).toEqual([
      { kind: 'root', clip: result.root.clip },
      { kind: 'context', clip: result.context.clip },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.geometryChecks.map(({ phase }) => phase)).toEqual([
      'before-root',
      'between',
      'after-context',
    ]);
    expect(result.context.geometry!.fullyPadded).toBe(true);
    expect(new TextDecoder().decode(result.root.bytes)).toBe('root');
    expect(new TextDecoder().decode(result.context.bytes)).toBe('context');
  });

  for (const phase of ['before-root', 'between', 'after-context'] as const)
    for (const field of ['subject', 'viewport', 'scroll'] as const)
      it(`rejects exact ${field} drift at ${phase}, while retaining diagnostic crops`, async () => {
        const frozen = geometry(frame());
        const test = capture();
        const index = ['before-root', 'between', 'after-context'].indexOf(phase);
        let reads = 0;
        test.io.readGeometry = async () => {
          const observed = clone(frozen);
          if (reads++ === index) {
            if (field === 'viewport') observed.viewport.width += 0.000001;
            else observed[field].x += 0.000001;
          }
          return observed;
        };
        const result = await captureLiquidHoverClips(test.io, frozen, 30);
        expect(result.errors).toEqual([`${phase}: frozen ${field} geometry changed`]);
        expect(result.geometryChecks[index].errors).toEqual(result.errors);
        expect(result.root.bytes).toBeDefined();
        expect(result.context.bytes).toBeDefined();
        expect(result.frozenFrame).toEqual(frozen);
      });

  it('detects hidden scrolling during root capture and retains original clip geometry', async () => {
    const frozen = frame();
    const test = capture(frozen);
    const screenshot = test.io.screenshotViewportClip;
    test.io.screenshotViewportClip = async (kind, clip) => {
      const bytes = await screenshot(kind, clip);
      if (kind === 'root') {
        test.current().subject.y += 50;
        test.current().scroll.y -= 50;
      }
      return bytes;
    };
    const result = await captureLiquidHoverClips(test.io, geometry(frozen), 30);
    expect(result.errors).toEqual([
      'between: frozen subject geometry changed',
      'between: frozen scroll geometry changed',
      'after-context: frozen subject geometry changed',
      'after-context: frozen scroll geometry changed',
    ]);
    expect(result.context.geometry!.subject.y).toBe(200);
    expect(result.context.clip!.y).toBe(154);
    expect(result.context.bytes).toBeDefined();
  });

  it('detects a context screenshot that returns bytes but silently moves the page', async () => {
    const frozen = frame();
    const test = capture(frozen);
    const screenshot = test.io.screenshotViewportClip;
    test.io.screenshotViewportClip = async (kind, clip) => {
      const bytes = await screenshot(kind, clip);
      if (kind === 'context') {
        test.current().subject.y -= 0.000001;
        test.current().scroll.y += 0.000001;
      }
      return bytes;
    };
    const result = await captureLiquidHoverClips(test.io, geometry(frozen), 30);
    expect(result.errors).toEqual([
      'after-context: frozen subject geometry changed',
      'after-context: frozen scroll geometry changed',
    ]);
    expect(result.root.bytes).toBeDefined();
    expect(result.context.bytes).toBeDefined();
    expect(result.frozenFrame).toEqual(geometry(frozen));
  });

  it('retains both screenshot failures and still checks geometry after each attempt', async () => {
    const test = capture();
    test.io.screenshotViewportClip = async (kind) => {
      test.calls.push(kind);
      throw new Error(`${kind} encoding failed`);
    };
    const result = await captureLiquidHoverClips(test.io, geometry(frame()), 30);
    expect(test.calls).toEqual(['read', 'root', 'read', 'context', 'read']);
    expect(result.errors).toEqual([
      'root screenshot: root encoding failed',
      'context screenshot: context encoding failed',
    ]);
    expect(result.root.errors).toEqual(['root screenshot: root encoding failed']);
    expect(result.context.errors).toEqual(['context screenshot: context encoding failed']);
    expect(result.root.clip).toBeDefined();
    expect(result.context.geometry).toBeDefined();
  });

  it('retains a context PNG when the root screenshot fails', async () => {
    const test = capture();
    const screenshot = test.io.screenshotViewportClip;
    test.io.screenshotViewportClip = async (kind, clip) => {
      if (kind === 'root') throw new Error('root failure');
      return screenshot(kind, clip);
    };
    const result = await captureLiquidHoverClips(test.io, geometry(frame()), 30);
    expect(result.root.bytes).toBeUndefined();
    expect(result.context.bytes).toBeDefined();
    expect(result.errors).toEqual(['root screenshot: root failure']);
  });

  it('retains read failures without suppressing either diagnostic screenshot', async () => {
    const test = capture();
    test.io.readGeometry = async () => {
      throw new Error('geometry unavailable');
    };
    const result = await captureLiquidHoverClips(test.io, geometry(frame()), 30);
    expect(result.errors).toEqual([
      'before-root: geometry unavailable',
      'between: geometry unavailable',
      'after-context: geometry unavailable',
    ]);
    expect(result.root.bytes).toBeDefined();
    expect(result.context.bytes).toBeDefined();
  });

  it('fails an offscreen held subject without access to any scrolling hook', async () => {
    const frozen = frame();
    frozen.subject.y = 1200;
    frozen.states.pressed = true;
    frozen.states.hovered = true;
    frozen.material.contact = 'held';
    const test = capture(frozen);
    const result = await captureLiquidHoverClips(test.io, geometry(frozen), 30);
    expect(test.calls).toEqual(['read', 'read', 'read']);
    expect(test.current()).toEqual(geometry(frozen));
    expect(result.root.errors).toEqual(['Root subject is outside the viewport']);
    expect(result.context.errors).toEqual(['Screenshot context is outside the viewport']);
    expect(result.root.bytes).toBeUndefined();
    expect(result.context.bytes).toBeUndefined();
  });

  it('retains an intersecting diagnostic context when a partial root is out of view', async () => {
    const frozen = frame();
    frozen.subject.y = -10;
    const test = capture(frozen);
    const result = await captureLiquidHoverClips(test.io, geometry(frozen), 30);
    expect(test.calls).toEqual(['read', 'read', 'context', 'read']);
    expect(result.root.errors).toEqual(['Root subject is outside the viewport']);
    expect(result.context.geometry!.fullyPadded).toBe(false);
    expect(result.context.bytes).toBeDefined();
    expect(result.context.errors).toEqual([
      'Native context crop lacks required surrounding pixels',
    ]);
  });

  it('retains the unchanged context-padding gate for a visible root near an edge', async () => {
    const frozen = frame();
    frozen.subject.y = 20;
    const test = capture(frozen);
    const result = await captureLiquidHoverClips(test.io, geometry(frozen), 30);
    expect(result.root.errors).toEqual([]);
    expect(result.root.bytes).toBeDefined();
    expect(result.context.bytes).toBeDefined();
    expect(result.context.geometry!.margin).toBe(46);
    expect(result.context.geometry!.fullyPadded).toBe(false);
    expect(result.errors).toEqual(['Native context crop lacks required surrounding pixels']);
  });

  it('retains invalid root geometry as failure rather than inventing a crop', async () => {
    const frozen = frame();
    frozen.subject.width = Number.NaN;
    const test = capture(frozen);
    const result = await captureLiquidHoverClips(test.io, geometry(frozen), 30);
    expect(test.clips).toEqual([]);
    expect(result.root.errors).toEqual(['Invalid screenshot frame geometry']);
    expect(result.context.errors).toEqual(['Invalid screenshot context geometry']);
    expect(result.errors).toHaveLength(5);
  });

  it('keeps independent crop attempts after a preceding framing failure', async () => {
    const start = frame();
    start.subject.y = 20;
    const setup = framing(start);
    setup.io.scrollBy = async () => {
      throw new Error('framing scroll failed');
    };
    await expect(prepareLiquidHoverFrame(setup.io, setup.evidence)).rejects.toThrow(
      'framing scroll failed'
    );
    const test = capture(setup.current());
    const result = await captureLiquidHoverClips(test.io, geometry(setup.current()), 30);
    expect(setup.evidence.failure).toBe('framing scroll failed');
    expect(result.root.bytes).toBeDefined();
    expect(result.context.bytes).toBeDefined();
    expect(result.errors).toEqual(['Native context crop lacks required surrounding pixels']);
    expect(test.current()).toEqual(geometry(start));
  });
});

// Execute the actual native read boundary without importing browser hooks or
// launching a browser. The fake host only supplies DOM / fixture observations.
function nativeIdleReader() {
  const source = readFileSync(
    'apps/www/src/content/docs/zh-cn/demo-liquid-glass-hover.browser.test.ts',
    'utf8'
  );
  const start = source.indexOf('async function readIdleFrame(');
  const end = source.indexOf('async function observeIdleFrame(', start);
  if (start < 0 || end <= start) throw new Error('Missing native idle read function');
  const code = transformSync(source.slice(start, end), { loader: 'ts', target: 'es2022' }).code;
  const current = frame();
  const names = [...Object.keys(current.states), 'collapseBlocked'];
  const calls: string[] = [];
  let reads = 0;
  let duringDecode = () => {};
  const marker = () => {};
  const environment = {
    observeLiquidToggleSnapshot: marker,
    observedStateNames: names,
    observedStates: async () => clone(current.states),
    fixture: async () => clone(current.requests),
    get innerWidth() {
      return current.viewport.width;
    },
    get innerHeight() {
      return current.viewport.height;
    },
    get scrollX() {
      return current.scroll.x;
    },
    get scrollY() {
      return current.scroll.y;
    },
    window: {
      liquidHoverFixture: {
        state: (_runtime: string, _part: string, name: string) => current.states[name],
        requests: () => current.requests,
      },
    },
  };
  const read = runInNewContext(`${code}\nreadIdleFrame`, environment, { timeout: 1000 }) as (
    page: unknown,
    target: unknown,
    runtime: string,
    part: string
  ) => Promise<LiquidHoverFrame>;
  const element = {
    getBoundingClientRect: () => {
      calls.push('geometry');
      return clone(current.subject);
    },
    getAttribute: (name: string) =>
      ({
        'data-material-quality': current.material.quality,
        'data-material-contact': current.material.contact,
        'data-pui-material-carrier': current.material.carrier,
      })[name] ?? null,
  };
  const target = {
    evaluate: async (fn: unknown, arg?: unknown) => {
      if (fn === marker) {
        calls.push('decode');
        const receipt = {
          quality: current.material.quality,
          receipt: { contact: current.material.contact },
          carrier: { marker: current.material.carrier },
          paint: { paintOutset: current.material.paintOutset },
        };
        await Promise.resolve();
        reads++;
        duringDecode();
        return receipt;
      }
      return (fn as (el: unknown, arg: unknown) => unknown)(element, arg);
    },
  };
  return {
    current,
    calls,
    read: () => read({}, target, 'vue', 'reset'),
    mutateDuringDecode: (change: () => void) => {
      duringDecode = change;
    },
    reads: () => reads,
  };
}

describe('native idle frame read boundary', () => {
  it('reads actual geometry after the awaited material decode', async () => {
    const test = nativeIdleReader();
    test.mutateDuringDecode(() => {
      test.current.subject.y -= 962;
      test.current.scroll.y += 962;
    });
    const actual = await test.read();
    expect(actual.subject.y).toBe(-762);
    expect(actual.scroll.y).toBe(1962);
    expect(test.calls).toEqual(['decode', 'geometry']);
  });

  it.each(['hovered', 'pressed', 'focused', 'focusVisible'])(
    'pairs fresh %s state with post-decode geometry',
    async (state) => {
      const test = nativeIdleReader();
      test.mutateDuringDecode(() => {
        test.current.subject.y -= 962;
        test.current.scroll.y += 962;
        test.current.states[state] = true;
      });
      const actual = await test.read();
      expect(actual.subject.y).toBe(-762);
      expect(actual.states[state]).toBe(true);
    }
  );

  it('uses current DOM material eligibility instead of a pre-decode rest receipt', async () => {
    const test = nativeIdleReader();
    test.mutateDuringDecode(() => {
      test.current.material.quality = 'opaque-fallback';
      test.current.material.contact = 'held';
      test.current.material.carrier = null;
      test.current.requests = [{ kind: 'press' }];
    });
    const actual = await test.read();
    expect(actual.material).toEqual(test.current.material);
    expect(actual.requests).toEqual([{ kind: 'press' }]);
  });

  it('repeats the complete real read / observation sequence after final-read decode movement', async () => {
    const test = nativeIdleReader();
    test.mutateDuringDecode(() => {
      if (test.reads() !== 3) return;
      test.current.subject.y -= 962;
      test.current.scroll.y += 962;
    });
    const evidence: LiquidHoverFramingEvidence = { boundary: 'reenabled-owner', actions: [] };
    let observations = 0;
    const result = await observeLiquidHoverIdle(
      {
        readFrame: test.read,
        scrollIntoView: async () => {
          const delta = test.current.subject.y - 200;
          test.current.subject.y -= delta;
          test.current.scroll.y += delta;
        },
        scrollBy: async ({ x, y }) => {
          test.current.subject.x -= x;
          test.current.scroll.x += x;
          test.current.subject.y -= y;
          test.current.scroll.y += y;
        },
        settleFrames: async () => {},
        settleMaterial: async () => {},
        observeMaterial: async () => ({
          value: ++observations,
          geometry: clone(test.current.subject),
          paintOutset: 30,
        }),
      },
      evidence
    );
    expect(result).toBe(2);
    expect(evidence.attempts).toHaveLength(2);
    expect(evidence.attempts!.map(({ accepted }) => accepted)).toEqual([false, true]);
    expect(evidence.attempts![0].failure).toBe('Idle geometry moved during material observation');
    expect(evidence.actions).toEqual([{ kind: 'scroll-into-view' }]);
    expect(evidence.after!.subject.y).toBe(200);
  });
});
