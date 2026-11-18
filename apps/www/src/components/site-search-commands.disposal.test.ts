import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDocumentationSearchCommands, searchCommandParticipant } from './site-search-commands';
import { PREFERRED_ADAPTER_EVENT, PREFERRED_ADAPTER_KEY } from './adapter-preference';
import type { MaterializedProjectionCandidate } from './PrototypePreviewer/projection-materializer';
import { WEBSITE_SHADCN_THEME_TOKENS } from './PrototypePreviewer/projection-theme';

// Only the Pagefind resource boundary is replaced. The participant, session,
// composition, controllers, materializer, loaders and WC Adapter are real.
const resource = vi.hoisted(() => ({ search: vi.fn(), dispose: vi.fn() }));
vi.mock('./site-pagefind-resource', () => ({
  createSitePagefindResource: () => ({
    load: async () => ({ search: resource.search }),
    dispose: resource.dispose,
  }),
}));

type Failure = { reason: unknown };
type DialogState = 'unstarted' | 'active' | 'pending';
const cleanups: Array<() => void | Promise<void>> = [];
const releases: Array<() => void> = [];
let previousRuntime: string | null;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

beforeEach(() => {
  previousRuntime = localStorage.getItem(PREFERRED_ADAPTER_KEY);
  localStorage.setItem(PREFERRED_ADAPTER_KEY, 'wc');
  resource.search.mockReset().mockResolvedValue({ results: [] });
  resource.dispose.mockReset();
});

afterEach(async () => {
  const errors: unknown[] = [];
  try {
    releases.splice(0).forEach((release) => release());
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
  } finally {
    vi.restoreAllMocks();
    if (previousRuntime === null) localStorage.removeItem(PREFERRED_ADAPTER_KEY);
    else localStorage.setItem(PREFERRED_ADAPTER_KEY, previousRuntime);
    document.body.replaceChildren();
  }
  if (errors.length) throw new AggregateError(errors, 'Search disposal fixture cleanup failed');
});

function track(
  candidate: MaterializedProjectionCandidate,
  failure?: Failure,
  onDisposeStart?: () => void
) {
  // Deliberate fault injection follows the actual disposer. Do not simulate
  // cleanup by removing DOM or replacing the projection controller.
  const dispose = vi.fn(async () => {
    onDisposeStart?.();
    await candidate.dispose();
    if (failure) throw failure.reason;
  });
  const activate = vi.fn(() => candidate.activate());
  return { original: candidate, candidate: { ...candidate, activate, dispose }, activate, dispose };
}
type TrackedCandidate = ReturnType<typeof track>;

function generationSurfaces(candidate: MaterializedProjectionCandidate) {
  const owner = candidate.host.dataset.projectionOwnerHost;
  const generation = candidate.host.dataset.projectionGenerationHost;
  expect(owner).toBeTruthy();
  expect(generation).toBeTruthy();
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `[data-projection-owner="${owner}"][data-projection-generation="${generation}"]`
    )
  );
}

function mount(
  state: DialogState,
  openerFailure?: Failure,
  dialogFailure?: Failure,
  onOpenerDispose?: () => void
) {
  const root = document.createElement('site-search');
  root.dataset.searchComposition = 'command-dialog';
  root.dataset.searchStyle = 'rhea';
  root.dataset.searchInitialFamily = 'shadcn';
  root.dataset.pagefindBundle = '/pagefind/';
  root.dataset.openLabel = 'Search documents';
  root.dataset.searchCopy = JSON.stringify({
    title: 'Search',
    description: 'Search documents',
    placeholder: 'Search',
    hint: 'Type to search',
    loading: 'Loading',
    empty: 'No results',
    error: 'Unavailable',
    retry: 'Retry',
    more: 'More',
    close: 'Close',
    count: '{count} documents',
  });
  root.innerHTML =
    '<div data-search-composition-mount><div data-search-command-mount="open"></div><div data-search-dialog-mount></div></div>';
  // Happy DOM does not inherit custom properties. These are explicit inputs
  // to the real theme reader on the same scopes used by the public-mode tests.
  for (const input of [
    root,
    ...root.querySelectorAll<HTMLElement>(
      '[data-search-command-mount], [data-search-dialog-mount]'
    ),
  ])
    for (const token of WEBSITE_SHADCN_THEME_TOKENS)
      input.style.setProperty(`--pui-${token}`, token.startsWith('radius') ? '0.5rem' : '#f5f5f5');
  document.body.append(root);
  const owner = searchCommandParticipant(root);
  // The data/session owner is separate from these projection controllers.
  cleanups.push(() => owner.dispose());
  const openers: TrackedCandidate[] = [];
  const dialogs: TrackedCandidate[] = [];
  cleanups.push(async () => {
    const results = await Promise.allSettled(
      [...openers, ...dialogs].map(({ original }) => original.dispose())
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  });
  const dialogGate = deferred<void>();
  releases.push(() => dialogGate.resolve());
  const dialogReached = deferred<TrackedCandidate>();
  const materialize = owner.materialize.bind(owner);
  const materializeDialog = owner.materializeDialog.bind(owner);
  const commandCalls = vi.spyOn(owner, 'materialize').mockImplementation(async (...args) => {
    const prepared = (await materialize(...args)).map((candidate) =>
      track(candidate, openerFailure, onOpenerDispose)
    );
    openers.push(...prepared);
    return prepared.map(({ candidate }) => candidate);
  });
  const dialogCalls = vi.spyOn(owner, 'materializeDialog').mockImplementation(async (...args) => {
    const prepared = track(await materializeDialog(...args), dialogFailure);
    dialogs.push(prepared);
    dialogReached.resolve(prepared);
    // The real composition and its leases already exist. Hold only delivery
    // to the controller so it must retire a genuinely pending materialization.
    if (state === 'pending') await dialogGate.promise;
    return prepared.candidate;
  });
  const onOpen = owner.onOpen!.bind(owner);
  const offOpen = vi.fn();
  vi.spyOn(owner, 'onOpen').mockImplementation((listener) => {
    const off = onOpen(listener);
    return () => {
      offOpen();
      off();
    };
  });
  // Start observing after the participant installs its separate owner listener.
  const added = vi.spyOn(document, 'addEventListener');
  const removed = vi.spyOn(document, 'removeEventListener');
  const scope = initDocumentationSearchCommands(owner);
  const scopeListeners = added.mock.calls.filter(
    ([type]) => type === 'focusin' || type === PREFERRED_ADAPTER_EVENT
  );
  expect(scopeListeners).toHaveLength(2);
  cleanups.push(async () => {
    try {
      await scope.destroy();
    } catch (error) {
      // Expected injected failures can recur on a shared teardown promise.
      if (![openerFailure, dialogFailure].some((fault) => fault && Object.is(fault.reason, error)))
        throw error;
    }
  });
  return {
    root,
    owner,
    scope,
    openers,
    dialogs,
    commandCalls,
    dialogCalls,
    offOpen,
    removed,
    scopeListeners,
    dialogReached: dialogReached.promise,
    releaseDialog: () => dialogGate.resolve(),
  };
}
type Fixture = ReturnType<typeof mount>;

async function ready(fixture: Fixture) {
  await fixture.scope.ready;
  expect(fixture.root.dataset.searchRuntime).toBe('wc');
  expect(fixture.openers).toHaveLength(1);
  expect(fixture.openers[0]!.activate).toHaveBeenCalledTimes(1);
  expect(fixture.root.querySelector('[data-open-modal]')).not.toBeNull();
}

async function openDialog(fixture: Fixture, state: 'active' | 'pending') {
  fixture.owner.open();
  const dialog = await fixture.dialogReached;
  expect(dialog.candidate.host.isConnected).toBe(true);
  if (state === 'active') {
    await vi.waitFor(() => {
      expect(dialog.activate).toHaveBeenCalledTimes(1);
      const panel = generationSurfaces(dialog.candidate).find(
        (node) => node.dataset.demoRef === 'panel'
      );
      expect(panel?.getAttribute('data-transition-state')).toBe('entered');
    });
  } else {
    expect(dialog.activate).not.toHaveBeenCalled();
    expect(dialog.candidate.host.inert).toBe(true);
  }
  const surfaces = generationSurfaces(dialog.candidate);
  expect(surfaces.length).toBeGreaterThan(0);
  return { dialog, surfaces };
}

function expectOutcome(result: PromiseSettledResult<void>, failure?: Failure) {
  if (!failure) expect(result.status).toBe('fulfilled');
  else {
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(Object.is(result.reason, failure.reason)).toBe(true);
  }
}

async function expectRetired(fixture: Fixture, surfaces: HTMLElement[]) {
  for (const tracked of [...fixture.openers, ...fixture.dialogs]) {
    expect(tracked.dispose).toHaveBeenCalledTimes(1);
    expect(tracked.candidate.host.isConnected).toBe(false);
    expect(generationSurfaces(tracked.candidate)).toHaveLength(0);
  }
  // Include surfaces/portals retained before teardown, not just a missing query.
  for (const surface of surfaces) expect(surface.isConnected).toBe(false);
  expect(fixture.offOpen).toHaveBeenCalledTimes(1);
  for (const call of fixture.scopeListeners) expect(fixture.removed).toHaveBeenCalledWith(...call);
  const commandCount = fixture.commandCalls.mock.calls.length;
  const dialogCount = fixture.dialogCalls.mock.calls.length;
  fixture.owner.toggle();
  fixture.owner.toggle();
  document.dispatchEvent(new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'wc' } }));
  await Promise.resolve();
  expect(fixture.commandCalls).toHaveBeenCalledTimes(commandCount);
  expect(fixture.dialogCalls).toHaveBeenCalledTimes(dialogCount);
  // Projection teardown must not consume the independent data owner's lease.
  expect(resource.dispose).not.toHaveBeenCalled();
}

describe('Docs Search exhaustive owned-controller disposal', () => {
  const openerFailure = { reason: new Error('Injected opener disposal failure') };
  const dialogFailure = { reason: new Error('Injected Dialog disposal failure') };
  const cases: Array<{
    name: string;
    state: 'unstarted' | 'active';
    opener?: Failure;
    dialog?: Failure;
  }> = [
    { name: 'unstarted Dialog, opener failure', state: 'unstarted', opener: openerFailure },
    { name: 'unstarted Dialog, successful cleanup', state: 'unstarted' },
    { name: 'active Dialog, opener failure', state: 'active', opener: openerFailure },
    {
      name: 'active Dialog, undefined opener rejection',
      state: 'active',
      opener: { reason: undefined },
    },
    {
      name: 'active Dialog, both disposers fail',
      state: 'active',
      opener: openerFailure,
      dialog: dialogFailure,
    },
    { name: 'active Dialog, only Dialog fails', state: 'active', dialog: dialogFailure },
    { name: 'active Dialog, successful cleanup', state: 'active' },
  ];
  it.each(cases)(
    '$name',
    async ({ state, opener, dialog }) => {
      const fixture = mount(state, opener, dialog);
      await ready(fixture);
      const surfaces = state === 'active' ? (await openDialog(fixture, state)).surfaces : [];
      if (state === 'unstarted') expect(fixture.dialogCalls).not.toHaveBeenCalled();
      const outcomes = await Promise.allSettled([fixture.scope.destroy(), fixture.scope.destroy()]);
      await expectRetired(fixture, surfaces);
      for (const outcome of outcomes) expectOutcome(outcome, opener ?? dialog);
      const later = await Promise.allSettled([fixture.scope.destroy()]);
      expectOutcome(later[0]!, opener ?? dialog);
    },
    15000
  );

  it.each([
    { name: 'opener failure', failure: openerFailure },
    { name: 'successful opener cleanup', failure: undefined },
  ])(
    'awaits pending Dialog and repeated destroy after $name',
    async ({ failure }) => {
      const fixture = mount('pending', failure);
      await ready(fixture);
      const { dialog, surfaces } = await openDialog(fixture, 'pending');
      const settled = [false, false];
      const pending = [fixture.scope.destroy(), fixture.scope.destroy()].map((result, index) =>
        result.then(
          () => {
            settled[index] = true;
          },
          (error) => {
            settled[index] = true;
            throw error;
          }
        )
      );
      const outcomes = Promise.allSettled(pending);
      // Observe one event-loop turn while the explicit gate remains closed.
      // This is a scheduling probe, not a changed product readiness deadline.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(fixture.openers[0]!.dispose).toHaveBeenCalledTimes(1);
      expect(settled).toEqual([false, false]);
      fixture.releaseDialog();
      for (const outcome of await outcomes) expectOutcome(outcome, failure);
      expect(dialog.activate).not.toHaveBeenCalled();
      await expectRetired(fixture, surfaces);
    },
    15000
  );

  it('shares pending teardown and its first error with synchronous disposer reentry', async () => {
    let reentered: Promise<void> | undefined;
    let fixture!: Fixture;
    const callbackReached = deferred<void>();
    fixture = mount('pending', openerFailure, undefined, () => {
      // The real disposer synchronously requests teardown again. Retain its
      // promise for the outside observer; never await the callback's own owner.
      reentered = fixture.scope.destroy();
      callbackReached.resolve();
    });
    await ready(fixture);
    const { dialog, surfaces } = await openDialog(fixture, 'pending');
    const outer = fixture.scope.destroy();
    // The real controller queues candidate disposal in a microtask. Observe
    // the callback itself rather than assuming it ran in destroy's own stack.
    await callbackReached.promise;
    expect(reentered).toBeDefined();
    const settled = [false, false];
    const outcomes = Promise.allSettled(
      [outer, reentered!].map((result, index) =>
        result.then(
          () => {
            settled[index] = true;
          },
          (error) => {
            settled[index] = true;
            throw error;
          }
        )
      )
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(settled).toEqual([false, false]);
    expect(reentered).toBe(outer);
    fixture.releaseDialog();
    for (const outcome of await outcomes) expectOutcome(outcome, openerFailure);
    expect(dialog.activate).not.toHaveBeenCalled();
    await expectRetired(fixture, surfaces);
  }, 15000);
});
