// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { emitFlutterSource } from '../src/flutter-source';
import { validateIR } from '../src/ir-validation';
import { parsePrototype } from '../src/parser';
import { qtControlsSource } from '../src/qt-native-controls';
import { emitQtSource } from '../src/qt-source';

type Config = Record<string, unknown>;
type Scroll = {
  configure(patch: Config): void;
  sync(patch: Config): void;
  axes: { get(): string };
};
type NativeView = { syncScroll(config: Config): void };

// Exercise the exact emitted Qt guest module against an explicitly bounded
// host protocol. This does not claim execution of QML or a native Qt window.
function qtGuest() {
  let phase: 'setup' | 'callback' | 'render' = 'setup';
  let alive = true;
  let ready = false;
  let root: NativeView | null = null;
  const requireAlive = () => {
    if (!alive) throw new Error('terminal disposal');
  };
  const factory = new Function(
    `${qtControlsSource.replace('export function createControls', 'function createControls')}\nreturn createControls;`
  )();
  const controls = factory({
    declarations: [],
    alive: requireAlive,
    setup() {
      requireAlive();
      if (phase !== 'setup') throw new Error('setup authority closed');
    },
    runtime() {
      requireAlive();
      if (phase !== 'callback') throw new Error('owned callback required');
    },
    root: () => root,
    ready: () => alive && ready,
    active: () => alive,
    changed() {},
    refreshFacts() {},
    bindScrollChrome() {},
    invoke(callback: (...args: unknown[]) => void, args: unknown[]) {
      callback(...args);
    },
  });
  const scroll: Scroll = controls.hooks.asScrollSurface();
  return {
    scroll,
    controls,
    callback() {
      phase = 'callback';
    },
    render() {
      phase = 'render';
    },
    attach(view: NativeView) {
      root = view;
      ready = true;
      controls.mount();
    },
    detach() {
      ready = false;
      controls.unmount();
      // Deliberately retain the old physical root during the detach callback.
      // `ready` must prevent sync from touching that retiring view.
    },
    dispose() {
      ready = false;
      controls.dispose();
      alive = false;
    },
  };
}

describe('existing native Scroll axes operation', () => {
  it('updates only the current Qt axes and leaves projection and follow policy intact', () => {
    const guest = qtGuest();
    guest.scroll.configure({
      axes: 'vertical',
      projection: 'system',
      endFollow: { mode: 'while-at-end', axis: 'vertical' },
    });
    const applied: Config[] = [];
    guest.attach({ syncScroll: (config) => applied.push(structuredClone(config)) });
    guest.callback();
    guest.scroll.sync({ axes: 'horizontal', projection: 'composed', endFollow: { mode: 'off' } });
    expect(applied).toEqual([
      {
        axes: 'vertical',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
      {
        axes: 'horizontal',
        projection: 'system',
        endFollow: { mode: 'while-at-end', axis: 'vertical' },
      },
    ]);
    // A guest intent is not substituted for native observed facts.
    expect(guest.scroll.axes.get()).toBe('both');
    guest.scroll.sync({});
    guest.scroll.sync({ axes: 'horizontal' });
    expect(applied).toHaveLength(2);
  });

  it('retains detached axes for the new native view without updating the retiring view', () => {
    const guest = qtGuest();
    const old: Config[] = [];
    const fresh: Config[] = [];
    guest.scroll.configure({ axes: 'vertical', projection: 'system' });
    guest.attach({ syncScroll: (config) => old.push(structuredClone(config)) });
    guest.callback();
    guest.detach();
    guest.scroll.sync({ axes: 'horizontal' });
    expect(old).toHaveLength(1);
    guest.attach({ syncScroll: (config) => fresh.push(structuredClone(config)) });
    expect(fresh).toEqual([
      { axes: 'horizontal', projection: 'system', endFollow: { mode: 'off' } },
    ]);
    expect(old[0].axes).toBe('vertical');
  });

  it('rejects invalid values before altering retained configuration', () => {
    const guest = qtGuest();
    const applied: Config[] = [];
    guest.scroll.configure({ axes: 'vertical' });
    guest.callback();
    for (const axes of ['diagonal', 1, false]) {
      expect(() => guest.scroll.sync({ axes })).toThrow('Invalid scroll axes');
    }
    guest.attach({ syncScroll: (config) => applied.push(structuredClone(config)) });
    expect(applied).toHaveLength(1);
    expect(applied[0].axes).toBe('vertical');
  });

  it('keeps setup, render, callback and terminal authority distinct', () => {
    const guest = qtGuest();
    expect(() => guest.scroll.sync({ axes: 'horizontal' })).toThrow('owned callback');
    guest.callback();
    expect(() => guest.scroll.configure({ axes: 'horizontal' })).toThrow('setup authority');
    expect(() => guest.scroll.sync({ axes: 'horizontal' })).not.toThrow();
    guest.render();
    expect(() => guest.scroll.sync({ axes: 'vertical' })).toThrow('owned callback');
    guest.callback();
    guest.dispose();
    expect(() => guest.scroll.sync({ axes: 'vertical' })).toThrow('terminal disposal');
  });

  const source = `import {definePrototype} from '@proto.ui/core';
    import {asScrollSurface} from '@proto.ui/hooks';
    export default definePrototype({name:'native-axes-consumer',setup(def){
      const scroll=asScrollSurface();scroll.configure({axes:'vertical',projection:'system'});
      def.expose.method('horizontal',()=>scroll.sync({axes:'horizontal'}));
      def.expose.method('same',()=>scroll.sync({}));
      return r=>r.slot();
    }});`;
  it.each([
    ['Qt', emitQtSource],
    ['Flutter', emitFlutterSource],
  ] as const)(
    'retains the existing %s direct-emitter callback after cold IR validation',
    (_, emit) => {
      const parsed = parsePrototype(source);
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const cold = validateIR(JSON.parse(JSON.stringify(parsed.value)));
      if (!cold.ok) throw new Error(JSON.stringify(cold.diagnostics));
      const result = emit(cold.value);
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.code).toContain('.sync(');
    }
  );
  it.each(['qt-source-v1', 'flutter-source-v1'] as const)(
    'keeps the public %s profile unavailable',
    (profile) => {
      const result = compilePrototype(source, { profile });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.diagnostics.some((entry) => entry.code === 'PUI4001')).toBe(true);
    }
  );
});
