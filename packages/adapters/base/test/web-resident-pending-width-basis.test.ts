import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebResidentMotionSink } from '../src/motion/web-resident-motion';
import { createRootStyleEffect, resolveRootStyleEntry } from '@proto.ui/core/internal';
import type { StyleHandle } from '@proto.ui/core';
import type { ResidentMotionHost } from '../../../modules/feedback/src/motion/projector';

const captured = vi.hoisted(() => ({
  phase: '',
  environments: [] as unknown[],
  presentations: [] as unknown[],
}));
vi.mock('@proto.ui/module-feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@proto.ui/module-feedback')>();
  return {
    ...actual,
    createResidentMotionProjector(host: ResidentMotionHost) {
      return actual.createResidentMotionProjector({
        ...host,
        environment(...args) {
          const value = host.environment(...args);
          captured.environments.push({ phase: captured.phase, args, value });
          return value;
        },
        project(style, presentation, isCurrent) {
          captured.presentations.push({
            phase: captured.phase,
            presentation,
            tokens: style.tokens,
          });
          return host.project(style, presentation, isCurrent);
        },
      });
    },
  };
});

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const off of cleanups.splice(0)) off();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  captured.environments.length = 0;
  captured.presentations.length = 0;
});

function fixture(options?: Parameters<typeof createWebResidentMotionSink>[2]) {
  const parent = document.createElement('div');
  parent.dataset.probeNode = 'parent';
  parent.style.display = 'block';
  const el = document.createElement('div');
  el.dataset.probeNode = 'surface';
  el.style.display = 'block';
  parent.append(el);
  document.body.append(parent);
  const sheet = document.createElement('style');
  sheet.textContent =
    '[data-probe-width="zero"] { width: 0px } [data-probe-width="pixels"] { width: 100px } [data-probe-width="rem"] { width: 32px } [data-probe-width="two-hundred"] { width: 200px } [data-probe-width="four-hundred"] { width: 400px }';
  document.head.append(sheet);
  cleanups.push(() => sheet.remove());
  const oldFont = document.documentElement.style.fontSize;
  document.documentElement.style.fontSize = '16px';
  cleanups.push(() => {
    document.documentElement.style.fontSize = oldFont;
  });
  vi.spyOn(window.CSS, 'supports').mockReturnValue(true);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    Object.assign(new EventTarget(), {
      matches: !query.includes(': reduce'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
    })
  );
  let now = 0,
    nextFrame = 0,
    resizeDeliveries = 0,
    revision = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(window.performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => frames.delete(id));
  const observers: ProbeResizeObserver[] = [];
  class ProbeResizeObserver implements ResizeObserver {
    readonly observed = new Map<Element, ResizeObserverOptions | undefined>();
    readonly operations: { operation: string; target?: Element }[] = [];
    constructor(readonly callback: ResizeObserverCallback) {
      observers.push(this);
    }
    observe(target: Element, options?: ResizeObserverOptions) {
      this.operations.push({ operation: 'observe', target });
      this.observed.set(target, options);
    }
    unobserve(target: Element) {
      this.operations.push({ operation: 'unobserve', target });
      this.observed.delete(target);
    }
    disconnect() {
      this.operations.push({ operation: 'disconnect' });
      this.observed.clear();
    }
    deliver(entries: ResizeObserverEntry[]) {
      resizeDeliveries++;
      this.callback(entries, this);
    }
  }
  const oldResize = window.ResizeObserver;
  window.ResizeObserver = ProbeResizeObserver;
  cleanups.push(() => {
    window.ResizeObserver = oldResize;
  });

  const reads: { phase: string; node: string; property?: string }[] = [];
  const actualComputed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) => {
    const node = (target as HTMLElement).dataset.probeNode ?? target.tagName.toLowerCase();
    reads.push({ phase: captured.phase, node });
    const declaration = actualComputed(target, pseudo);
    return new Proxy(declaration, {
      get(object, property) {
        if (typeof property === 'string') reads.push({ phase: captured.phase, node, property });
        const value = Reflect.get(object, property, object);
        return typeof value === 'function' ? value.bind(object) : value;
      },
    });
  });
  let pending: StyleHandle | undefined;
  let nextFlush: (() => void) | undefined;
  const sink = createWebResidentMotionSink(
    el,
    {
      queueStyle(style) {
        pending = style;
      },
      requestFlush() {
        if (pending) el.setAttribute('data-pui-style', pending.tokens.join(' '));
        const callback = nextFlush;
        nextFlush = undefined;
        callback?.();
      },
    },
    options
  );
  cleanups.push(() => sink.release(1));
  return {
    parent,
    el,
    sink,
    frames,
    observers,
    reads,
    onNextFlush(callback: () => void) {
      nextFlush = callback;
    },
    commit(token: string, numbers?: Readonly<Record<string, number>>) {
      sink.commit({
        view: 1,
        revision: ++revision,
        style: createRootStyleEffect([resolveRootStyleEntry(token, 'rule')]),
        declarations: [{ properties: ['width'], durationMs: 100, easing: [0, 0, 1, 1] }],
        ...(numbers ? { numbers } : {}),
      });
    },
    firstFrame() {
      now = 16;
      for (const [id, callback] of [...frames]) {
        frames.delete(id);
        callback(now);
      }
    },
    facts() {
      return {
        reads,
        environments: [...captured.environments],
        presentations: [...captured.presentations],
        resizeDeliveries,
        resizeObservers: observers.length,
        observed: observers.flatMap((observer) =>
          [...observer.observed].map(([target, options]) => ({
            node: (target as HTMLElement).dataset.probeNode ?? target.tagName.toLowerCase(),
            box: options?.box,
          }))
        ),
        inlineWidth: el.style.width,
        diagnostics: sink.diagnostics?.(),
        remainingFrames: frames.size,
      };
    },
  };
}

function entry(target: Element, value: number): ResizeObserverEntry {
  return {
    target,
    contentBoxSize: [{ inlineSize: value, blockSize: 20 }],
    borderBoxSize: [{ inlineSize: value, blockSize: 20 }],
    devicePixelContentBoxSize: [{ inlineSize: value, blockSize: 20 }],
    contentRect: new DOMRectReadOnly(0, 0, value, 20),
  };
}
function unknownWidth() {
  expect(captured.presentations.at(-1)).toMatchObject({ presentation: {} });
  const latest = captured.presentations.at(-1) as {
    presentation: { width?: number };
  };
  expect(latest.presentation.width).toBeUndefined();
}
function settledWidth(value: number) {
  expect(captured.presentations.at(-1)).toMatchObject({
    presentation: { width: value, widthState: 'settled' },
  });
}
function newParent() {
  const replacement = document.createElement('div');
  replacement.dataset.probeNode = 'replacement';
  replacement.style.display = 'block';
  document.body.append(replacement);
  return replacement;
}

describe('pending percentage basis preserves the width contract', () => {
  it.each([
    { label: 'fraction', token: 'w-1/2' },
    {
      label: 'numeric State',
      token: 'w-[calc(var(--pui-percentage)*1%)]',
      numbers: { percentage: 50 },
    },
  ])(
    '$label stays unresolved across the first RAF without CSS layout classification',
    ({ token, numbers }) => {
      const h = fixture();
      captured.phase = 'commit';
      h.commit(token, numbers);
      unknownWidth();
      expect(h.frames.size).toBe(1);
      captured.phase = 'first RAF';
      h.firstFrame();
      const result = h.facts();
      expect(result.resizeDeliveries).toBe(0);
      expect(result.resizeObservers).toBe(1);
      expect(result.remainingFrames).toBe(0);
      expect(result.inlineWidth).toBe('');
      expect(result.presentations).toEqual([
        { phase: 'commit', presentation: {}, tokens: [token] },
        { phase: 'first RAF', presentation: {}, tokens: [token] },
      ]);
      for (const phase of ['commit', 'first RAF']) {
        const calls = result.reads.filter((read) => read.phase === phase && !read.property);
        expect(calls).toEqual([]);
      }
      expect(h.observers[0].observed.get(h.el)?.box).toBe('border-box');
      expect(h.observers[0].observed.get(h.parent)?.box).toBe('content-box');
      expect(h.el.getAttribute('data-pui-style')).toBe(token);
    }
  );

  it.each([
    { label: 'zero', token: 'w-[0%]', width: 0 },
    { label: 'pixels', token: 'w-[100px]', width: 100 },
    { label: 'rem', token: 'w-[2rem]', width: 32 },
  ])('$label remains immediately resolved without a RO measurement', ({ label, token, width }) => {
    const h = fixture();
    h.el.dataset.probeWidth = label;
    captured.phase = 'commit';
    h.commit(token);
    settledWidth(width);
    expect(h.facts().resizeDeliveries).toBe(0);
    expect(h.sink.diagnostics?.()).toEqual([]);
  });

  it('accepts the first actual current containing-block measurement without another frame', () => {
    const h = fixture();
    h.el.dataset.probeWidth = 'two-hundred';
    h.commit('w-1/2');
    unknownWidth();
    h.observers[0].deliver([entry(h.parent, 400)]);
    settledWidth(200);
    expect(h.sink.diagnostics?.()).toEqual([]);
    expect(h.observers).toHaveLength(1);
    expect([...h.observers[0].observed.keys()]).toEqual([h.el, h.parent]);
  });

  it('never borrows an own box or authored CSS width as the containing-block basis', () => {
    const h = fixture();
    h.el.dataset.probeWidth = 'two-hundred';
    h.commit('w-1/2');
    h.observers[0].deliver([entry(h.el, 400)]);
    unknownWidth();
    expect(h.el.style.width).toBe('');
    h.observers[0].deliver([entry(h.parent, 400)]);
    settledWidth(200);
  });

  it('ignores earlier unrelated ancestor measurements in the same delivery', () => {
    const h = fixture();
    h.el.dataset.probeWidth = 'two-hundred';
    h.commit('w-1/2');
    h.observers[0].deliver([
      entry(document.documentElement, 9000),
      entry(document.body, 8000),
      entry(h.parent, 400),
    ]);
    settledWidth(200);
    expect(h.sink.diagnostics?.()).toEqual([]);
  });

  it('stays pending when a delivery does not contain the actual containing block', () => {
    const h = fixture();
    h.commit('w-1/2');
    h.observers[0].deliver([entry(document.body, 8000)]);
    unknownWidth();
    expect(h.observers[0].observed.has(h.parent)).toBe(true);
  });

  it('keeps pending observations stable across repeated unrelated ancestor deliveries', () => {
    const h = fixture();
    h.commit('w-1/2');
    const observer = h.observers[0];
    const operationsBefore = [...observer.operations];
    const targetsBefore = [...observer.observed.keys()];
    expect(targetsBefore).toEqual([h.el, h.parent, document.body, document.documentElement]);
    for (let index = 0; index < 5; index++) {
      observer.deliver([entry(document.body, 8000 + index), entry(document.documentElement, 9000)]);
      unknownWidth();
      expect(observer.operations).toEqual(operationsBefore);
      expect([...observer.observed.keys()]).toEqual(targetsBefore);
      expect(h.el.style.width).toBe('');
    }
    h.firstFrame();
    expect(observer.operations).toEqual(operationsBefore);
    h.el.dataset.probeWidth = 'two-hundred';
    observer.deliver([entry(h.parent, 400)]);
    settledWidth(200);
    expect(observer.operations.slice(operationsBefore.length)).toEqual([
      { operation: 'unobserve', target: document.body },
      { operation: 'unobserve', target: document.documentElement },
    ]);
    const settledOperations = [...observer.operations];
    observer.deliver([entry(h.parent, 400)]);
    expect(observer.operations).toEqual(settledOperations);
  });

  it('keeps pending observations stable after a current-block entry has no usable size', () => {
    const h = fixture();
    h.commit('w-1/2');
    const observer = h.observers[0];
    const operationsBefore = [...observer.operations];
    for (const width of [NaN, Infinity, -1]) {
      observer.deliver([entry(h.parent, width)]);
      unknownWidth();
      expect(observer.operations).toEqual(operationsBefore);
    }
    h.el.dataset.probeWidth = 'zero';
    observer.deliver([entry(h.parent, 0)]);
    settledWidth(0);
    expect([...observer.observed.keys()]).toEqual([h.el, h.parent]);
    expect(h.sink.diagnostics?.()).toEqual([]);
  });

  it('does not let a rejected same-revision px frame replace pending percentage demand', () => {
    const h = fixture();
    h.commit('w-1/2');
    const before = captured.presentations.length;
    h.sink.commit({
      view: 1,
      revision: 1,
      style: createRootStyleEffect([resolveRootStyleEntry('w-[100px]', 'rule')]),
      declarations: [{ properties: ['width'], durationMs: 100, easing: [0, 0, 1, 1] }],
    });
    expect(captured.presentations).toHaveLength(before);
    h.firstFrame();
    unknownWidth();
    expect(h.reads).toEqual([]);
    expect(h.el.getAttribute('data-pui-style')).toBe('w-1/2');
    h.el.dataset.probeWidth = 'two-hundred';
    h.observers[0].deliver([entry(h.parent, 400)]);
    settledWidth(200);
  });

  it('ignores the retired parent entry after reparenting before first delivery', () => {
    const h = fixture();
    h.commit('w-1/2');
    const replacement = newParent();
    replacement.append(h.el);
    h.observers[0].deliver([entry(h.parent, 600)]);
    unknownWidth();
    expect(h.observers[0].observed.has(h.parent)).toBe(false);
    expect(h.observers[0].observed.has(replacement)).toBe(true);
    h.el.dataset.probeWidth = 'four-hundred';
    h.observers[0].deliver([entry(replacement, 800)]);
    settledWidth(400);
  });

  it('chooses the live current parent when old and new entries arrive together', () => {
    const h = fixture();
    h.commit('w-1/2');
    const replacement = document.body;
    expect(h.observers[0].observed.has(replacement)).toBe(true);
    replacement.append(h.el);
    h.el.dataset.probeWidth = 'four-hundred';
    h.observers[0].deliver([entry(h.parent, 600), entry(replacement, 800)]);
    settledWidth(400);
  });

  it('revalidates the current parent after a host style read reparents during delivery', () => {
    const h = fixture();
    h.commit('w-1/2');
    const replacement = newParent();
    const computed = window.getComputedStyle.bind(window);
    vi.mocked(window.getComputedStyle).mockImplementationOnce((target, pseudo) => {
      replacement.append(h.el);
      return computed(target, pseudo);
    });
    h.observers[0].deliver([entry(h.parent, 400)]);
    unknownWidth();
    h.el.dataset.probeWidth = 'four-hundred';
    h.observers[0].deliver([entry(replacement, 800)]);
    settledWidth(400);
  });

  it('resolves through a real Shadow bridge and display contents to the measured real block', () => {
    const h = fixture();
    const bridge = document.createElement('div');
    bridge.style.display = 'contents';
    const shadow = bridge.attachShadow({ mode: 'open' });
    h.parent.append(bridge);
    shadow.append(h.el);
    expect(h.el.getRootNode()).toBe(shadow);
    h.el.dataset.probeWidth = 'two-hundred';
    h.commit('w-1/2');
    h.observers[0].deliver([entry(bridge, 600), entry(h.parent, 400)]);
    settledWidth(200);
  });

  it.each(['to-contents', 'to-block'] as const)(
    'classifies a changed ancestor display at first delivery: %s',
    (change) => {
      const h = fixture();
      const outer = newParent();
      outer.append(h.parent);
      h.parent.style.display = change === 'to-block' ? 'contents' : 'block';
      h.commit('w-1/2');
      h.parent.style.display = change === 'to-block' ? 'block' : 'contents';
      h.el.dataset.probeWidth = change === 'to-block' ? 'two-hundred' : 'four-hundred';
      h.observers[0].deliver([entry(h.parent, 400), entry(outer, 800)]);
      settledWidth(change === 'to-block' ? 200 : 400);
    }
  );

  it.each([
    { target: 'surface', position: 'absolute' },
    { target: 'surface', position: 'fixed' },
    { target: 'parent', position: 'absolute' },
    { target: 'parent', position: 'fixed' },
  ])('keeps the original unsupported $target $position layout rejected', ({ target, position }) => {
    const h = fixture();
    h.commit('w-1/2');
    (target === 'surface' ? h.el : h.parent).style.position = position;
    h.observers[0].deliver([entry(h.parent, 400)]);
    unknownWidth();
    expect(h.sink.diagnostics?.()).toContain('width:layout-profile-unavailable');
  });

  it.each(['minWidth', 'maxWidth'] as const)(
    'retains the original %s clamp rejection after measurement',
    (property) => {
      const h = fixture();
      h.commit('w-1/2');
      h.el.style[property] = '150px';
      h.observers[0].deliver([entry(h.parent, 400)]);
      unknownWidth();
      expect(h.sink.diagnostics?.()).toContain('width:layout-profile-unavailable');
    }
  );

  it('does not reuse a detached parent measurement and resumes after real reattachment', () => {
    const h = fixture();
    h.commit('w-1/2');
    h.el.remove();
    h.observers[0].deliver([entry(h.parent, 400)]);
    unknownWidth();
    const replacement = newParent();
    replacement.append(h.el);
    h.commit('w-1/2');
    h.el.dataset.probeWidth = 'four-hundred';
    h.observers[0].deliver([entry(replacement, 800)]);
    settledWidth(400);
  });

  it('keeps unknown percentages without RO and still immediately admits a later px target', () => {
    const h = fixture();
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    h.commit('w-1/2');
    h.firstFrame();
    unknownWidth();
    expect(h.observers).toHaveLength(0);
    expect(h.el.style.width).toBe('');
    h.el.dataset.probeWidth = 'pixels';
    h.commit('w-[100px]');
    settledWidth(100);
    expect(h.sink.diagnostics?.()).toEqual([]);
  });

  it('makes late RO entries inert after owner retirement', () => {
    const h = fixture();
    h.commit('w-1/2');
    h.sink.release(1);
    const priorReads = h.reads.length,
      priorPresentations = captured.presentations.length;
    h.observers[0].deliver([entry(h.parent, 400)]);
    expect(h.reads).toHaveLength(priorReads);
    expect(captured.presentations).toHaveLength(priorPresentations);
    expect(h.observers[0].observed.size).toBe(0);
    expect(h.el.style.width).toBe('');
  });

  it('does not let retired old-Document entries reach an adopted physical owner', () => {
    const h = fixture();
    h.commit('w-1/2');
    h.sink.release(1);
    const other = document.implementation.createHTMLDocument('adopted');
    other.body.append(other.adoptNode(h.el));
    h.el.style.setProperty('width', '77px', 'important');
    const prior = captured.presentations.length;
    h.observers[0].deliver([entry(h.parent, 400), entry(h.el, 200)]);
    expect(captured.presentations).toHaveLength(prior);
    expect(h.el.style.width).toBe('77px');
    expect(h.el.style.getPropertyPriority('width')).toBe('important');
  });

  it.each([
    { label: 'zero', token: 'w-[0%]', width: 0 },
    { label: 'pixels', token: 'w-[100px]', width: 100 },
    { label: 'rem', token: 'w-[2rem]', width: 32 },
  ])(
    'does not carry pending percentage demand into a later $label Rule',
    ({ label, token, width }) => {
      const h = fixture();
      h.commit('w-1/2');
      unknownWidth();
      h.el.dataset.probeWidth = label;
      h.commit(token);
      settledWidth(width);
      h.observers[0].deliver([entry(document.body, 8000), entry(h.parent, 400)]);
      settledWidth(width);
      expect(h.sink.diagnostics?.()).toEqual([]);
      expect(h.observers).toHaveLength(1);
      expect([...h.observers[0].observed.keys()]).toEqual([h.el, h.parent]);
    }
  );

  it('uses an already measured basis immediately when a new Rule needs a percentage', () => {
    const h = fixture();
    h.el.dataset.probeWidth = 'pixels';
    h.commit('w-[100px]');
    h.observers[0].deliver([entry(h.parent, 400)]);
    h.el.dataset.probeWidth = 'two-hundred';
    h.commit('w-1/2');
    settledWidth(200);
    expect(h.sink.diagnostics?.()).toEqual([]);
    expect([...h.observers[0].observed.keys()]).toEqual([h.el, h.parent]);
  });

  it.each([NaN, Infinity, -1])(
    'never manufactures a basis from invalid measurement %s',
    (value) => {
      const h = fixture();
      h.commit('w-1/2');
      h.observers[0].deliver([entry(h.parent, value)]);
      unknownWidth();
      expect(h.el.style.width).toBe('');
    }
  );

  it('distinguishes a real zero basis from an unavailable basis', () => {
    const h = fixture();
    h.el.dataset.probeWidth = 'zero';
    h.commit('w-1/2');
    h.observers[0].deliver([entry(h.parent, 0)]);
    settledWidth(0);
    expect(h.sink.diagnostics?.()).toEqual([]);
  });

  it('retains an external inline width owner throughout pending and delivery', () => {
    const h = fixture();
    h.el.style.setProperty('width', '77px', 'important');
    h.commit('w-1/2');
    h.observers[0].deliver([entry(h.parent, 400)]);
    unknownWidth();
    expect(h.el.style.width).toBe('77px');
    expect(h.el.style.getPropertyPriority('width')).toBe('important');
    expect(h.sink.diagnostics?.()).toContain('width:external-inline-owner');
  });

  it('retains the post-flush same-basis guard if physical projection reparents the surface', () => {
    const h = fixture();
    h.el.dataset.probeWidth = 'two-hundred';
    h.commit('w-1/2');
    h.observers[0].deliver([entry(h.parent, 400)]);
    h.firstFrame();
    const replacement = newParent();
    h.onNextFlush(() => replacement.append(h.el));
    h.commit('w-full');
    expect(h.el.style.width).toBe('');
    expect(h.sink.diagnostics?.()).toContain('width:projection-rejected');
    expect(h.observers[0].observed.has(h.parent)).toBe(false);
    expect(h.observers[0].observed.has(replacement)).toBe(true);
  });
});

describe('observation reentry keeps the current admitted demand', () => {
  it.each(['pixels', 'color'] as const)(
    'reconciles a synchronous newer %s Rule in the same subscription',
    (kind) => {
      const h = fixture();
      const original = window.ResizeObserver.prototype.observe;
      let reenter = true;
      vi.spyOn(window.ResizeObserver.prototype, 'observe').mockImplementation(function (
        this: ResizeObserver,
        target,
        options
      ) {
        original.call(this, target, options);
        if (target !== h.parent || !reenter) return;
        reenter = false;
        if (kind === 'pixels') {
          h.el.dataset.probeWidth = 'pixels';
          h.commit('w-[100px]');
        } else {
          h.sink.commit({
            view: 1,
            revision: 2,
            style: createRootStyleEffect([resolveRootStyleEntry('bg-primary', 'rule')]),
            declarations: [
              { properties: ['background-color'], durationMs: 100, easing: [0, 0, 1, 1] },
            ],
          });
        }
      });
      h.commit('w-1/2');
      expect(reenter).toBe(false);
      expect(h.el.getAttribute('data-pui-style')).toBe(
        kind === 'pixels' ? 'w-[100px]' : 'bg-primary'
      );
      expect(h.observers).toHaveLength(1);
      expect([...h.observers[0].observed.keys()]).toEqual(
        kind === 'pixels' ? [h.el, h.parent] : [h.el]
      );
    }
  );

  it('keeps a newer width-only demand when retiring color observations synchronously reenters', () => {
    const current = vi.fn(() => ({ revision: 1, colors: { primary: [1, 0, 0, 1] as const } }));
    const off = vi.fn();
    const subscribe = vi.fn(() => off);
    const h = fixture({ palette: { current, subscribe } });
    h.commit('w-1/2');
    expect(current).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    const original = window.ResizeObserver.prototype.unobserve;
    let reenter = true;
    vi.spyOn(window.ResizeObserver.prototype, 'unobserve').mockImplementation(function (
      this: ResizeObserver,
      target
    ) {
      original.call(this, target);
      if (target !== h.parent || !reenter) return;
      reenter = false;
      h.el.dataset.probeWidth = 'pixels';
      h.sink.commit({
        view: 1,
        revision: 3,
        style: createRootStyleEffect([resolveRootStyleEntry('w-[100px]', 'rule')]),
        declarations: [{ properties: ['width'], durationMs: 100, easing: [0, 0, 1, 1] }],
      });
    });
    h.sink.commit({
      view: 1,
      revision: 2,
      style: createRootStyleEffect([resolveRootStyleEntry('bg-primary', 'rule')]),
      declarations: [{ properties: ['background-color'], durationMs: 100, easing: [0, 0, 1, 1] }],
    });
    expect(reenter).toBe(false);
    expect(h.el.getAttribute('data-pui-style')).toBe('w-[100px]');
    settledWidth(100);
    expect(h.observers).toHaveLength(1);
    expect([...h.observers[0].observed.keys()]).toEqual([h.el, h.parent]);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledTimes(1);
    expect(current).not.toHaveBeenCalled();
    h.firstFrame();
    settledWidth(100);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledTimes(1);
    expect(current).not.toHaveBeenCalled();
  });
});
