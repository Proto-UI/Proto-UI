type HostCleanup = () => void;

type HostMountState = {
  generation: number;
  cleanup: HostCleanup | null;
};

export type HostMountLease = {
  isCurrent(): boolean;
  commit(cleanup: HostCleanup): boolean;
  release(): boolean;
};

const hostMounts = new WeakMap<HTMLElement, HostMountState>();

function getHostMount(host: HTMLElement): HostMountState {
  let state = hostMounts.get(host);
  if (!state) {
    state = { generation: 0, cleanup: null };
    hostMounts.set(host, state);
  }
  return state;
}

function disposeCurrent(state: HostMountState): void {
  const cleanup = state.cleanup;
  state.cleanup = null;
  cleanup?.();
}

function clearHost(host: HTMLElement): void {
  host.replaceChildren();
  // Vue 3 marks its mount container with `data-v-app`. The marker is owned by
  // the framework, not by the preview surface; clear it with the host lease so
  // a later Vue 2/React mount cannot be mistaken for a Vue 3 app.
  host.removeAttribute('data-v-app');
}

/**
 * Claims one host view generation across every Previewer runtime.
 *
 * A framework download may finish after another runtime has claimed the same
 * host. Such a completion must be a no-op: it may not create a root, mount an
 * app, append DOM, or replace the resource owned by the current generation.
 */
export function claimHostMount(host: HTMLElement): HostMountLease {
  const state = getHostMount(host);
  state.generation += 1;
  disposeCurrent(state);
  clearHost(host);

  const generation = state.generation;
  const isCurrent = () => state.generation === generation;

  return {
    isCurrent,
    commit(cleanup) {
      if (!isCurrent()) {
        cleanup();
        return false;
      }
      state.cleanup = cleanup;
      return true;
    },
    release() {
      if (!isCurrent()) return false;
      state.generation += 1;
      disposeCurrent(state);
      clearHost(host);
      return true;
    },
  };
}

export function releaseHostMount(host: HTMLElement): void {
  const state = getHostMount(host);
  state.generation += 1;
  disposeCurrent(state);
  clearHost(host);
}
