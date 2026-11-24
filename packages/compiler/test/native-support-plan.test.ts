// @vitest-environment happy-dom
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import { nativeInteractionArtifact } from '../src/native-interaction';
import { nativeAdapterModulesArtifact } from '../src/native-adapter-modules';
import {
  nativeSupportFeatures,
  nativeSupportPlanFromFeatures,
  nativeSupportUnits,
  planNativeSupport,
  type NativeSupportFeature,
} from '../src/native-support/plan';
import {
  loadSupport,
  measureSupport,
  supportClosure,
  typecheckSupport,
  type SupportFile,
} from './native-support-evidence';

const close: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of close.splice(0).reverse()) cleanup();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
interface Observed {
  get(): boolean;
  subscribe(callback: (event: { next: boolean; prev: boolean }) => void): () => void;
}
interface Interaction {
  event?: { on(type: string, callback: () => void): unknown };
  asTrigger?(): void;
  asAccessible?(): { role(value: string): void };
  asFocusable?(): { focused: Observed; focusable: Observed; setDisabled(value: boolean): void };
  asFocusScope?(): {
    active: Observed;
    activate(): void;
    deactivate(): void;
    configure(value: object): void;
  };
  asFocusRoving?(): unknown;
  asFocusEntry?(): unknown;
  asCollection?(): unknown;
  asCollectionItem?(): unknown;
  asBoundary?(): {
    observe(type: string): void;
    subscribeOutside(callback: () => void): () => void;
  };
  asHitParticipation?(): unknown;
  asScrollSurface?(): unknown;
  asOverlay?(): unknown;
  asTextControl?(): {
    sync(patch: object): void;
    on(type: string, callback: () => void): () => void;
  };
  asImageView?(): { sync(patch: object): void };
  asTableStructure?(role: string): unknown;
  positioning?: { connect(connection: object): void; disconnect(): void };
  mount(): void;
  unmount(): void;
  dispose(): void;
}
function owner(feature: NativeSupportFeature, shared?: ReturnType<typeof loadSupport>) {
  const { plan, files } = supportClosure([feature]);
  const load = shared ?? loadSupport(files);
  const create = load(plan.interactionPath).createNativeInteraction;
  if (typeof create !== 'function') throw new Error('Missing native interaction factory');
  const root = document.createElement(
    feature === 'text' ? 'input' : feature === 'image' ? 'img' : 'div'
  );
  document.body.append(root);
  const counts = { observed: 0, owned: 0 };
  const declarations =
    feature === 'text'
      ? [
          {
            id: '@proto.ui/text-control/declaration',
            config: { content: 'plain-text', engine: 'host', lineMode: 'single' },
          },
        ]
      : feature === 'image'
        ? [
            {
              id: '@proto.ui/image-view/declaration',
              config: { source: '', a11yMode: 'decorative', alternativeText: '', fit: 'contain' },
            },
          ]
        : [];
  const instance: Interaction = create({
    ensureSetup() {},
    ensureRuntime() {},
    ensureEvent() {},
    isAlive: () => true,
    isReady: () => true,
    isSetupComplete: () => true,
    invoke: <T>(callback: () => T) => callback(),
    getRoot: () => root,
    getRun: () => ({}),
    getResolvedProps: () => ({}),
    identity: {},
    getLogicalParent: () => null,
    declarations,
    registerGenericObservedState: () => {
      ++counts.observed;
    },
    createOwnedState: (_name: string, initial: unknown) => {
      ++counts.owned;
      let value = initial;
      return {
        get: () => value,
        set: (next: unknown) => {
          value = next;
        },
        setDefault: (next: unknown) => {
          value = next;
        },
      };
    },
    registerExpose() {},
  });
  close.push(() => {
    instance.dispose();
    root.remove();
  });
  return { instance, root, counts, plan, files };
}
function recordListeners(targets: EventTarget[]) {
  const live = new Map<EventListenerOrEventListenerObject, { target: EventTarget; type: string }>();
  const added: string[] = [];
  for (const target of targets) {
    const add = target.addEventListener.bind(target),
      remove = target.removeEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
      if (listener) {
        live.set(listener, { target, type });
        added.push(type);
      }
      add(type, listener, options);
    });
    vi.spyOn(target, 'removeEventListener').mockImplementation((type, listener, options) => {
      if (listener) live.delete(listener);
      remove(type, listener, options);
    });
  }
  return { live, added };
}
const emittedJs = (files: readonly SupportFile[]) =>
  files
    .map(
      (file) =>
        ts.transpileModule(file.contents, {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        }).outputText
    )
    .join('\n');

describe('native support dependency plans', () => {
  it('covers every host unit with a strict native TypeScript consumer and explicit imports', () => {
    const files = new Map<string, SupportFile>();
    for (const feature of nativeSupportFeatures)
      for (const file of supportClosure([feature]).files) {
        expect(file.contents).not.toContain('__nativeFeature');
        if (files.has(file.path)) expect(files.get(file.path)!.contents).toBe(file.contents);
        files.set(file.path, file);
      }
    expect(typecheckSupport([...files.values()])).toBe('');
  }, 30000);
  it('closes helper dependencies together with the resources and release obligations', () => {
    for (const feature of nativeSupportFeatures) {
      const plan = nativeSupportPlanFromFeatures([feature]);
      for (const selected of plan.features) {
        for (const dependency of nativeSupportUnits[selected].imports)
          expect(plan.features).toContain(dependency);
        for (const resource of nativeSupportUnits[selected].resources)
          expect(plan.resources).toContain(resource);
        for (const cleanup of nativeSupportUnits[selected].cleanup)
          expect(plan.cleanup).toContain(cleanup);
      }
      expect(plan.packages.includes('@floating-ui/dom')).toBe(
        plan.features.includes('positioning')
      );
    }
    expect(() =>
      planNativeSupport({ moduleDeclarations: [] }, { operations: ['hook.asFutureHost' as never] })
    ).toThrow('Missing native support dependency contract');
  });
  it.each([
    'a11y',
    'trigger',
    'focus',
    'entry',
    'scope',
    'roving',
    'anatomy',
    'collection',
    'boundary',
    'hit',
    'text',
    'image',
    'table',
  ] as const)('%s retains no positioning, scroll or overlay implementation', (feature) => {
    const { files } = supportClosure([feature]);
    const js = emittedJs(files);
    expect(js).not.toMatch(/computePosition|autoUpdate|overlayOpen|scrollAxes|transitionTimer/);
    if (!['focus', 'entry', 'scope', 'roving'].includes(feature))
      expect(js).not.toMatch(/focused\s*=\s*observed|focusVisible\s*=\s*observed/);
  });
  it.each([
    ['react', emitReactSource],
    ['vue', emitVueSource],
    ['vue2', emitVue2Source],
    ['wc', emitWebComponentSource],
  ] as const)(
    '%s derives support from the reached IR, including an unused host hook negative control',
    (_target, emit) => {
      function compile(name: string, dormant: string) {
        const parsed = parsePrototype(
          `import {definePrototype} from '@proto.ui/core'; import {asAccessible, asOverlay} from '@proto.ui/hooks'; export default definePrototype({name:'${name}',setup(def){asAccessible().role('button'); return r=>r.el('div'); ${dormant}}});`,
          { fileName: 'arbitrary.proto.ts' }
        );
        if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
        const result = emit(parsed.value);
        if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
        return result.value;
      }
      const plain = compile('one', ''),
        dormant = compile('different-name', 'asOverlay();');
      const support = (module: typeof plain) =>
        module.supportingFiles?.filter((file) => file.path.includes('/interaction/'));
      expect(support(dormant)).toEqual(support(plain));
      expect(plain.dependencies.some((dependency) => dependency.name === '@floating-ui/dom')).toBe(
        false
      );
      expect(emittedJs(support(plain) ?? [])).not.toMatch(
        /autoUpdate|scrollAxes|observed\(|addEventListener/
      );
    }
  );
});

describe('production retained support evidence', () => {
  it('measures source and production-retained bytes independently, with Floating UI as a positive control', async () => {
    const all = nativeSupportPlanFromFeatures(nativeSupportFeatures);
    const legacy = await measureSupport(
      { ...all, interactionPath: nativeInteractionArtifact.path },
      [nativeInteractionArtifact, nativeAdapterModulesArtifact]
    );
    const measurements: Record<string, unknown> = {};
    for (const feature of [
      'a11y',
      'trigger',
      'text',
      'image',
      'boundary',
      'collection',
      'scope',
      'scroll',
      'positioning',
      'overlay',
    ] as const) {
      const { plan, files } = supportClosure([feature]);
      const result = await measureSupport(plan, files);
      expect(result.sourceBytes).toBeLessThan(legacy.sourceBytes);
      expect(result.productionBytes).toBeLessThan(legacy.productionBytes);
      const floating = result.inputs.some((input) => input.includes('@floating-ui'));
      expect(floating).toBe(feature === 'positioning' || feature === 'overlay');
      if (feature === 'a11y' || feature === 'trigger') {
        expect(result.productionBytes).toBeLessThan(legacy.productionBytes / 2);
        expect(result.code).not.toMatch(
          /Floating|closeOnOutsidePress|collectionCount|transition\.complete/
        );
      }
      const { code: _code, inputs, ...bytes } = result;
      measurements[feature] = { ...bytes, retainedFloatingUi: floating, inputCount: inputs.length };
    }
    console.info(
      'native-support-v2 evidence',
      JSON.stringify({
        baseline: {
          sourceBytes: legacy.sourceBytes,
          productionBytes: legacy.productionBytes,
          gzipBytes: legacy.gzipBytes,
        },
        measurements,
      })
    );
  }, 30000);
});

describe('initialization, registration and cleanup evidence', () => {
  it('asAccessible initializes no observed/owned state and registers no input or global listeners', () => {
    const fixture = owner('a11y');
    const listeners = recordListeners([fixture.root, document, window]);
    fixture.instance.asAccessible!().role('button');
    fixture.instance.mount();
    expect(fixture.root.getAttribute('role')).toBe('button');
    expect(fixture.counts).toEqual({ observed: 0, owned: 0 });
    expect(listeners.added).toEqual([]);
    fixture.instance.unmount();
    expect(fixture.root.hasAttribute('role')).toBe(false);
    expect(listeners.live.size).toBe(0);
  });
  it('asTrigger creates only requested input support and cancels retained native callbacks at view detach', () => {
    const fixture = owner('trigger');
    const listeners = recordListeners([fixture.root, document, window]);
    const pressed = vi.fn();
    fixture.instance.asTrigger!();
    fixture.instance.event!.on('press.commit', pressed);
    fixture.instance.mount();
    expect(fixture.counts).toEqual({ observed: 0, owned: 0 });
    expect(listeners.added.length).toBeGreaterThan(0);
    expect(listeners.added).not.toContain('scroll');
    const retained = [...listeners.live.keys()];
    fixture.root.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(pressed).toHaveBeenCalledOnce();
    fixture.instance.unmount();
    expect(listeners.live.size).toBe(0);
    for (const listener of retained)
      if (typeof listener === 'function')
        listener(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(pressed).toHaveBeenCalledOnce();
  });
  it('Text and Boundary register their own resources and release them without focus facts', () => {
    for (const feature of ['text', 'boundary'] as const) {
      const fixture = owner(feature);
      const listeners = recordListeners([fixture.root, document, window]);
      if (feature === 'text') fixture.instance.asTextControl!();
      else fixture.instance.asBoundary!().observe('pointer.press');
      fixture.instance.mount();
      expect(fixture.counts).toEqual({ observed: 0, owned: 0 });
      expect(listeners.added).toContain(feature === 'text' ? 'input' : 'pointerdown');
      // Boundary tracks when the shared pointer intent ends; this keydown
      // listener does not claim keyboard navigation or allocate focus state.
      if (feature === 'boundary') expect(listeners.added).toContain('keydown');
      else expect(listeners.added).not.toContain('keydown');
      expect(listeners.added).not.toContain('focusin');
      fixture.instance.unmount();
      expect(listeners.live.size).toBe(0);
      vi.restoreAllMocks();
    }
  });
  it('focus observers use FIFO recorded registrations and drain reentrant errors before throwing', () => {
    const fixture = owner('focus');
    const focus = fixture.instance.asFocusable!();
    fixture.instance.mount();
    const trace: string[] = [];
    let offSecond = () => {};
    focus.focusable.subscribe((event) => {
      trace.push('a:' + event.next);
      if (!event.next) {
        offSecond();
        focus.focusable.subscribe((next) => trace.push('late:' + next.next));
        focus.setDisabled(false);
        throw new Error('first');
      }
    });
    offSecond = focus.focusable.subscribe((event) => trace.push('cancelled:' + event.next));
    focus.focusable.subscribe((event) => trace.push('b:' + event.next));
    expect(() => focus.setDisabled(true)).toThrow('first');
    expect(trace).toEqual(['a:false', 'b:false', 'a:true', 'b:true', 'late:true']);
  });
  it('different capability closures share one owner identity module', () => {
    const a11y = supportClosure(['a11y']),
      scope = supportClosure(['scope']);
    const load = loadSupport([...a11y.files, ...scope.files]);
    const first = owner('a11y', load),
      second = owner('scope', load);
    first.instance.asAccessible!().role('group');
    second.instance.asFocusScope!().configure({ restore: 'none' });
    first.instance.mount();
    second.instance.mount();
    const owners = load('.proto-ui/interaction/ownership-v2.ts').owners;
    expect(owners).toBeInstanceOf(Map);
    expect((owners as Map<object, unknown>).size).toBe(2);
    first.instance.dispose();
    second.instance.dispose();
    expect((owners as Map<object, unknown>).size).toBe(0);
  });
});
