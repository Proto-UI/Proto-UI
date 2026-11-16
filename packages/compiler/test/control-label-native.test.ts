// @vitest-environment happy-dom
import ts from 'typescript';
import { createRequire } from 'node:module';
import path from 'node:path';
import { URL as NodeURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createControlLabelRef } from '../../core/src/control-label';
import { createA11ySemanticObjectRef } from '@proto.ui/core';
import { createWebA11yProjectionRegistry } from '../../modules/a11y/src/web';
import { nativeControlLabelArtifact } from '../src/native-control-label';
import { nativeSupportArtifacts } from '../src/native-interaction';
import { nativeSupportPlanFromFeatures } from '../src/native-support/plan';

type Request = { source: 'pointer' | 'accessibility'; isCurrent(): boolean };
type Pair = {
  family: { debugName: string; roles: Record<string, unknown> };
  labelRole: string;
  targetRole: string;
};
type Controller = {
  facade: {
    label(pair?: Pair): { sync(options: { naming: boolean; activation: boolean }): void };
    target(activate: (run: object, request: Request) => void, pair?: Pair): unknown;
  };
  refresh(): void;
  mount(): void;
  unmount(): void;
  dispose(): void;
};
type NativeModule = {
  createNativeControlLabel(options: {
    identity: object;
    ensureSetup(operation: string): void;
    isAlive(): boolean;
    isSetupComplete(): boolean;
    getRoot(): HTMLElement | null;
    getAssociations(): unknown;
    getRun(): object;
    invoke<T>(callback: () => T): T;
    hasAuthoredName(): boolean;
    beginNameProjection(): () => void;
    resolveAnatomy(pair: Pair, kind: 'label' | 'target'): object | null;
    subscribeAnatomy(callback: () => void): () => void;
  }): Controller;
  validateNativeInstanceAssociations(value: unknown): unknown;
  retainGeneratedId(element: Element, id: string): { dispose(): void } | null;
};

// Run the exact emitted helper in independent module instances, with no Proto
// imports substituted into the product. Type checking is a separate graph test.
const javascript = ts.transpileModule(nativeControlLabelArtifact.contents, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function loadNative(): NativeModule {
  const exports = {};
  new Function('exports', javascript)(exports);
  return exports as NativeModule;
}
function loadInteraction() {
  const plan = nativeSupportPlanFromFeatures(['control-label']);
  const files = new Map(nativeSupportArtifacts(plan).map((file) => [file.path, file.contents]));
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    const existing = cache.get(file);
    if (existing) return existing;
    const source = files.get(file);
    if (!source) throw new Error('Missing reached native artifact: ' + file);
    const exports: Record<string, unknown> = {};
    cache.set(file, exports);
    const code = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function('exports', 'require', code)(exports, (specifier: string) => {
      if (specifier === '@floating-ui/dom')
        return createRequire(
          new NodeURL('../../modules/positioning/package.json', import.meta.url)
        )(specifier);
      if (!specifier.startsWith('.')) throw new Error('Unexpected native dependency: ' + specifier);
      return load(
        path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) + '.ts'
      );
    });
    return exports;
  }
  return load(plan.interactionPath).createNativeInteraction as (
    options: Record<string, unknown>
  ) => {
    asAccessible(): {
      name(value: { get(): string }): void;
      relation(kind: string, target: { target: { get(): string } }): void;
    };
    asControlLabel(): Controller['facade'];
    mount(): void;
    refresh(): void;
    dispose(): void;
  };
}
const cleanups: Array<() => void> = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  document.body.replaceChildren();
});
function participant(
  module: NativeModule,
  kind: 'label' | 'target',
  ref: object,
  element?: HTMLElement
) {
  const node = element ?? document.createElement(kind === 'label' ? 'span' : 'button');
  if (!element) document.body.append(node);
  node.textContent = kind === 'label' ? 'Visible label' : 'Command';
  let associations: unknown = { controlLabel: ref },
    alive = true,
    setup = true,
    authored = false,
    callbacks = 0;
  const run = {};
  const controller = module.createNativeControlLabel({
    identity: {},
    ensureSetup() {
      if (!setup) throw new Error('outside setup');
    },
    isAlive: () => alive,
    isSetupComplete: () => !setup,
    getRoot: () => node,
    getAssociations: () => associations,
    getRun: () => run,
    invoke: (callback) => callback(),
    hasAuthoredName: () => authored,
    beginNameProjection: () => () => {},
    resolveAnatomy: () => null,
    subscribeAnatomy: () => () => {},
  });
  const labelHandle = kind === 'label' ? controller.facade.label() : null;
  if (labelHandle) labelHandle.sync({ naming: true, activation: true });
  else
    controller.facade.target((actual, request) => {
      expect(actual).toBe(run);
      if (request.isCurrent()) callbacks++;
    });
  setup = false;
  const dispose = () => {
    controller.dispose();
    alive = false;
  };
  cleanups.push(dispose);
  return {
    node,
    controller,
    mount: () => controller.mount(),
    dispose,
    callbacks: () => callbacks,
    associate(value: unknown) {
      associations = value;
      controller.refresh();
    },
    stopNaming() {
      labelHandle?.sync({ naming: false, activation: true });
    },
    name(value: boolean) {
      authored = value;
      controller.refresh();
    },
  };
}
function connect() {
  const ref = createControlLabelRef();
  const label = participant(loadNative(), 'label', ref);
  const target = participant(loadNative(), 'target', ref);
  label.mount();
  target.mount();
  return { ref, label, target };
}
async function mutations() {
  // A real observer checkpoint, not a timer budget or implementation callback.
  await new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      observer.disconnect();
      resolve();
    });
    observer.observe(document.body, { attributes: true });
    document.body.toggleAttribute('data-control-label-checkpoint');
  });
}

describe('native ControlLabel authority and derived-name ownership', () => {
  it('uses public opaque references across independently emitted helper instances', () => {
    const { label, target } = connect();
    expect(label.node.id).not.toBe('');
    expect(target.node.getAttribute('aria-labelledby')).toBe(label.node.id);
    expect(target.node.hasAttribute('aria-label')).toBe(false);
    target.dispose();
    expect(label.node.hasAttribute('id')).toBe(false);
    expect(target.node.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('withdraws an ambiguous pair and restores it only after the duplicate leaves', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ref, label, target } = connect();
    const duplicate = participant(loadNative(), 'target', ref);
    duplicate.mount();
    expect(target.node.hasAttribute('aria-labelledby')).toBe(false);
    expect(duplicate.node.hasAttribute('aria-labelledby')).toBe(false);
    duplicate.dispose();
    expect(target.node.getAttribute('aria-labelledby')).toBe(label.node.id);
    duplicate.dispose();
    expect(target.node.getAttribute('aria-labelledby')).toBe(label.node.id);
  });

  it('requires the same actual tree scope even for the same explicit reference', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ref = createControlLabelRef(),
      host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' }),
      inner = document.createElement('button');
    shadow.append(inner);
    const label = participant(loadNative(), 'label', ref),
      target = participant(loadNative(), 'target', ref, inner);
    label.mount();
    target.mount();
    expect(inner.hasAttribute('aria-labelledby')).toBe(false);
    shadow.append(label.node);
    target.controller.refresh();
    expect(inner.getAttribute('aria-labelledby')).toBe(label.node.id);
  });

  it('preserves authored target naming and permits reacquisition when that owner withdraws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { label, target } = connect();
    target.name(true);
    expect(target.node.hasAttribute('aria-labelledby')).toBe(false);
    expect(label.node.hasAttribute('id')).toBe(false);
    target.name(false);
    expect(target.node.getAttribute('aria-labelledby')).toBe(label.node.id);
  });

  it('keeps derived naming through native projection with empty default name and IDREF States', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ref = createControlLabelRef(),
      label = participant(loadNative(), 'label', ref),
      target = document.createElement('input');
    document.body.append(target);
    let setup = true,
      authored = '';
    const interaction = loadInteraction()({
      identity: {},
      ensureSetup() {
        if (!setup) throw new Error('outside setup');
      },
      ensureRuntime() {},
      ensureEvent() {},
      isAlive: () => true,
      isSetupComplete: () => !setup,
      isReady: () => true,
      getRoot: () => target,
      getResolvedProps: () => ({}),
      getRun: () => ({}),
      getAssociations: () => ({ controlLabel: ref }),
      invoke: (callback: () => unknown) => callback(),
    });
    interaction.asAccessible().name({ get: () => authored });
    interaction.asAccessible().relation('labelledBy', { target: { get: () => '' } });
    interaction.asControlLabel().target(() => {});
    setup = false;
    cleanups.push(() => interaction.dispose());
    label.mount();
    interaction.mount();
    for (let index = 0; index < 3; index++) {
      interaction.refresh();
      expect(target.getAttribute('aria-labelledby')).toBe(label.node.id);
      expect(label.node.id).not.toBe('');
    }
    authored = 'Author name';
    interaction.refresh();
    expect(target.getAttribute('aria-label')).toBe('Author name');
    expect(target.hasAttribute('aria-labelledby')).toBe(false);
    authored = '';
    interaction.refresh();
    expect(target.getAttribute('aria-labelledby')).toBe(label.node.id);
  });

  it('preserves consumer ID and IDREF replacements while removing only its own token', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { label, target } = connect(),
      oldId = label.node.id;
    label.node.id = 'consumer-label';
    target.node.setAttribute('aria-labelledby', oldId + ' consumer-other');
    target.controller.refresh();
    expect(label.node.id).toBe('consumer-label');
    expect(target.node.getAttribute('aria-labelledby')).toBe('consumer-other');
    target.dispose();
    expect(label.node.id).toBe('consumer-label');
    expect(target.node.getAttribute('aria-labelledby')).toBe('consumer-other');
  });

  it('retains a generated source ID until an independently emitted consumer releases it', () => {
    const { label, target } = connect(),
      id = label.node.id;
    const receipt = loadNative().retainGeneratedId(label.node, id);
    expect(receipt).not.toBeNull();
    target.dispose();
    expect(label.node.id).toBe(id);
    receipt!.dispose();
    receipt!.dispose();
    expect(label.node.hasAttribute('id')).toBe(false);
  });

  it('withdraws and recovers naming after a sibling ID collision without explicit refresh', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ref = createControlLabelRef(),
      source = document.createElement('span');
    source.id = 'authored-source';
    document.body.append(source);
    const label = participant(loadNative(), 'label', ref, source),
      target = participant(loadNative(), 'target', ref);
    label.mount();
    target.mount();
    expect(target.node.getAttribute('aria-labelledby')).toBe('authored-source');
    const collision = document.createElement('span');
    collision.id = 'authored-source';
    document.body.append(collision);
    await mutations();
    expect(target.node.hasAttribute('aria-labelledby')).toBe(false);
    collision.remove();
    await mutations();
    expect(target.node.getAttribute('aria-labelledby')).toBe('authored-source');
  });

  it('recovers an initially ambiguous source ID when the sibling collision leaves', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ref = createControlLabelRef(),
      source = document.createElement('span'),
      collision = document.createElement('span');
    source.id = collision.id = 'initial-collision';
    document.body.append(source, collision);
    const label = participant(loadNative(), 'label', ref, source),
      target = participant(loadNative(), 'target', ref);
    label.mount();
    target.mount();
    expect(target.node.hasAttribute('aria-labelledby')).toBe(false);
    collision.remove();
    await mutations();
    expect(target.node.getAttribute('aria-labelledby')).toBe('initial-collision');
  });

  it.each(['naming-disabled', 'label-disposed'])(
    'retires initial-conflict observation after %s',
    async (reason) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ref = createControlLabelRef(),
        source = document.createElement('span'),
        duplicate = document.createElement('span');
      source.id = duplicate.id = 'retired-conflict';
      document.body.append(source, duplicate);
      const label = participant(loadNative(), 'label', ref, source),
        target = participant(loadNative(), 'target', ref);
      label.mount();
      target.mount();
      expect(target.node.hasAttribute('aria-labelledby')).toBe(false);
      if (reason === 'naming-disabled') label.stopNaming();
      else label.dispose();
      await mutations();
      const reads = vi.spyOn(source, 'getAttribute');
      duplicate.id = 'unrelated-name';
      await mutations();
      expect(reads.mock.calls.filter(([name]) => name === 'id')).toEqual([]);
      expect(target.node.hasAttribute('aria-labelledby')).toBe(false);
    }
  );

  it('retires an acquisition interrupted by synchronous target disposal', () => {
    const ref = createControlLabelRef(),
      label = participant(loadNative(), 'label', ref),
      target = participant(loadNative(), 'target', ref);
    label.mount();
    const original = label.node.setAttribute.bind(label.node);
    vi.spyOn(label.node, 'setAttribute').mockImplementation((name, value) => {
      original(name, value);
      if (name === 'id') target.dispose();
    });
    target.mount();
    expect(label.node.hasAttribute('id')).toBe(false);
    expect(target.node.hasAttribute('aria-labelledby')).toBe(false);
  });

  it.each([false, true])(
    'retains the synchronous successor ID before observer delivery, acquisition throws=%s',
    (throws) => {
      const firstRef = createControlLabelRef(),
        nextRef = createControlLabelRef();
      const label = participant(loadNative(), 'label', firstRef);
      const first = participant(loadNative(), 'target', firstRef);
      const next = participant(loadNative(), 'target', nextRef);
      label.mount();
      next.mount();
      const original = label.node.setAttribute.bind(label.node);
      const failure = new Error('interrupted original ID write');
      let interrupted = false;
      vi.spyOn(label.node, 'setAttribute').mockImplementation((name, value) => {
        original(name, value);
        if (name === 'id' && !interrupted) {
          interrupted = true;
          label.associate({ controlLabel: nextRef });
          if (throws) throw failure;
        }
      });
      let caught: unknown;
      try {
        first.mount();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(throws ? failure : undefined);
      // This assertion is synchronous: an observer must not repair a broken receipt.
      expect(label.node.id).not.toBe('');
      expect(next.node.getAttribute('aria-labelledby')).toBe(label.node.id);
      expect(first.node.hasAttribute('aria-labelledby')).toBe(false);
      const nextId = label.node.id;
      first.dispose();
      expect(label.node.id).toBe(nextId);
      expect(next.node.getAttribute('aria-labelledby')).toBe(nextId);
      next.dispose();
      expect(label.node.hasAttribute('id')).toBe(false);
    }
  );

  it('preserves the first write error and generated provenance after a failed rollback, then retries', () => {
    const ref = createControlLabelRef(),
      label = participant(loadNative(), 'label', ref),
      target = participant(loadNative(), 'target', ref);
    label.mount();
    const originalSet = label.node.setAttribute.bind(label.node),
      originalRemove = label.node.removeAttribute.bind(label.node);
    const writeFailure = new Error('ID write failed'),
      cleanupFailure = new Error('ID rollback failed');
    let failing = true;
    vi.spyOn(label.node, 'setAttribute').mockImplementation((name, value) => {
      originalSet(name, value);
      if (name === 'id' && failing) throw writeFailure;
    });
    vi.spyOn(label.node, 'removeAttribute').mockImplementation((name) => {
      if (name === 'id' && failing) throw cleanupFailure;
      originalRemove(name);
    });
    let caught: unknown;
    try {
      target.mount();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(writeFailure);
    expect(label.node.id).not.toBe('');
    expect(target.node.hasAttribute('aria-labelledby')).toBe(false);
    failing = false;
    target.controller.refresh();
    expect(target.node.getAttribute('aria-labelledby')).toBe(label.node.id);
    target.dispose();
    expect(label.node.hasAttribute('id')).toBe(false);
  });

  it('publishes a native ID receipt before a reentrant Runtime naming lease retains it', () => {
    const ref = createControlLabelRef(),
      label = participant(loadNative(), 'label', ref),
      target = participant(loadNative(), 'target', ref);
    label.mount();
    const runtimeNode = document.createElement('button');
    document.body.append(runtimeNode);
    const runtimeRef = createA11ySemanticObjectRef(),
      registry = createWebA11yProjectionRegistry();
    const project = registry.createProjector(() => runtimeNode);
    const empty = { objectRef: runtimeRef, states: {}, actions: {}, relations: {} };
    project(empty);
    const source: {
      current: ReturnType<NonNullable<typeof project.acquireControlLabelSource>>;
    } = { current: null };
    cleanups.push(() => {
      source.current?.dispose();
      project.dispose?.();
    });
    const original = label.node.setAttribute.bind(label.node);
    let reentered = false;
    vi.spyOn(label.node, 'setAttribute').mockImplementation((name, value) => {
      original(name, value);
      if (name === 'id' && !reentered) {
        reentered = true;
        source.current = project.acquireControlLabelSource!(
          {},
          { identity: label.node, scope: document }
        );
        expect(source.current).not.toBeNull();
        project({ ...empty, relations: { labelledBy: [source.current!.objectRef] } });
      }
    });
    target.mount();
    const id = label.node.id;
    expect(id).not.toBe('');
    target.dispose();
    expect(label.node.id).toBe(id);
    expect(runtimeNode.getAttribute('aria-labelledby')).toBe(id);
    project(empty);
    source.current!.dispose();
    source.current = null;
    expect(label.node.hasAttribute('id')).toBe(false);
  });

  it('publishes a Runtime ID receipt before a reentrant native naming lease retains it', () => {
    const ref = createControlLabelRef(),
      label = participant(loadNative(), 'label', ref),
      target = participant(loadNative(), 'target', ref);
    label.mount();
    const runtimeNode = document.createElement('button');
    document.body.append(runtimeNode);
    const runtimeRef = createA11ySemanticObjectRef(),
      registry = createWebA11yProjectionRegistry();
    const project = registry.createProjector(() => runtimeNode);
    const empty = { objectRef: runtimeRef, states: {}, actions: {}, relations: {} };
    project(empty);
    const source = project.acquireControlLabelSource!(
      {},
      { identity: label.node, scope: document }
    )!;
    cleanups.push(() => {
      source.dispose();
      project.dispose?.();
    });
    const original = label.node.setAttribute.bind(label.node);
    let reentered = false;
    vi.spyOn(label.node, 'setAttribute').mockImplementation((name, value) => {
      original(name, value);
      if (name === 'id' && !reentered) {
        reentered = true;
        target.mount();
      }
    });
    project({ ...empty, relations: { labelledBy: [source.objectRef] } });
    const id = label.node.id;
    expect(id).not.toBe('');
    project(empty);
    source.dispose();
    expect(label.node.id).toBe(id);
    expect(target.node.getAttribute('aria-labelledby')).toBe(id);
    target.dispose();
    expect(label.node.hasAttribute('id')).toBe(false);
  });

  it('rejects serialized, structural, hidden-unknown and symbol association inputs', () => {
    const native = loadNative(),
      ref = createControlLabelRef();
    expect(native.validateNativeInstanceAssociations({ controlLabel: ref })).toEqual({
      controlLabel: ref,
    });
    for (const input of [
      'control-label',
      { controlLabel: {} },
      { controlLabel: 'id' },
      Object.defineProperty({ controlLabel: ref }, 'hidden', { value: true }),
      { controlLabel: ref, [Symbol('unknown')]: true },
    ])
      expect(() => native.validateNativeInstanceAssociations(input)).toThrow();
    expect(() => JSON.stringify(ref)).toThrow(/cannot be serialized/);
  });

  it('emits no ControlLabel support for a graph with no reached declaration', () => {
    const plain = nativeSupportArtifacts(nativeSupportPlanFromFeatures(['a11y']));
    expect(plain.some((file) => file.path.includes('control-label'))).toBe(false);
    const plan = nativeSupportPlanFromFeatures(['control-label']);
    const reached = nativeSupportArtifacts(plan);
    expect(reached.some((file) => file.path === nativeControlLabelArtifact.path)).toBe(true);
    const paths = new Set(reached.map((file) => file.path));
    const imports = (contents: string) =>
      ts
        .createSourceFile('support.ts', contents, ts.ScriptTarget.Latest, true)
        .statements.filter(ts.isImportDeclaration)
        .map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text);
    expect(imports(reached.find((file) => file.path === plan.interactionPath)!.contents)).toContain(
      './control-label-v1'
    );
    for (const file of plain) expect(imports(file.contents)).not.toContain('./control-label-v1');
    for (const file of reached)
      for (const specifier of imports(file.contents)) {
        if (!specifier.startsWith('.')) continue;
        expect(
          paths.has(path.posix.join(path.posix.dirname(file.path), specifier) + '.ts'),
          `Closed ordinary import: ${file.path} -> ${specifier}`
        ).toBe(true);
      }
  });
});
