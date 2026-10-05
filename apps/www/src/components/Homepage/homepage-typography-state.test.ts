import { afterAll, beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retainHappyDomMutationCallbacks } from '../../../../../scripts/test/happy-dom-mutation-keepalive.mjs';
import { initHomepageRuntime } from './homepage-runtime-client';
import * as siteFamily from '../site-library-family';
import * as materialization from '../PrototypePreviewer/projection-materializer';
import {
  initAdapterSelects,
  PREFERRED_ADAPTER_EVENT,
  PREFERRED_ADAPTER_KEY,
} from '../adapter-preference';
import type { ProjectionCompositionControls } from '../PrototypePreviewer/projection-composition';
import type { MaterializedProjectionCandidate } from '../PrototypePreviewer/projection-materializer';

// Keep the pinned host's internal WeakRef forwarding closure alive, exactly as
// the other real typography suites do. Browser behavior and deadlines stay real.
let observerKeeper: ReturnType<typeof retainHappyDomMutationCallbacks>;
beforeAll(() => {
  observerKeeper = retainHappyDomMutationCallbacks(window);
});
afterAll(() => observerKeeper.restore());

type TypographyCandidate = MaterializedProjectionCandidate;
const preparation = vi.hoisted(() => ({
  next: null as null | ((candidate: TypographyCandidate) => Promise<TypographyCandidate>),
  count: 0,
}));
vi.mock('../site-typography', async (original) => {
  const actual = await original<typeof import('../site-typography')>();
  return {
    ...actual,
    siteTypographyParticipant(...args: Parameters<typeof actual.siteTypographyParticipant>) {
      const participant = actual.siteTypographyParticipant(...args);
      return {
        ...participant,
        async materialize(request: Parameters<typeof participant.materialize>[0]) {
          preparation.count++;
          const candidate = await participant.materialize(request);
          const next = preparation.next;
          preparation.next = null;
          return next ? next(candidate) : candidate;
        },
      };
    },
  };
});
vi.mock('../PrototypePreviewer/runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});

// Real homepage coordinator, materializer, gallery, Proto parts and WC Adapter.
// Only host media/theme inputs are injected; this is host-unit evidence, not paint.
vi.mock('../PrototypePreviewer/projection-theme', async (original) => {
  const actual = await original<typeof import('../PrototypePreviewer/projection-theme')>();
  return {
    ...actual,
    resolveProjectionThemeSurfaceStyle: () => ({ '--pui-background': '#fff' }),
    watchProjectionThemeSurfaceStyle: () => () => {},
  };
});

let handle: NonNullable<ReturnType<typeof initHomepageRuntime>> | undefined;
let media: MediaQueryList;
beforeEach(() => {
  localStorage.clear();
  preparation.next = null;
  preparation.count = 0;
  media = Object.assign(new EventTarget(), {
    matches: false,
    media: '(max-width: 47.999rem)',
    onchange: null,
  }) as MediaQueryList;
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  document.body.innerHTML = `<header data-homepage-runtime>
    <output data-homepage-runtime-status></output>
    <div id="navigation" data-homepage-actions data-homepage-controls="runtime">
      <div data-homepage-fallback><a href="/docs/">Docs</a></div>
      <div data-homepage-mount></div>
    </div>
  </header><main><h1 data-site-typography="slogan">Stable original source</h1>
    <section data-home-showcase="website-component-gallery" data-locale="en">
      <div data-home-demo-host></div><output data-home-demo-status></output>
    </section></main>`;
});
afterEach(async () => {
  await handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const ref = (name: string) => document.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
const note = () => ref('settings-note').querySelector('textarea')!;
const surface = () => document.querySelector('h1 [data-typography-prototype]')!;
function resize(compact: boolean) {
  Object.defineProperty(media, 'matches', { configurable: true, value: compact });
  media.dispatchEvent(new Event('change'));
}
function select(control: 'family' | 'runtime', value: string) {
  ref(`__pui_projection__${control}_root`).dispatchEvent(
    new CustomEvent('valueChange', { detail: { value } })
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
function holdNext() {
  const entered = deferred<TypographyCandidate>();
  const gate = deferred<void>();
  preparation.next = async (candidate) => {
    const wrapped = {
      ...candidate,
      activate: vi.fn(candidate.activate),
      dispose: vi.fn(candidate.dispose),
    };
    entered.resolve(wrapped);
    await gate.promise;
    return wrapped;
  };
  return { entered: entered.promise, release: () => gate.resolve() };
}

async function editGallery() {
  handle = initHomepageRuntime(document.querySelector('[data-homepage-runtime]')!)!;
  await expect.poll(() => handle!.getSnapshot().phase).toBe('ready');
  const summary = ref('settings-summary');
  summary.click();
  await expect.poll(() => summary.getAttribute('aria-checked')).toBe('true');
  const input = note();
  input.focus();
  input.value = 'Keep my unsaved note';
  input.setSelectionRange(5, 5);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: input.value }));
  await expect.poll(() => ref('settings-count').textContent).toBe('20 / 240 characters');
  expect(ref('settings').dataset.dirty).toBe('true');
  expect(ref('settings-save').getAttribute('aria-disabled')).toBe('false');
  return { input, summary, owner: ref('settings'), snapshot: handle!.getSnapshot() };
}

describe('homepage passive typography refresh preserves real gallery state', () => {
  for (const cause of ['viewport', 'new source heading'] as const) {
    it(`${cause}: keeps the original logical owners, draft, switch, caret and page snapshot`, async () => {
      const before = await editGallery();
      if (cause === 'viewport') {
        resize(true);
        await expect
          .poll(() =>
            document.querySelector('h1 [data-typography-prototype]')?.getAttribute('data-pui-style')
          )
          .toContain('text-2xl');
      } else {
        const heading = document.createElement('h2');
        heading.textContent = 'New source heading';
        document.querySelector('main')!.append(heading);
        await expect
          .poll(() => heading.querySelector('[data-typography-prototype]'))
          .not.toBeNull();
      }
      await expect.poll(() => handle!.getSnapshot().phase).toBe('ready');
      expect.soft(note().value).toBe('Keep my unsaved note');
      expect.soft(ref('settings-summary').getAttribute('aria-checked')).toBe('true');
      expect.soft(ref('settings').dataset.dirty).toBe('true');
      expect.soft(ref('settings-count').textContent).toBe('20 / 240 characters');
      expect.soft(ref('settings')).toBe(before.owner);
      expect.soft(note()).toBe(before.input);
      expect.soft(ref('settings-summary')).toBe(before.summary);
      expect.soft(document.activeElement).toBe(before.input);
      expect.soft(note().selectionStart).toBe(5);
      expect.soft(handle!.getSnapshot()).toEqual(before.snapshot);
      // The original owner must still process events after the typography update.
      ref('settings-save').click();
      await expect
        .poll(() => ref('settings-feedback').textContent)
        .toContain('Note: 20 characters');
    });
  }

  for (const failure of ['prepare', 'partial activate'] as const) {
    it(`${failure} failure keeps the current gallery, typography owner and page snapshot`, async () => {
      const before = await editGallery();
      const originalSurface = surface();
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      preparation.next = async (candidate) => {
        if (failure === 'prepare') {
          await candidate.dispose();
          throw new Error('injected local prepare failure');
        }
        return {
          ...candidate,
          activate() {
            candidate.activate();
            throw new Error('injected local activation failure');
          },
        };
      };
      resize(true);
      await expect.poll(() => error.mock.calls.length).toBe(1);
      expect(surface()).toBe(originalSurface);
      expect(handle!.getSnapshot()).toEqual(before.snapshot);
      expect(ref('settings')).toBe(before.owner);
      expect(note()).toBe(before.input);
      expect(note().value).toBe('Keep my unsaved note');
      expect(note().selectionStart).toBe(5);
      expect(document.activeElement).toBe(before.input);
      expect(before.summary.getAttribute('aria-checked')).toBe('true');
      await expect
        .poll(() => document.querySelectorAll('[data-site-typography-batch]').length)
        .toBe(1);
      // Cleanup mutations must not automatically retry the same failed source.
      // A genuine new source revision permits another passive attempt.
      document.querySelector('h1')!.append(' updated');
      await expect.poll(() => surface().getAttribute('data-pui-style')).toContain('text-2xl');
      expect(note()).toBe(before.input);
    });
  }

  it('coalesces source and viewport changes during local preparation without activating stale source', async () => {
    const before = await editGallery();
    const held = holdNext();
    resize(true);
    const pending = await held.entered;
    expect(handle!.getSnapshot()).toEqual(before.snapshot);
    before.input.value = 'Accepted during refresh';
    before.input.setSelectionRange(8, 8);
    before.input.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: before.input.value })
    );
    await expect.poll(() => ref('settings-count').textContent).toBe('23 / 240 characters');
    document.querySelector('h1')!.textContent = 'Latest translated source';
    const added = document.createElement('h2');
    added.textContent = 'Latest new heading';
    document.querySelector('main')!.append(added);
    resize(false);
    held.release();
    await expect.poll(() => added.querySelector('[data-typography-prototype]')).not.toBeNull();
    expect(pending.activate).not.toHaveBeenCalled();
    expect(pending.dispose).toHaveBeenCalledOnce();
    expect(surface().getAttribute('data-pui-style')).toContain('text-4xl');
    expect(document.querySelector('h1')!.textContent).toBe('Latest translated source');
    expect(handle!.getSnapshot()).toEqual(before.snapshot);
    expect(note()).toBe(before.input);
    expect(note().value).toBe('Accepted during refresh');
    expect(note().selectionStart).toBe(8);
    expect(document.activeElement).toBe(before.input);
  });

  it('a whole-page family commit revokes an older same-generation local preparation', async () => {
    await editGallery();
    const held = holdNext();
    resize(true);
    const pending = await held.entered;
    select('family', 'brutalist');
    await expect.poll(() => handle!.getSnapshot().selection.projectionFamilyId).toBe('brutalist');
    const nextSurface = surface();
    const snapshot = handle!.getSnapshot();
    const gallery = ref('settings');
    held.release();
    await expect.poll(() => pending.dispose).toHaveBeenCalledOnce();
    expect(pending.activate).not.toHaveBeenCalled();
    expect(surface()).toBe(nextSurface);
    expect(ref('settings')).toBe(gallery);
    expect(handle!.getSnapshot()).toEqual(snapshot);
    expect(nextSurface.getAttribute('data-typography-generation')).toBe(
      String(snapshot.generation)
    );
    expect(nextSurface.getAttribute('data-typography-family')).toBe('brutalist');
    expect(
      document.querySelector('[data-home-showcase]')!.getAttribute('data-projection-generation')
    ).toBe(String(snapshot.generation));
    expect(
      document.querySelector('[data-home-showcase]')!.getAttribute('data-projection-family')
    ).toBe('brutalist');
  });

  it('whole-page publication rollback restores the latest locally refreshed typography and live gallery', async () => {
    const before = await editGallery();
    resize(true);
    await expect.poll(() => surface().getAttribute('data-pui-style')).toContain('text-2xl');
    const refreshedSurface = surface();
    const applyFamily = siteFamily.applySiteLibraryFamily;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(siteFamily, 'applySiteLibraryFamily').mockImplementation((document, family) => {
      applyFamily(document, family);
      if (family === 'brutalist') throw new Error('injected page publication failure');
    });
    select('family', 'brutalist');
    await expect
      .poll(
        () => document.querySelector<HTMLElement>('[data-homepage-runtime]')!.dataset.runtimeState
      )
      .toBe('error');
    expect(handle!.getSnapshot()).toEqual(before.snapshot);
    expect(surface()).toBe(refreshedSurface);
    expect(ref('settings')).toBe(before.owner);
    expect(note()).toBe(before.input);
    expect(note().value).toBe('Keep my unsaved note');
    expect(before.summary.getAttribute('aria-checked')).toBe('true');
    ref('settings-save').click();
    await expect.poll(() => ref('settings-feedback').textContent).toContain('Note: 20 characters');
    await handle!.destroy();
    handle = undefined;
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-typography-prototype]')).toHaveLength(0);
  });

  it('a source added during a whole-page runtime preparation joins its committed generation without a second page commit', async () => {
    await editGallery();
    const held = holdNext();
    select('runtime', 'react');
    await held.entered;
    const added = document.createElement('h2');
    added.textContent = 'Added during React preparation';
    document.querySelector('main')!.append(added);
    held.release();
    await expect.poll(() => added.getAttribute('data-typography-runtime')).toBe('react');
    const snapshot = handle!.getSnapshot();
    expect(snapshot).toEqual({
      phase: 'ready',
      generation: 2,
      selection: { runtimeId: 'react', projectionFamilyId: 'shadcn' },
    });
    expect(added.getAttribute('data-typography-generation')).toBe('2');
    expect(
      document.querySelector('[data-home-showcase]')!.getAttribute('data-projection-generation')
    ).toBe('2');
    expect(
      document.querySelector('[data-home-showcase]')!.getAttribute('data-projection-runtime')
    ).toBe('react');
    expect(surface().getAttribute('data-typography-runtime')).toBe('react');
    expect(localStorage.getItem('preferred-prototypes-adapter')).toBe('react');
  });

  it('destroy waits for and retires an in-flight local batch without reviving source or framework owners', async () => {
    await editGallery();
    const held = holdNext();
    resize(true);
    const pending = await held.entered;
    const destroyed = handle!.destroy();
    held.release();
    await destroyed;
    handle = undefined;
    expect(pending.activate).not.toHaveBeenCalled();
    expect(pending.dispose).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('[data-site-typography-batch]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-typography-prototype]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-projection-generation-host]')).toHaveLength(0);
    expect(document.querySelector('h1')!.textContent).toBe('Stable original source');
  });

  for (const change of ['change role', 'remove role', 'new marker'] as const) {
    it(`${change}: observes only the authored change, keeps gallery state and settles after one batch`, async () => {
      const text = document.createTextNode('Native inline caption');
      const span = document.createElement('span');
      span.append(text);
      document.querySelector('main')!.append(span);
      const before = await editGallery();
      // Let startup and gallery observer deliveries finish, as in the independent
      // red probe. The sole trigger below is an authored attribute mutation.
      await new Promise((resolve) => setTimeout(resolve, 100));
      const baseline = preparation.count;
      const h1 = document.querySelector<HTMLElement>('h1')!;
      const source = h1.querySelector('[data-site-typography-slot]')!.firstChild;
      if (change === 'change role') h1.dataset.siteTypography = 'h2';
      else if (change === 'remove role') h1.removeAttribute('data-site-typography');
      else span.dataset.siteTypography = 'caption';
      const target = change === 'new marker' ? span : h1;
      const role = change === 'change role' ? 'h2' : change === 'remove role' ? 'h1' : 'caption';
      const observationStarted = performance.now();
      try {
        await expect
          .poll(
            () =>
              target
                .querySelector('[data-typography-prototype]')
                ?.getAttribute('data-typography-role'),
            { timeout: 500 }
          )
          .toBe(role);
      } catch (error) {
        // Retain the original deadline/failure; distinguish missing observer
        // admission from a pending materialization on a contended runner.
        console.error('[homepage-typography-role-diagnostic]', {
          change,
          role,
          elapsedMs: performance.now() - observationStarted,
          authoredRole: target.getAttribute('data-site-typography'),
          projectedRole: target
            .querySelector('[data-typography-prototype]')
            ?.getAttribute('data-typography-role'),
          baseline,
          materializations: preparation.count,
          page: handle?.getSnapshot(),
          connected: target.isConnected,
          batches: document.querySelectorAll('[data-site-typography-batch]').length,
        });
        throw error;
      }
      // Real observer deliveries and self-authored projection metadata must not
      // cause another materialization after this passive batch is published.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(preparation.count).toBe(baseline + 1);
      expect(h1.querySelector('[data-site-typography-slot]')!.firstChild).toBe(source);
      if (change === 'new marker') {
        expect(span.querySelector('[data-site-typography-slot]')!.firstChild).toBe(text);
        span.removeAttribute('data-site-typography');
        await expect.poll(() => span.querySelector('[data-typography-prototype]')).toBeNull();
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(preparation.count).toBe(baseline + 2);
        expect(span.firstChild).toBe(text);
      }
      expect(handle!.getSnapshot()).toEqual(before.snapshot);
      expect(ref('settings')).toBe(before.owner);
      expect(note()).toBe(before.input);
      expect(note().value).toBe('Keep my unsaved note');
      expect(note().selectionStart).toBe(5);
      expect(document.activeElement).toBe(before.input);
      expect(before.summary.getAttribute('aria-checked')).toBe('true');
      ref('settings-save').click();
      await expect
        .poll(() => ref('settings-feedback').textContent)
        .toContain('Note: 20 characters');
    });
  }

  it('keeps language and complete textContent replacement fresh in the same page generation', async () => {
    const before = await editGallery();
    const h1 = document.querySelector<HTMLElement>('h1')!;
    h1.lang = 'zh-CN';
    h1.textContent = '保持完全相同的原始语义';
    const source = h1.firstChild;
    await expect
      .poll(() => h1.querySelector('[data-site-typography-slot]')?.firstChild)
      .toBe(source);
    expect(h1.textContent).toBe('保持完全相同的原始语义');
    expect(h1.lang).toBe('zh-CN');
    expect(handle!.getSnapshot()).toEqual(before.snapshot);
    expect(note()).toBe(before.input);
    expect(note().value).toBe('Keep my unsaved note');
  });

  it('reconciles source changes arriving while a failed local batch is being disposed', async () => {
    const before = await editGallery();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const disposing = deferred<void>();
    const release = deferred<void>();
    preparation.next = async (candidate) => ({
      ...candidate,
      activate() {
        candidate.activate();
        throw new Error('local activation failed');
      },
      async dispose() {
        disposing.resolve();
        await release.promise;
        await candidate.dispose();
      },
    });
    resize(true);
    await disposing.promise;
    const added = document.createElement('h2');
    added.textContent = 'Source during failed cleanup';
    document.querySelector('main')!.append(added);
    await new Promise((resolve) => setTimeout(resolve, 60));
    release.resolve();
    await expect
      .poll(() => added.querySelector('[data-typography-prototype]'), { timeout: 700 })
      .not.toBeNull();
    expect(handle!.getSnapshot()).toEqual(before.snapshot);
    expect(note()).toBe(before.input);
  });
});

it('publishes a committed runtime preference when a live family request supersedes its pending retirement observer', async () => {
  const entered = deferred<void>();
  const releaseRetirement = deferred<void>();
  preparation.next = async (candidate) => ({
    ...candidate,
    async dispose() {
      entered.resolve();
      await releaseRetirement.promise;
      await candidate.dispose();
    },
  });
  let controls: ProjectionCompositionControls | undefined;
  const materialize = materialization.materializeProjectionCandidate;
  vi.spyOn(materialization, 'materializeProjectionCandidate').mockImplementation((...args) => {
    if (args[1].controlIds?.includes('runtime')) controls = args[1].controls;
    return materialize(...args);
  });
  const independent = document.createElement('div');
  independent.dataset.adapterSelect = '';
  independent.innerHTML =
    '<select><option value="wc">WC</option><option value="react">React</option></select>';
  document.body.append(independent);
  initAdapterSelects(independent);
  const events: string[] = [];
  const listener = (event: Event) => events.push((event as CustomEvent).detail.adapter);
  document.addEventListener(PREFERRED_ADAPTER_EVENT, listener);
  try {
    handle = initHomepageRuntime(document.querySelector('[data-homepage-runtime]')!)!;
    await expect.poll(() => handle!.getSnapshot().phase).toBe('ready');
    select('runtime', 'react'); // Actual current WC control event channel.
    await entered.promise;
    expect(handle.getSnapshot().selection.runtimeId).toBe('react');
    expect(handle.getSnapshot().phase).toBe('ready');
    const familyTrigger = ref('__pui_projection__family_trigger');
    expect(
      familyTrigger
        .closest('[data-projection-generation-state]')!
        .getAttribute('data-projection-generation-state')
    ).toBe('active');
    expect(familyTrigger.getAttribute('aria-disabled')).not.toBe('true');
    expect(localStorage.getItem(PREFERRED_ADAPTER_KEY)).toBeNull();
    expect(events).toEqual([]);
    // Invoke the real active React composition's accepted family callback;
    // this is an unlocked committed owner, not a forced event on a locked one.
    controls!.family.onValueChange('brutalist');
    await expect
      .poll(() => handle!.getSnapshot().selection.projectionFamilyId, { timeout: 10000 })
      .toBe('brutalist');
    await expect
      .poll(
        () => document.querySelector<HTMLElement>('[data-homepage-runtime]')!.dataset.runtimeState
      )
      .toBe('ready');
    expect(handle.getSnapshot().selection.runtimeId).toBe('react');
    expect(localStorage.getItem(PREFERRED_ADAPTER_KEY)).toBe('react');
    expect(independent.querySelector('select')!.value).toBe('react');
    expect(events).toEqual(['react']);
    releaseRetirement.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(['react']);
  } finally {
    releaseRetirement.resolve();
    document.removeEventListener(PREFERRED_ADAPTER_EVENT, listener);
  }
}, 15000);
