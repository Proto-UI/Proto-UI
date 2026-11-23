/**
 * Host-only, borrowed application canvas source. The exact implementation is
 * also emitted for native consumers. It does not evaluate a Prototype graph,
 * capture DOM paint, select a component, or own the application's source.
 */
import {
  createWebShaderPresenter,
  validateWebShaderPublication,
  type NativeShaderSource,
  type NativeShaderResource,
  type WebShaderPaintDevice,
  type WebShaderPublication,
} from './shader-webgl2-host';

/** Structurally compatible with CanvasBackdropLease's read-only capability. */
export interface WebShaderCanvasSceneLease {
  current(): Readonly<{
    revision: number;
    width: number;
    height: number;
    /** Independent opaque sRGB8, top-left. The provider must not mutate a frame. */
    pixels: Uint8Array;
    canvas: HTMLCanvasElement;
    scope: HTMLElement;
  }> | null;
  subscribe(invalidate: () => void): () => void;
}
export type WebShaderSceneBindings = Readonly<{
  /** Explicit per-owner bindings. These capabilities are never Props or IR data. */
  ownedScenes?: Readonly<Record<string, WebShaderCanvasSceneLease>>;
}>;
export type WebShaderSceneProgram = (
  device: WebShaderPaintDevice,
  source: NativeShaderSource
) => NativeShaderResource;
type SceneFrame = NonNullable<ReturnType<WebShaderCanvasSceneLease['current']>>;
export type WebShaderScenePublication = WebShaderPublication &
  Readonly<{
    slot: string;
    /** Source plus the statically selected intermediate resources. */
    resources: number;
  }>;
export interface WebShaderScenePresenter {
  commit(
    frame: WebShaderScenePublication,
    program: WebShaderSceneProgram,
    prepare?: () => void
  ): void;
  release(view: number): void;
  dispose(): void;
  diagnostics(): readonly string[];
}
export type WebShaderHostOptions = Readonly<{
  /** Explicit physical capability. Unselected owners do not construct or read it. */
  createScenePresenter(
    options: Readonly<{ root(): HTMLElement | null; prepare(): void }>
  ): WebShaderScenePresenter;
}>;

/** Select this source capability explicitly; ordinary Runtime imports retain none of it. */
export function createWebShaderHost(bindings: WebShaderSceneBindings): WebShaderHostOptions {
  return Object.freeze({
    createScenePresenter(options) {
      return createWebShaderScenePresenter({ ...options, host: bindings });
    },
  });
}

function composedContains(scope: HTMLElement, target: HTMLElement): boolean {
  let node: Element | null = target;
  const visited = new Set<Element>();
  while (node && !visited.has(node)) {
    if (node === scope) return true;
    visited.add(node);
    const tree = node.getRootNode();
    node =
      node.assignedSlot ??
      node.parentElement ??
      (tree.nodeType === 11 && 'host' in tree ? (tree as ShadowRoot).host : null);
  }
  return false;
}
function sourceTrees(...elements: HTMLElement[]): Node[] {
  const trees = new Set<Node>();
  for (const element of elements) {
    trees.add(element.ownerDocument);
    let node: Element | null = element;
    const visited = new Set<Element>();
    while (node && !visited.has(node)) {
      visited.add(node);
      const tree = node.getRootNode();
      trees.add(tree);
      node =
        node.assignedSlot ??
        node.parentElement ??
        (tree.nodeType === 11 && 'host' in tree ? (tree as ShadowRoot).host : null);
    }
  }
  return [...trees];
}
function scoped(root: HTMLElement | null, frame: SceneFrame): root is HTMLElement {
  return (
    !!root?.isConnected &&
    frame.scope.isConnected &&
    frame.canvas.isConnected &&
    root !== frame.scope &&
    root.ownerDocument === frame.scope.ownerDocument &&
    root.ownerDocument === frame.canvas.ownerDocument &&
    frame.canvas.parentElement === frame.scope &&
    composedContains(frame.scope, root) &&
    !composedContains(root, frame.canvas) &&
    frame.canvas.width === frame.width &&
    frame.canvas.height === frame.height
  );
}
function snapshot(frame: SceneFrame, resources: number): NativeShaderSource {
  const { width, height, pixels } = frame;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 1024 ||
    height > 1024 ||
    width * height > 262144 ||
    !Number.isSafeInteger(resources) ||
    resources < 2 ||
    resources > 17 ||
    resources * width * height * 4 > 16 * 1024 * 1024 ||
    !ArrayBuffer.isView(pixels) ||
    pixels.BYTES_PER_ELEMENT !== 1 ||
    pixels.length !== width * height * 4
  )
    throw new Error('shader-scene-resource-budget');
  const owned: number[] = new Array(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] !== 255) throw new Error('shader-scene-nonopaque');
    for (let c = 0; c < 3; c++) {
      const value = pixels[i + c];
      if (!Number.isInteger(value) || value < 0 || value > 255)
        throw new Error('shader-scene-invalid-pixels');
      const srgb = value / 255;
      owned[i + c] = Math.round(
        255 * (srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4)
      );
    }
    owned[i + 3] = 255;
  }
  return Object.freeze({ width, height, pixels: Object.freeze(owned) });
}

/** Whole scene texture uses the same normalized surface UV as owned-pixels. */
export function createWebShaderScenePresenter(options: {
  root(): HTMLElement | null;
  prepare(): void;
  host?: WebShaderSceneBindings;
}): WebShaderScenePresenter {
  const physical = createWebShaderPresenter(options);
  const reasons = new Set<string>();
  type Binding = {
    frame: WebShaderScenePublication;
    program: WebShaderSceneProgram;
    source: WebShaderCanvasSceneLease | null;
    off: (() => void) | null;
    observer: MutationObserver | null;
    trees: Node[];
    notifyTree: (() => void) | null;
    document: Document | null;
    root: HTMLElement | null;
    observedFrame: SceneFrame | null;
    sourceAvailable: boolean;
    live: boolean;
    acquiring: boolean;
    draining: boolean;
    dirty: boolean;
  };
  const seenSources = new WeakMap<
    WebShaderCanvasSceneLease,
    { revision: number; frame: SceneFrame }
  >();
  let active: Binding | null = null;
  let last: WebShaderScenePublication | null = null;
  let physicalRevision = 0,
    releasedView = -1,
    disposed = false;
  const live = (binding: Binding) => !disposed && active === binding && binding.live;
  const diagnose = (reason: string) => {
    reasons.add(reason);
  };
  function unwatch(binding: Binding) {
    binding.observer?.disconnect();
    binding.observer = null;
    if (binding.notifyTree)
      for (const tree of binding.trees) tree.removeEventListener('slotchange', binding.notifyTree);
    binding.notifyTree = null;
    binding.trees = [];
  }
  function stop(binding: Binding | null) {
    if (!binding) return;
    binding.live = false;
    const off = binding.off;
    binding.off = null;
    unwatch(binding);
    if (off)
      try {
        off();
      } catch {
        diagnose('shader-scene-cleanup-failed');
      }
  }
  function fallback(binding: Binding, prepare = () => {}) {
    if (live(binding))
      physical.commit({ ...binding.frame, revision: ++physicalRevision }, null, prepare);
  }
  function drain(binding: Binding) {
    if (!live(binding) || binding.acquiring || binding.draining) return;
    binding.draining = true;
    try {
      let turns = 0;
      while (live(binding) && binding.dirty && turns++ < 8) {
        binding.dirty = false;
        binding.sourceAvailable = false;
        // Invalidation retires pending decode before any source callback is invoked.
        fallback(binding);
        if (!live(binding)) return;
        const source = binding.source!;
        let frame: SceneFrame | null;
        try {
          frame = source.current();
        } catch {
          diagnose('shader-scene-current-failed');
          continue;
        }
        if (!live(binding)) return;
        if (!frame) {
          diagnose('shader-scene-unavailable');
          continue;
        }
        try {
          const revision = frame.revision;
          const seen = seenSources.get(source);
          if (
            !Number.isSafeInteger(revision) ||
            revision < 0 ||
            (seen &&
              (revision < seen.revision || (revision === seen.revision && seen.frame !== frame)))
          )
            throw new Error('shader-scene-stale-revision');
          seenSources.set(source, { revision, frame });
          const root = options.root();
          if (!scoped(root, frame)) throw new Error('shader-scene-scope-unavailable');
          const document = root.ownerDocument;
          const trees = sourceTrees(root, frame.scope, frame.canvas);
          if (
            binding.document !== document ||
            trees.length !== binding.trees.length ||
            trees.some((tree) => !binding.trees.includes(tree))
          ) {
            unwatch(binding);
            binding.document = document;
            binding.trees = trees;
            const Observer = document.defaultView?.MutationObserver;
            if (Observer) {
              const notify = () => {
                if (!live(binding)) return;
                const current = options.root();
                const nextTrees =
                  current &&
                  binding.observedFrame &&
                  sourceTrees(current, binding.observedFrame.scope, binding.observedFrame.canvas);
                if (
                  !binding.sourceAvailable ||
                  current !== binding.root ||
                  current?.ownerDocument !== binding.document ||
                  !binding.observedFrame ||
                  !scoped(current, binding.observedFrame) ||
                  !nextTrees ||
                  nextTrees.length !== binding.trees.length ||
                  nextTrees.some((tree) => !binding.trees.includes(tree))
                ) {
                  binding.dirty = true;
                  drain(binding);
                }
              };
              binding.notifyTree = notify;
              binding.observer = new Observer(notify);
              for (const tree of trees) {
                binding.observer.observe(tree, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['width', 'height', 'slot', 'name'],
                });
                tree.addEventListener('slotchange', notify);
              }
            }
          }
          binding.root = root;
          binding.observedFrame = frame;
          const owned = snapshot(frame, binding.frame.resources);
          const inputCurrent = () => {
            if (!live(binding)) return false;
            try {
              return (
                source.current() === frame &&
                frame!.revision === revision &&
                live(binding) &&
                options.root() === root &&
                root.ownerDocument === document &&
                scoped(root, frame!)
              );
            } catch {
              diagnose('shader-scene-current-failed');
              return false;
            }
          };
          if (!inputCurrent()) {
            diagnose('shader-scene-source-retired');
            continue;
          }
          binding.sourceAvailable = true;
          physical.commit(
            { ...binding.frame, revision: ++physicalRevision },
            (device) => binding.program(device, owned),
            () => {},
            inputCurrent
          );
        } catch (error) {
          diagnose(
            error instanceof Error && /^shader-scene-[a-z-]+$/.test(error.message)
              ? error.message
              : 'shader-scene-source-failed'
          );
        }
      }
      if (live(binding) && binding.dirty) {
        diagnose('shader-scene-reentrant-source');
        fallback(binding);
        stop(binding);
      }
    } finally {
      binding.draining = false;
    }
  }
  return {
    commit(
      frame: WebShaderScenePublication,
      program: WebShaderSceneProgram,
      prepare = options.prepare
    ) {
      if (disposed) return;
      validateWebShaderPublication(frame);
      if (
        frame.view <= releasedView ||
        (last &&
          (frame.view < last.view || (frame.view === last.view && frame.revision < last.revision)))
      ) {
        diagnose('shader-stale-frame');
        return;
      }
      last = Object.freeze({
        ...frame,
        fallback: Object.freeze([...frame.fallback]) as typeof frame.fallback,
      });
      const previous = active;
      const binding: Binding = {
        frame: last,
        program,
        source: null,
        off: null,
        live: true,
        observer: null,
        trees: [],
        notifyTree: null,
        document: null,
        root: null,
        observedFrame: null,
        sourceAvailable: false,
        acquiring: true,
        draining: false,
        dirty: true,
      };
      active = binding;
      // Retire GPU work before cleanup, configuration, or subscribe can reenter.
      try {
        fallback(binding, prepare);
      } finally {
        stop(previous);
      }
      if (!live(binding)) return;
      try {
        const map = options.host && Object.getOwnPropertyDescriptor(options.host, 'ownedScenes');
        const entry =
          map &&
          'value' in map &&
          map.value &&
          Object.getOwnPropertyDescriptor(map.value, frame.slot);
        const source =
          entry && 'value' in entry ? (entry.value as WebShaderCanvasSceneLease) : null;
        if (
          !source ||
          typeof source.current !== 'function' ||
          typeof source.subscribe !== 'function'
        ) {
          diagnose('shader-scene-unbound-slot');
          return;
        }
        binding.source = source;
        const off = source.subscribe(() => {
          if (!live(binding)) return;
          binding.dirty = true;
          drain(binding);
        });
        if (typeof off !== 'function') throw new Error('Invalid source subscription cleanup');
        if (!live(binding)) {
          try {
            off();
          } catch {
            diagnose('shader-scene-cleanup-failed');
          }
          return;
        }
        binding.off = off;
      } catch {
        diagnose('shader-scene-subscribe-failed');
        stop(binding);
        return;
      } finally {
        binding.acquiring = false;
      }
      drain(binding);
    },
    release(view: number) {
      if (!last || last.view !== view) return;
      releasedView = Math.max(releasedView, view);
      const previous = active;
      active = null;
      physical.release(view);
      stop(previous);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const previous = active;
      active = null;
      physical.dispose();
      stop(previous);
    },
    diagnostics(): readonly string[] {
      return Object.freeze([...new Set([...reasons, ...physical.diagnostics()])]);
    },
  };
}
