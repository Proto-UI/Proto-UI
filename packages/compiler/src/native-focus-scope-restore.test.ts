// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { posix, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { parsePrototype } from './parser';
import { emitVue2Source } from './vue2-source';
import { emitWebComponentSource } from './web-component-source';
import { nativeAdapterModulesArtifact } from './native-adapter-modules';
import { nativeInteractionArtifact } from './native-interaction';

type Request = { reason?: string; preventScroll?: boolean };
type Activation = Request & { entry?: 'manual' | 'configured' };
interface Observed<T> {
  get(): T;
  subscribe(callback: (event: { next: T }) => void): () => void;
}
interface Scope {
  active: Observed<boolean>;
  hasFocused: Observed<boolean>;
  configure(config: Record<string, unknown>): void;
  activate(request?: Activation): void;
  deactivate(request?: Request): void;
  isActive(): boolean;
}
interface Capabilities {
  asFocusScope(): Scope;
  configureFocusable(config: Record<string, unknown>): void;
  focus(request?: Request): void;
  canFocus(): boolean;
  mount(): void;
  unmount(): void;
  dispose(): void;
}
interface Focusable {
  focused: Observed<boolean>;
  focus(request?: Request): void;
  focusSelf(request?: Request): void;
}
interface Interaction {
  asFocusScope(): Scope;
  asFocusable(): Focusable;
  mount(): void;
  unmount(): void;
  dispose(): void;
}
type Factory = (options: Record<string, unknown>) => Capabilities;
type InteractionFactory = (options: Record<string, unknown>) => Interaction;
type NativeFactories = { adapter: Factory; interaction: InteractionFactory };
type Profile = 'vue2' | 'wc';

const factories = new Map<Profile, NativeFactories>();
function nativeFactories(profile: Profile): NativeFactories {
  const previous = factories.get(profile);
  if (previous) return previous;
  const parsed = parsePrototype(
    `import {definePrototype} from '@proto.ui/core';
import {asFocusScope} from '@proto.ui/hooks';
export default definePrototype({name:'ordinary-scope-restore',setup(def){
 const scope=asFocusScope();scope.configure({restore:'none'});
 def.expose.method('open',()=>{scope.activate();});
 def.expose.method('close',()=>{scope.deactivate();});
 return r=>r.el('section',r.slot());
}});`,
    { fileName: 'scope-restore.proto.ts' }
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const emitted =
    profile === 'vue2'
      ? emitVue2Source(parsed.value)
      : emitWebComponentSource(parsed.value, { shadow: false });
  if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
  const files = new Map(emitted.value.supportingFiles?.map((file) => [file.path, file.contents]));
  const cache = new Map<string, Record<string, unknown>>();
  // Use a filesystem anchor; Happy DOM rewrites import.meta.url to an HTTP URL.
  const floating = createRequire(
    resolve(process.cwd(), 'packages/modules/positioning/package.json')
  )('@floating-ui/dom');
  function load(filename: string): Record<string, unknown> {
    const previous = cache.get(filename);
    if (previous) return previous;
    const source = files.get(filename);
    if (source === undefined) throw new Error('Missing emitted support: ' + filename);
    const exports: Record<string, unknown> = {};
    cache.set(filename, exports);
    const code = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('require', 'exports', code)((specifier: string) => {
      if (specifier === '@floating-ui/dom') return floating;
      if (specifier.startsWith('.'))
        return load(posix.normalize(posix.join(posix.dirname(filename), specifier + '.ts')));
      throw new Error('Unexpected emitted dependency: ' + specifier);
    }, exports);
    return exports;
  }
  // Execute product artifacts: Vue2 splits shared ownership; WC emits the
  // monolithic helper. Both are produced by the canonical source emitter.
  const adapter = load(nativeAdapterModulesArtifact.path).createNativeAdapterModules;
  const interaction = load(nativeInteractionArtifact.path).createNativeInteraction;
  if (typeof adapter !== 'function' || typeof interaction !== 'function')
    throw new Error('Emitted native focus factories are missing');
  // The compiler-created export is called through the native module options seam below.
  const result = { adapter: adapter as Factory, interaction: interaction as InteractionFactory };
  factories.set(profile, result);
  return result;
}

function fixture(config: Record<string, unknown> = {}, profile: Profile = 'vue2') {
  const create = nativeFactories(profile).adapter;
  const trigger = document.createElement('button');
  const destination = document.createElement('button');
  const root = document.createElement('section');
  const inside = document.createElement('button');
  root.append(inside);
  document.body.append(trigger, destination, root);
  trigger.focus();
  const identity = {};
  const instances: Capabilities[] = [];
  const requests: Array<{ element: HTMLElement; request: Request | undefined }> = [];
  function participant(element: HTMLElement, id: object, parent: object | null, focusable = false) {
    const capabilities = create({
      identity: id,
      getLogicalParent: () => parent,
      getRoot: () => element,
      declarations: [],
      ensureSetup: () => {},
      ensureRuntime: () => {},
      ensureEvent: () => {},
      isAlive: () => true,
      isReady: () => true,
      invoke: <T>(fn: () => T) => fn(),
      getRun: () => ({}),
      getResolvedProps: () => ({}),
      baseFocus: () => ({
        focusSelf: (request?: Request) => {
          requests.push({ element, request });
          element.focus({ preventScroll: request?.preventScroll });
        },
      }),
    });
    if (focusable) capabilities.configureFocusable({});
    instances.push(capabilities);
    return capabilities;
  }
  const owner = participant(root, identity, null);
  const scope = owner.asFocusScope();
  scope.configure({ trap: true, loop: true, ...config });
  const child = participant(inside, {}, identity, true);
  const triggerOwner = participant(trigger, {}, null, true);
  const external = participant(destination, {}, null, true);
  for (const instance of instances) instance.mount();
  return {
    scope,
    owner,
    child,
    triggerOwner,
    external,
    participant,
    identity,
    root,
    trigger,
    destination,
    inside,
    requests,
    cleanup() {
      for (const instance of instances.reverse()) instance.dispose();
      root.remove();
      trigger.remove();
      destination.remove();
    },
  };
}

function interactionFixture(profile: Profile, restore: 'none' | 'previous' = 'none') {
  const create = nativeFactories(profile).interaction;
  const trigger = document.createElement('button');
  const destination = document.createElement('button');
  const root = document.createElement('section');
  const inside = document.createElement('button');
  root.append(inside);
  document.body.append(trigger, destination, root);
  trigger.focus();
  const identity = {};
  let childAttached = true;
  const options = (getRoot: () => HTMLElement | null, id: object, parent: object | null) => ({
    identity: id,
    getLogicalParent: () => parent,
    getRoot,
    declarations: [],
    ensureSetup: () => {},
    ensureRuntime: () => {},
    ensureEvent: () => {},
    isAlive: () => true,
    isSetupComplete: () => true,
    isReady: () => true,
    invoke: <T>(fn: () => T) => fn(),
    getRun: () => ({}),
    getResolvedProps: () => ({}),
  });
  // Both owners use the actual interaction factory, including its real Focus
  // bridge into adapter modules. No baseFocus implementation is injected.
  const owner = create(options(() => root, identity, null));
  const scope = owner.asFocusScope();
  scope.configure({ restore });
  const child = create(options(() => (childAttached ? inside : null), {}, identity));
  const focusable = child.asFocusable();
  owner.mount();
  child.mount();
  return {
    scope,
    focusable,
    inside,
    destination,
    unmountChild() {
      child.unmount();
      childAttached = false;
    },
    mountChild() {
      childAttached = true;
      child.mount();
    },
    cleanup() {
      try {
        child.dispose();
      } finally {
        try {
          owner.dispose();
        } finally {
          root.remove();
          trigger.remove();
          destination.remove();
        }
      }
    },
  };
}

describe('emitted native focus scope restore policy', () => {
  it.each<Profile>(['vue2', 'wc'])(
    '%s none preserves outside focus and releases the request gate',
    (profile) => {
      const f = fixture({ restore: 'none' }, profile);
      try {
        f.scope.activate({ reason: 'pointer' });
        expect(document.activeElement).toBe(f.inside);
        expect(f.external.canFocus()).toBe(false);
        f.destination.focus();
        f.scope.deactivate({ reason: 'pointer' });
        expect(document.activeElement).toBe(f.destination);
        expect(f.scope.active.get()).toBe(false);
        expect(f.external.canFocus()).toBe(true);
        expect(f.requests).toEqual([{ element: f.inside, request: { reason: 'pointer' } }]);
      } finally {
        f.cleanup();
      }
    }
  );

  it.each([{}, { restore: 'previous' }])(
    'preserves ordinary previous-owner restoration with %j',
    (config) => {
      const f = fixture(config);
      try {
        f.scope.activate({ reason: 'pointer' });
        expect(document.activeElement).toBe(f.inside);
        f.destination.focus();
        const focus = vi.spyOn(f.trigger, 'focus');
        f.scope.deactivate({ reason: 'keyboard', preventScroll: true });
        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(document.activeElement).toBe(f.trigger);
        focus.mockRestore();
        f.destination.focus();
        f.scope.deactivate();
        expect(document.activeElement).toBe(f.destination);
      } finally {
        f.cleanup();
      }
    }
  );

  it('none leaves an explicit keyboard handback available to the consumer', () => {
    const f = fixture({ restore: 'none' });
    try {
      f.scope.activate();
      f.scope.deactivate({ reason: 'keyboard' });
      expect(document.activeElement).toBe(f.inside);
      f.triggerOwner.focus({ reason: 'keyboard', preventScroll: true });
      expect(document.activeElement).toBe(f.trigger);
      expect(f.requests.at(-1)).toEqual({
        element: f.trigger,
        request: { reason: 'keyboard', preventScroll: true },
      });
    } finally {
      f.cleanup();
    }
  });

  it('a nested none scope leaves its destination while the parent still restores normally', () => {
    const f = fixture();
    try {
      const innerRoot = document.createElement('section');
      const innerChild = document.createElement('button');
      const sibling = document.createElement('button');
      innerRoot.append(innerChild);
      f.root.append(innerRoot, sibling);
      const innerIdentity = {};
      const innerOwner = f.participant(innerRoot, innerIdentity, f.identity);
      const inner = innerOwner.asFocusScope();
      inner.configure({ restore: 'none' });
      const child = f.participant(innerChild, {}, innerIdentity, true);
      const siblingOwner = f.participant(sibling, {}, f.identity, true);
      innerOwner.mount();
      child.mount();
      siblingOwner.mount();
      f.scope.activate();
      inner.activate();
      expect(document.activeElement).toBe(innerChild);
      sibling.focus();
      inner.deactivate();
      expect(document.activeElement).toBe(sibling);
      expect(f.scope.isActive()).toBe(true);
      expect(f.external.canFocus()).toBe(false);
      f.scope.deactivate();
      expect(document.activeElement).toBe(f.trigger);
    } finally {
      f.cleanup();
    }
  });

  it.each(['removed', 'hidden', 'inert', 'detached'] as const)(
    'ignores a %s previous physical target',
    (state) => {
      const f = fixture();
      try {
        f.scope.activate();
        if (state === 'removed') f.trigger.remove();
        else f.trigger.setAttribute(state === 'detached' ? 'data-pui-view-detached' : state, '');
        f.destination.focus();
        f.scope.deactivate();
        expect(document.activeElement).toBe(f.destination);
        expect(f.scope.isActive()).toBe(false);
        expect(f.external.canFocus()).toBe(true);
      } finally {
        f.cleanup();
      }
    }
  );

  it('does not reuse a prior activation capture when the new activation begins inside', () => {
    const f = fixture();
    try {
      f.scope.activate();
      f.scope.deactivate();
      expect(document.activeElement).toBe(f.trigger);
      f.inside.focus();
      f.scope.activate();
      f.destination.focus();
      f.scope.deactivate();
      expect(document.activeElement).toBe(f.destination);
    } finally {
      f.cleanup();
    }
  });

  it('does not restore to a disposed previous owner whose old element remains connected', () => {
    const f = fixture();
    try {
      f.scope.activate();
      f.triggerOwner.dispose();
      expect(f.trigger.isConnected).toBe(true);
      f.destination.focus();
      f.scope.deactivate();
      expect(document.activeElement).toBe(f.destination);
      expect(f.external.canFocus()).toBe(true);
    } finally {
      f.cleanup();
    }
  });

  it('does not restore over explicit handback during the active-state notification', () => {
    const f = fixture();
    try {
      f.scope.activate();
      const off = f.scope.active.subscribe(({ next }) => {
        if (!next) f.destination.focus();
      });
      f.scope.deactivate();
      off();
      expect(document.activeElement).toBe(f.destination);
    } finally {
      f.cleanup();
    }
  });

  it('does not resume automatic entry after a notification deactivates the scope', () => {
    const f = fixture({ restore: 'none' });
    try {
      const off = f.scope.active.subscribe(({ next }) => {
        if (next) f.scope.deactivate();
      });
      f.scope.activate();
      off();
      expect(f.scope.isActive()).toBe(false);
      expect(f.requests).toEqual([]);
      expect(document.activeElement).toBe(f.trigger);
    } finally {
      f.cleanup();
    }
  });

  it('does not restore or clear a newer manual activation from the deactivation notification', () => {
    const f = fixture();
    try {
      f.scope.activate();
      const off = f.scope.active.subscribe(({ next }) => {
        if (!next) f.scope.activate({ entry: 'manual' });
      });
      f.scope.deactivate();
      off();
      expect(f.scope.isActive()).toBe(true);
      expect(document.activeElement).toBe(f.inside);
      expect(f.external.canFocus()).toBe(false);
    } finally {
      f.cleanup();
    }
  });

  it.each<Profile>(['vue2', 'wc'])(
    '%s keeps a different manual scope active when an empty activation retires itself',
    (profile) => {
      const f = fixture({ emptyPolicy: 'none' }, profile);
      const nextRoot = document.createElement('section');
      const nextElement = document.createElement('button');
      let off: (() => void) | undefined;
      try {
        f.child.dispose();
        f.inside.remove();
        nextRoot.append(nextElement);
        document.body.append(nextRoot);
        const nextIdentity = {};
        const nextOwner = f.participant(nextRoot, nextIdentity, null);
        const nextScope = nextOwner.asFocusScope();
        nextScope.configure({ restore: 'none' });
        const nextChild = f.participant(nextElement, {}, nextIdentity, true);
        nextOwner.mount();
        nextChild.mount();
        off = f.scope.active.subscribe(({ next }) => {
          if (next) nextScope.activate({ entry: 'manual' });
        });

        f.scope.activate();
        off();
        off = undefined;
        expect(f.scope.isActive()).toBe(false);
        expect(nextScope.isActive()).toBe(true);
        expect(document.activeElement).toBe(f.trigger);
        expect(f.requests).toEqual([]);
        expect(nextChild.canFocus()).toBe(true);
        expect(f.external.canFocus()).toBe(false);
        expect(f.triggerOwner.canFocus()).toBe(false);
        nextChild.focus({ reason: 'keyboard' });
        expect(document.activeElement).toBe(nextElement);
        nextScope.deactivate();
        expect(f.external.canFocus()).toBe(true);
      } finally {
        off?.();
        try {
          f.cleanup();
        } finally {
          nextRoot.remove();
        }
      }
    }
  );

  it.each<Profile>(['vue2', 'wc'])(
    '%s does not restore through a different manual scope activated by the close notification',
    (profile) => {
      const f = fixture({ restore: 'previous' }, profile);
      const nextRoot = document.createElement('section');
      const nextElement = document.createElement('button');
      let off: (() => void) | undefined;
      try {
        nextRoot.append(nextElement);
        document.body.append(nextRoot);
        const nextIdentity = {};
        const nextOwner = f.participant(nextRoot, nextIdentity, null);
        const nextScope = nextOwner.asFocusScope();
        nextScope.configure({ restore: 'none' });
        const nextChild = f.participant(nextElement, {}, nextIdentity, true);
        nextOwner.mount();
        nextChild.mount();
        f.scope.activate();
        expect(document.activeElement).toBe(f.inside);
        off = f.scope.active.subscribe(({ next }) => {
          if (!next) nextScope.activate({ entry: 'manual' });
        });

        f.scope.deactivate({ reason: 'keyboard' });
        off();
        off = undefined;
        expect(document.activeElement).toBe(f.inside);
        expect(f.requests).toEqual([{ element: f.inside, request: { reason: 'programmatic' } }]);
        expect(f.scope.isActive()).toBe(false);
        expect(nextScope.isActive()).toBe(true);
        expect(nextChild.canFocus()).toBe(true);
        expect(f.child.canFocus()).toBe(false);
        expect(f.external.canFocus()).toBe(false);
        expect(f.triggerOwner.canFocus()).toBe(false);
        nextChild.focus({ reason: 'keyboard' });
        expect(document.activeElement).toBe(nextElement);
        nextScope.deactivate();
        expect(f.external.canFocus()).toBe(true);
      } finally {
        off?.();
        try {
          f.cleanup();
        } finally {
          nextRoot.remove();
        }
      }
    }
  );

  it.each<Profile>(['vue2', 'wc'])(
    '%s cancels closed-scope pending focus while retaining active-scope remount intent',
    (profile) => {
      // The open-scope control runs first: detachment alone must retain intent.
      for (const closesScope of [false, true]) {
        const f = fixture({ restore: 'none' }, profile);
        try {
          f.scope.activate();
          expect(document.activeElement).toBe(f.inside);
          const before = f.requests.length;
          f.child.unmount();
          // Ordinary admitted focus requests already queue while the target is absent.
          f.child.focus({ reason: 'keyboard' });
          expect(f.requests).toHaveLength(before);
          if (closesScope) f.scope.deactivate();
          f.destination.focus();
          expect(document.activeElement).toBe(f.destination);

          f.child.mount();
          if (closesScope) {
            expect(document.activeElement, 'closed scope must not replay its child intent').toBe(
              f.destination
            );
            expect(f.requests).toHaveLength(before);
          } else {
            expect(
              document.activeElement,
              'active scope retains its child intent across remount'
            ).toBe(f.inside);
            expect(f.requests).toHaveLength(before + 1);
            expect(f.requests.at(-1)).toEqual({
              element: f.inside,
              request: { reason: 'keyboard' },
            });
          }
        } finally {
          f.cleanup();
        }
      }
    }
  );

  it.each([
    ['vue2', 'focus'],
    ['vue2', 'focusSelf'],
    ['wc', 'focus'],
    ['wc', 'focusSelf'],
  ] as const)(
    '%s cancels closed-scope %s intent in the actual native interaction while preserving active remount',
    (profile, operation) => {
      // focus() owns the adapter-module queue; focusSelf() owns the distinct
      // interaction queue. The active-scope control must retain each request.
      for (const closesScope of [false, true]) {
        const f = interactionFixture(profile);
        const focus = vi.spyOn(f.inside, 'focus');
        try {
          f.scope.activate();
          expect(document.activeElement).toBe(f.inside);
          const before = focus.mock.calls.length;
          f.unmountChild();
          f.focusable[operation]({ reason: 'keyboard' });
          expect(focus).toHaveBeenCalledTimes(before);
          if (closesScope) f.scope.deactivate();
          f.destination.focus();
          expect(document.activeElement).toBe(f.destination);

          f.mountChild();
          if (closesScope) {
            expect(document.activeElement, 'closed scope must cancel this real focus queue').toBe(
              f.destination
            );
            expect(focus).toHaveBeenCalledTimes(before);
            expect(f.focusable.focused.get()).toBe(false);
          } else {
            expect(
              document.activeElement,
              'active scope retains the same public focus request'
            ).toBe(f.inside);
            expect(focus).toHaveBeenCalledTimes(before + 1);
            expect(f.focusable.focused.get()).toBe(true);
          }
        } finally {
          focus.mockRestore();
          f.cleanup();
        }
      }
    }
  );

  it.each([
    ['vue2', 'focus'],
    ['vue2', 'focusSelf'],
    ['wc', 'focus'],
    ['wc', 'focusSelf'],
  ] as const)(
    '%s preserves a newer %s request from the close notification without a scope change',
    (profile, operation) => {
      const f = interactionFixture(profile, 'previous');
      const focus = vi.spyOn(f.inside, 'focus');
      let off: (() => void) | undefined;
      try {
        f.scope.activate();
        expect(document.activeElement).toBe(f.inside);
        const before = focus.mock.calls.length;
        off = f.scope.active.subscribe(({ next }) => {
          if (next) return;
          f.unmountChild();
          f.focusable[operation]({ reason: 'keyboard' });
        });

        f.scope.deactivate();
        expect(f.scope.isActive()).toBe(false);
        expect(
          document.activeElement,
          'a pending request supersedes the old automatic restore'
        ).toBe(f.inside);
        expect(focus).toHaveBeenCalledTimes(before);
        off();
        off = undefined;

        // The new request belongs to the post-close state and must survive until
        // its actual interaction owner can resolve a target again.
        f.mountChild();
        expect(focus).toHaveBeenCalledTimes(before + 1);
        expect(document.activeElement).toBe(f.inside);
        expect(f.focusable.focused.get()).toBe(true);

        // Request bookkeeping cannot suppress an ordinary later activation's
        // previous-owner restoration once this notification has settled.
        f.destination.focus();
        f.scope.activate();
        expect(document.activeElement).toBe(f.inside);
        f.scope.deactivate();
        expect(document.activeElement).toBe(f.destination);
      } finally {
        off?.();
        focus.mockRestore();
        f.cleanup();
      }
    }
  );

  it.each(['unmount', 'dispose'] as const)(
    'does not restore after %s retires the closing view',
    (operation) => {
      const f = fixture();
      try {
        f.scope.activate();
        f.destination.focus();
        f.scope.active.subscribe(({ next }) => {
          if (!next) f.owner[operation]();
        });
        f.scope.deactivate();
        expect(document.activeElement).toBe(f.destination);
      } finally {
        f.cleanup();
      }
    }
  );
});
