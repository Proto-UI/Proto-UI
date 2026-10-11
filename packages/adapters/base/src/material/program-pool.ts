import { inspectOpticalImageResources } from './image-prepare';
import { createWebOpticalProgram, type OpticalFrame } from './program';
/** One rendering context per document. Each surface receives its own immutable
 * paint image; source/view revocation still removes that image synchronously.
 * A gallery must not silently exhaust the browser's per-page WebGL contexts. */
const pools = new WeakMap<
  Document,
  {
    canvas: HTMLCanvasElement;
    program: ReturnType<typeof createWebOpticalProgram>;
    listeners: Set<() => void>;
    lost: boolean;
    owner: symbol | null;
    dispose(): void;
  }
>();
export function acquireWebOpticalProgram(document: Document, invalidated: () => void) {
  let pool = pools.get(document);
  if (!pool) {
    const canvas = document.createElement('canvas'),
      program = createWebOpticalProgram(canvas);
    const listeners = new Set<() => void>();
    const notify = () => {
      let error: unknown;
      for (const fn of [...listeners]) {
        try {
          fn();
        } catch (value) {
          error ??= value;
        }
      }
      if (error) throw error;
    };
    const current = {
      canvas,
      program,
      listeners,
      lost: false,
      owner: null as symbol | null,
      dispose() {
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
        if (program.dispose) program.dispose();
        else program.clear();
      },
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      current.lost = true;
      program.clear();
      notify();
    };
    const onRestored = () => {
      current.lost = false;
      notify();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    pools.set(document, current);
    pool = current;
  }
  const lease = pool;
  const owner = Symbol('optical-resource-owner');
  lease.listeners.add(invalidated);
  let retired = false;
  return {
    get lost() {
      return lease.lost;
    },
    render(frame: OpticalFrame) {
      if (retired || lease.lost) throw new Error('webgl-context-unavailable');
      lease.owner = owner;
      return lease.program.render(frame);
    },
    clear() {
      if (!retired && lease.owner === owner) {
        lease.program.clear();
        lease.owner = null;
      }
    },
    release() {
      if (retired) return;
      retired = true;
      if (lease.owner === owner) {
        lease.program.clear();
        lease.owner = null;
      }
      lease.listeners.delete(invalidated);
      if (lease.listeners.size === 0) {
        pools.delete(document);
        lease.dispose();
      }
    },
  };
}

/** Internal evidence hook. Counters are observations, never support facts. */
export function inspectWebOpticalResources(document: Document) {
  const pool = pools.get(document);
  return {
    contexts: pool ? 1 : 0,
    consumers: pool?.listeners.size ?? 0,
    lost: pool?.lost ?? false,
    ...(pool?.program.inspect?.() ?? {}),
    ...inspectOpticalImageResources(document),
  };
}
