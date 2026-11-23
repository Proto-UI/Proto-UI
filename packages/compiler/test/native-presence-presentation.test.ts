// @vitest-environment happy-dom
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compilePrototype } from '../src/compile';
import { validateIR } from '../src/ir-validation';
import { writeArtifactSet } from '../src/artifact-output';
import { nativePresencePresentationArtifact } from '../src/native-presence-presentation';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups: (() => unknown | Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const literal = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'presence-admission',setup(def){
 const owner=def.feedback.presence.owner();
 def.feedback.style.presence({owner:owner.ref,closed:{opacity:0},entered:{opacity:1},easing:[0,0,1,1]});
 return r=>r.el('span',['native']);
}});`;

/** Deterministic host clock. Browser/GPU tests are a separate evidence boundary. */
function hostClock() {
  vi.stubGlobal('__VUE_DEVTOOLS_GLOBAL_HOOK__', { emit() {} });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  let next = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++next, callback);
    return next;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((ticket) => {
    frames.delete(ticket);
  });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(prefers-reduced-motion: no-preference)',
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => true,
      }) as MediaQueryList
  );
  return {
    frame(milliseconds: number) {
      vi.advanceTimersByTime(milliseconds);
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(performance.now());
    },
    pending: () => frames.size,
    retiredCallbacks: () => [...frames.values()],
  };
}

async function projector() {
  const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated-modules');
  await mkdir(directory, { recursive: true });
  const temp = await mkdtemp(path.join(directory, 'presentation-'));
  cleanups.push(() => rm(temp, { recursive: true, force: true }));
  const result = await writeArtifactSet(
    [nativePresencePresentationArtifact],
    path.join(temp, 'output')
  );
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const module = await import(
    /* @vite-ignore */ path.join(temp, 'output', nativePresencePresentationArtifact.path)
  );
  const root = document.createElement('div');
  document.body.append(root);
  const receipts: any[] = [];
  let element: HTMLElement | null = root;
  let phase = 'setup';
  const registry = module.createNativePresence({
    setup() {
      if (phase !== 'setup') throw new Error('setup phase');
    },
    runtime() {
      if (phase !== 'runtime') throw new Error('runtime phase');
    },
    alive: () => phase !== 'disposed',
    invoke(callback: (run: object) => void) {
      const previous = phase;
      phase = 'runtime';
      try {
        callback({});
      } finally {
        phase = previous;
      }
    },
    root: () => element,
    prepare() {},
  });
  const owner = registry.owner();
  owner.onCompletionRequest((_run: unknown, event: { receipt: unknown }) =>
    receipts.push(event.receipt)
  );
  let revision = 0;
  return {
    root,
    registry,
    owner,
    receipts,
    phase(next: string) {
      phase = next;
    },
    bind(next: HTMLElement | null) {
      element = next;
    },
    declare(overrides = {}) {
      registry.declare({
        owner: owner.ref,
        closed: { opacity: 0 },
        entered: { opacity: 1 },
        easing: [0, 0, 1, 1],
        ...overrides,
      });
    },
    publish(state = 'entering', attempt = 1, extra = {}) {
      phase = 'runtime';
      registry.publish(owner.writer, {
        owner: owner.ref,
        revision: ++revision,
        phase: state,
        attempt:
          state === 'entering' || state === 'leaving'
            ? { ownerEpoch: 1, phaseAttempt: attempt }
            : null,
        completion: 'presentation',
        durationMs: 100,
        timeoutMs: 500,
        ...extra,
      });
    },
    dispose() {
      registry.dispose();
      phase = 'disposed';
    },
  };
}

describe('Presentation admission and direct native lowering', () => {
  it('retains the declaration as a checked operation through serialized IR and only reaches support on admitted Web targets', () => {
    for (const profile of nativeOwnerProfiles) {
      const result = compilePrototype(literal, { profile });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(validateIR(JSON.parse(JSON.stringify(result.value.ir)))).toMatchObject({ ok: true });
      expect(result.value.output.supportingFiles?.map((file) => file.path)).toContain(
        nativePresencePresentationArtifact.path
      );
      expect(result.value.output.code).toContain('Presence.declare(');
      expect(result.value.output.code).not.toMatch(/@proto\.ui\/(runtime|adapter|prototypes)/);
    }
    const plain = compilePrototype(literal.replace(/ def\.feedback\.style\.presence[^\n]*\n/, ''), {
      profile: 'react-dom-source-v1',
    });
    if (!plain.ok) throw new Error(JSON.stringify(plain.diagnostics));
    expect(plain.value.output.supportingFiles?.map((file) => file.path)).not.toContain(
      nativePresencePresentationArtifact.path
    );
    expect(compilePrototype(literal, { profile: 'gpui-source-v1' }).ok).toBe(false);
  });

  it('rejects arbitrary getter-backed translation inputs instead of admitting them as State facts', () => {
    const source = literal
      .replace(
        'closed:{opacity:0}',
        `closed:{opacity:0,translate:{source:{get:()=>"left"},cases:{left:[{px:1,rootText:0,ownBox:0},{px:0,rootText:0,ownBox:0}]}}}`
      )
      .replace(
        'entered:{opacity:1}',
        'entered:{opacity:1,translate:[{px:0,rootText:0,ownBox:0},{px:0,rootText:0,ownBox:0}]}'
      );
    expect(compilePrototype(source, { profile: 'react-dom-source-v1' }).ok).toBe(false);
  });
});

describe('generated Presentation atom: definition-owned lifecycle controls', () => {
  it('waits for a real frame acknowledgement, then delivers only the exact current receipt', async () => {
    const clock = hostClock(),
      p = await projector();
    cleanups.push(p.dispose);
    p.declare();
    p.registry.mount();
    p.publish();
    expect(p.root.style.opacity).toBe('0');
    vi.advanceTimersByTime(25);
    expect(p.root.style.opacity).toBe('0');
    expect(p.receipts).toHaveLength(0);
    clock.frame(0);
    clock.frame(50);
    expect(Number(p.root.style.opacity)).toBeCloseTo(0.5, 5);
    clock.frame(50);
    expect(p.receipts.map((receipt) => receipt.outcome)).toEqual(['finished']);
    expect(p.root.style.opacity).toBe('');
    expect(p.registry.isCurrent(p.owner.writer, p.receipts[0])).toBe(true);
    p.publish('entered');
    expect(p.registry.isCurrent(p.owner.writer, p.receipts[0])).toBe(false);
    expect(clock.pending()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the last displayed value on reversal, and stale frames cannot repaint a detached view', async () => {
    const clock = hostClock(),
      p = await projector();
    cleanups.push(p.dispose);
    p.declare();
    p.registry.mount();
    p.publish();
    clock.frame(0);
    clock.frame(25);
    expect(Number(p.root.style.opacity)).toBeCloseTo(0.25, 5);
    vi.advanceTimersByTime(50); // no host sample was acknowledged here
    p.publish('leaving', 2);
    expect(Number(p.root.style.opacity)).toBeCloseTo(0.25, 5);
    const retired = clock.retiredCallbacks();
    clock.frame(25);
    expect(p.receipts.map((receipt) => receipt.outcome)).toEqual(['finished']);
    p.publish('entering', 3);
    p.registry.detach();
    p.root.style.opacity = '0.8';
    for (const callback of retired) callback(performance.now() + 1000);
    vi.advanceTimersByTime(1000);
    expect(p.root.style.opacity).toBe('0.8');
    expect(p.receipts).toHaveLength(1);
    expect(clock.pending()).toBe(0);
  });

  it('retains an independent deadline, refuses unsupported endpoints before writes, and preserves a replacement style owner', async () => {
    hostClock();
    const p = await projector();
    cleanups.push(p.dispose);
    p.declare();
    p.registry.mount();
    p.publish();
    vi.advanceTimersByTime(500);
    expect(p.receipts.map((receipt) => receipt.outcome)).toEqual(['deadline']);
    const q = await projector();
    cleanups.push(q.dispose);
    q.declare({ entered: { opacity: 0.9 } });
    q.registry.mount();
    q.publish();
    expect(q.receipts.map((receipt) => receipt.outcome)).toEqual(['unsupported-endpoint']);
    expect(q.root.style.opacity).toBe('');
    const r = await projector();
    cleanups.push(r.dispose);
    r.declare();
    r.registry.mount();
    r.publish();
    r.root.style.opacity = '0.6';
    r.registry.refresh();
    expect(r.receipts.map((receipt) => receipt.outcome)).toEqual(['projection-ownership-lost']);
    r.dispose();
    expect(r.root.style.opacity).toBe('0.6');
  });

  it('snapshots recipe data, rejects foreign owners/sources and never reads accessor payloads', async () => {
    const p = await projector();
    cleanups.push(p.dispose);
    const getter = vi.fn(() => 0);
    expect(() =>
      p.registry.declare({
        owner: p.owner.ref,
        closed: {
          get opacity() {
            return getter();
          },
        },
        entered: { opacity: 1 },
        easing: [0, 0, 1, 1],
      })
    ).toThrow(/data/);
    expect(getter).not.toHaveBeenCalled();
    expect(() =>
      p.registry.declare({
        owner: {},
        closed: { opacity: 0 },
        entered: { opacity: 1 },
        easing: [0, 0, 1, 1],
      })
    ).toThrow(/foreign owner/);
    const zero = { px: 0, rootText: 0, ownBox: 0 };
    expect(() =>
      p.declare({
        closed: { translate: { source: { get: () => 'left' }, cases: { left: [zero, zero] } } },
        entered: { translate: [zero, zero] },
      })
    ).toThrow(/foreign selection State/);
    const state = { get: () => 'left' };
    p.registry.registerSource(state);
    p.declare({
      closed: { translate: { source: state, cases: { left: [zero, zero] } } },
      entered: { translate: [zero, zero] },
    });
  });
});

for (const profile of nativeOwnerProfiles)
  it(`${profile}: actual authored Transition consumes the Presentation declaration through native imports`, async () => {
    const clock = hostClock();
    const files: Record<string, string> = {};
    for (const name of ['as-transition.proto.ts', 'machine.ts', 'types.ts'])
      files[`transition/${name}`] = await readFile(
        `packages/prototypes/base/src/transition/${name}`,
        'utf8'
      );
    const source = `import {definePrototype} from '@proto.ui/core';
import {asTransition} from './transition/as-transition.proto';
export default definePrototype({name:'presented-transition',setup(def){
 const transition=asTransition();
 transition.configure({enterDuration:100,leaveDuration:100,completion:{kind:'presentation',timeoutMs:500}});
 def.feedback.style.presence({owner:transition.presentationOwner,closed:{opacity:0},entered:{opacity:1},easing:[0,0,1,1]});
 return r=>r.el('section',[transition.transitionState.get(),r.slot()]);
}});`;
    const owner = await mountNativeOwner(source, profile, {
      compile: { fileName: 'entry.proto.ts', files },
    });
    cleanups.push(owner.dispose);
    const api = owner.handle.getExposes();
    await owner.act(() => api.controls.enter());
    expect(api.transitionState.get()).toBe('entering');
    const physicalRoot = owner.host.firstElementChild as HTMLElement;
    expect(physicalRoot.style.opacity, owner.host.outerHTML).toBe('0');
    await owner.act(() => clock.frame(0));
    await owner.act(() => clock.frame(50));
    expect(Number(physicalRoot.style.opacity)).toBeCloseTo(0.5, 5);
    await owner.act(() => clock.frame(50));
    expect(api.transitionState.get()).toBe('entered');
    expect(physicalRoot.style.opacity).toBe('');
    await owner.act(() => api.controls.leave());
    await owner.act(() => clock.frame(100));
    expect(api.transitionState.get()).toBe('closed');
    await owner.dispose();
    expect(clock.pending()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  }, 30_000);
