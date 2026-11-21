// @vitest-environment happy-dom
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTransitionMachine,
  type TransitionMachineDriver,
} from '../../prototypes/base/src/transition/machine';
import type { TransitionInterrupt, TransitionState } from '../../prototypes/base/src/transition/types';
import { compilePrototype } from '../src/compile';
import { resolveTargetProfile, TARGET_PROFILES, type TargetProfileId } from '../src/targets';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const rejectedProfiles = [
  'qt-source-v1',
  'flutter-source-v1',
  'react-dom-ssr-v1',
  'vue-ssr-v1',
  'vue2-ssr-v1',
  'web-component-ssr-v1',
] as const satisfies readonly TargetProfileId[];

function fixture(options: { enabled?: boolean; interrupt?: TransitionInterrupt; duration?: number } = {}) {
  let state: TransitionState = 'closed';
  const events: string[] = [];
  const presence: boolean[] = [];
  const tasks: Array<{ cancelled: boolean; fn(): void }> = [];
  let boundary: (kind: string) => void = () => {};
  const driver: TransitionMachineDriver = {
    getState: () => state,
    setState(next) {
      state = next;
      boundary(`state:${next}`);
    },
    getInterrupt: () => options.interrupt ?? 'reverse',
    requiresColdPreparation: () => options.enabled === true,
    getDuration: () => options.duration ?? 10,
    schedule(_duration, fn) {
      const task = { fn, cancelled: false };
      tasks.push(task);
      return {
        cancel() {
          task.cancelled = true;
        },
      };
    },
    setViewPresent(next) {
      presence.push(next);
      boundary(`present:${next}`);
    },
    emit(event) {
      events.push(event);
      boundary(`event:${event}`);
    },
  };
  return {
    machine: createTransitionMachine(driver),
    events,
    presence,
    tasks,
    state: () => state,
    at(fn: typeof boundary) {
      boundary = fn;
    },
  };
}

describe('base transition timing matrix', () => {
  it('cold start stays closed without a view', () => {
    const f = fixture();
    f.machine.initialize(false, false);
    expect(f.state()).toBe('closed');
    expect(f.presence).toEqual([false]);
    expect(f.events).toEqual([]);
    expect(f.tasks).toEqual([]);
  });

  it('cold preparation releases to entered without animation events', () => {
    const f = fixture({ enabled: true });
    f.machine.initialize(true, false);
    f.machine.mounted();
    expect(f.state()).toBe('preparing');
    expect(f.presence).toEqual([true]);
    expect(f.events).toEqual([]);
    const release = f.machine.capturePreparation();
    expect(typeof release).toBe('function');
    release?.();
    expect(f.state()).toBe('entered');
    expect(f.events).toEqual([]);
    expect(f.tasks).toEqual([]);
  });

  it('afterLeave synchronous enter keeps the new view', () => {
    const f = fixture();
    f.machine.initialize(true, false);
    f.machine.mounted();
    f.machine.leave();
    f.at((kind) => {
      if (kind === 'event:afterLeave') f.machine.enter();
    });
    f.machine.complete();
    expect(f.events).toContain('afterLeave');
    expect(f.state()).toBe('entering');
    expect(f.presence.at(-1)).toBe(true);
    for (const task of f.tasks.filter((task) => task.cancelled)) task.fn();
    expect(f.state()).toBe('entering');
    expect(f.presence.at(-1)).toBe(true);
    for (const task of f.tasks.filter((task) => !task.cancelled)) task.fn();
    expect(f.state()).toBe('entered');
    expect(f.presence.at(-1)).toBe(true);
  });

  it('a superseded delay cannot complete the newer phase', () => {
    const f = fixture();
    f.machine.initialize(false, false);
    f.machine.mounted();
    f.machine.enter();
    const entry = f.tasks[0];
    f.machine.leave();
    expect(entry?.cancelled).toBe(true);
    expect(f.state()).toBe('leaving');
    entry?.fn();
    expect(f.state()).toBe('leaving');
    expect(f.presence.at(-1)).toBe(true);
  });

  it('duplicate complete finishes the phase once', () => {
    const f = fixture();
    f.machine.initialize(false, false);
    f.machine.mounted();
    f.machine.enter();
    f.machine.complete();
    f.machine.complete();
    expect(f.state()).toBe('entered');
    expect(f.events.filter((event) => event === 'afterEnter')).toEqual(['afterEnter']);
  });

  it('dispose invalidates the armed completion', () => {
    const f = fixture();
    f.machine.initialize(false, false);
    f.machine.mounted();
    f.machine.enter();
    const entry = f.tasks[0];
    f.machine.dispose();
    expect(entry?.cancelled).toBe(true);
    entry?.fn();
    expect(f.state()).toBe('entering');
    f.machine.complete();
    f.machine.enter();
    expect(f.state()).toBe('entering');
    expect(f.events.filter((event) => event === 'afterEnter')).toEqual([]);
  });

  it('an old unmount epoch cannot complete a newer entry', () => {
    const f = fixture();
    f.machine.initialize(false, false);
    f.machine.mounted();
    f.machine.enter();
    const old = f.tasks[0];
    f.machine.unmounted();
    expect(f.state()).toBe('closed');
    expect(old?.cancelled).toBe(true);
    f.machine.mounted();
    f.machine.enter();
    expect(f.state()).toBe('entering');
    old?.fn();
    expect(f.state()).toBe('entering');
    expect(f.presence.at(-1)).toBe(true);
  });
});

describe('unsupported generated targets stay rejected', () => {
  it.each(rejectedProfiles)('%s', (id) => {
    expect(TARGET_PROFILES[id].implemented).toBe(false);
    const result = resolveTargetProfile(id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe('PUI4001');
  });

  it('admits gpui without a DOM owner harness', () => {
    expect(TARGET_PROFILES['gpui-source-v1'].implemented).toBe(true);
    expect(resolveTargetProfile('gpui-source-v1').ok).toBe(true);
    expect(nativeOwnerProfiles).not.toContain('gpui-source-v1');
  });
});

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

async function transitionFiles() {
  const files: Record<string, string> = {};
  for (const name of ['as-transition.proto.ts', 'machine.ts', 'types.ts']) {
    files[`transition/${name}`] = await readFile(
      `packages/prototypes/base/src/transition/${name}`,
      'utf8'
    );
  }
  return files;
}

function source(configure: string) {
  return `import {definePrototype} from '@proto.ui/core';
import {asTransition as install} from './transition/as-transition.proto';
export default definePrototype({name:'ordinary-transition-owner',setup(def){
  const transition=install();
  ${configure}
  return r=>r.el('section',[transition.transitionState.get(),r.slot()]);
}});`;
}

for (const profile of nativeOwnerProfiles) {
  describe(`generated ${profile}`, () => {
    it('runs the shared timing matrix', async () => {
      const files = await transitionFiles();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
      const ordinary = source('transition.configure({enterDuration:10,leaveDuration:7});');
      const prepared = source(
        'transition.configure({coldEntryPreparation:true,appear:false,enterDuration:10,leaveDuration:7});'
      );
      const domEvents = profile === 'web-component-source-v1';
      const heard: string[] = [];
      const follow: Record<string, (() => void) | undefined> = {};
      const hear = (name: string) => {
        heard.push(name);
        follow[name]?.();
      };
      const eventProps = domEvents
        ? {}
        : {
            onBeforeEnter: () => hear('beforeEnter'),
            onAfterEnter: () => hear('afterEnter'),
            onBeforeLeave: () => hear('beforeLeave'),
            onAfterLeave: () => hear('afterLeave'),
          };
      const mount = async (text: string, props?: Record<string, unknown>) => {
        const owner = await mountNativeOwner(text, profile, {
          props: { ...eventProps, ...props },
          compile: { fileName: 'entry.proto.ts', files },
        });
        cleanups.push(owner.dispose);
        const exposed = owner.handle.getExposes();
        const rendered = () =>
          (owner.host.firstElementChild?.shadowRoot ?? owner.host).querySelector('section');
        if (domEvents) {
          for (const name of ['beforeEnter', 'afterEnter', 'beforeLeave', 'afterLeave'])
            owner.host.addEventListener(name, () => hear(name));
        }
        return { owner, exposed, rendered };
      };

      const cold = await mount(ordinary);
      expect(cold.exposed.transitionState.get()).toBe('closed');
      expect(cold.exposed.isPresent.get()).toBe(false);
      expect(cold.rendered()).toBeNull();

      const preparing = await mount(prepared, { defaultOpen: true });
      expect(preparing.exposed.transitionState.get()).toBe('preparing');
      expect(preparing.exposed.isPresent.get()).toBe(true);
      expect(preparing.rendered()).not.toBeNull();
      const before = heard.length;
      const release = preparing.exposed.controls.capturePreparation();
      expect(typeof release).toBe('function');
      await preparing.owner.act(() => release());
      expect(preparing.exposed.transitionState.get()).toBe('entered');
      expect(heard.slice(before)).toEqual([]);

      const reopen = await mount(ordinary);
      follow.afterLeave = () => reopen.exposed.controls.enter();
      const marked = heard.length;
      await reopen.owner.act(() => reopen.exposed.controls.enter());
      await reopen.owner.act(() => reopen.exposed.controls.complete());
      expect(reopen.exposed.transitionState.get()).toBe('entered');
      await reopen.owner.act(() => reopen.exposed.controls.leave());
      await reopen.owner.act(() => reopen.exposed.controls.complete());
      expect(heard.slice(marked)).toContain('afterLeave');
      expect(reopen.exposed.transitionState.get()).toBe('entering');
      expect(reopen.exposed.isPresent.get()).toBe(true);
      expect(reopen.rendered()).not.toBeNull();
      await reopen.owner.act(() => vi.advanceTimersByTime(50));
      expect(reopen.exposed.transitionState.get()).not.toBe('closed');
      expect(reopen.rendered()).not.toBeNull();
      follow.afterLeave = undefined;

      const late = await mount(ordinary);
      await late.owner.act(() => late.exposed.controls.enter());
      await late.owner.act(() => vi.advanceTimersByTime(9));
      expect(late.exposed.transitionState.get()).toBe('entering');
      await late.owner.act(() => late.exposed.controls.leave());
      expect(late.exposed.transitionState.get()).toBe('leaving');
      await late.owner.act(() => vi.advanceTimersByTime(1));
      expect(late.exposed.transitionState.get()).toBe('leaving');
      expect(late.rendered()).not.toBeNull();
      await late.owner.act(() => vi.advanceTimersByTime(6));
      expect(late.exposed.transitionState.get()).toBe('closed');
      expect(late.rendered()).toBeNull();

      const duplicate = await mount(ordinary);
      const duplicateAt = heard.length;
      await duplicate.owner.act(() => duplicate.exposed.controls.enter());
      await duplicate.owner.act(() => duplicate.exposed.controls.complete());
      await duplicate.owner.act(() => duplicate.exposed.controls.complete());
      expect(duplicate.exposed.transitionState.get()).toBe('entered');
      expect(heard.slice(duplicateAt).filter((name) => name === 'afterEnter')).toEqual([
        'afterEnter',
      ]);

      const disposed = await mount(ordinary);
      await disposed.owner.act(() => disposed.exposed.controls.enter());
      expect(disposed.exposed.transitionState.get()).toBe('entering');
      await disposed.owner.dispose();
      await vi.advanceTimersByTimeAsync(20);
      expect(() => disposed.exposed.controls.enter()).toThrow(/dispos|alive|terminal/i);

      const epoch = await mount(ordinary);
      await epoch.owner.act(() => epoch.exposed.controls.enter());
      await epoch.owner.act(() => vi.advanceTimersByTime(9));
      await epoch.owner.dispose();
      const replacement = await mount(ordinary);
      await replacement.owner.act(() => replacement.exposed.controls.enter());
      expect(replacement.exposed.transitionState.get()).toBe('entering');
      await replacement.owner.act(() => vi.advanceTimersByTime(1));
      expect(replacement.exposed.transitionState.get()).toBe('entering');
      expect(replacement.rendered()).not.toBeNull();
    }, 180_000);
  });
}

describe('gpui lowers the authored transition instead of a protocol copy', () => {
  it('compiles the shared source without hook.asTransition', async () => {
    const files = await transitionFiles();
    const compiled = compilePrototype(source('transition.configure({enterDuration:10,leaveDuration:7});'), {
      profile: 'gpui-source-v1',
      fileName: 'entry.proto.ts',
      files,
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const text = JSON.stringify(compiled.value);
    expect(text).not.toContain('hook.asTransition');
    expect(text).toContain('machine.ts');
  });
});
