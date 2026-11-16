import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { retainHappyDomMutationCallbacks } from '../../../../scripts/test/happy-dom-mutation-keepalive.mjs';
import {
  materializeProjectionCandidate,
  type ProjectionMaterializerOptions,
} from './PrototypePreviewer/projection-materializer';
import type { ProjectionScopeMaterializeRequest } from './PrototypePreviewer/projection-scope';
import { initCodeSurface, initSiteCodeSurfaces } from './site-code-surface';

// Discovery, MutationObserver delivery, visibility gating and scope ownership
// remain real. This bootstrap cost test replaces rendering only; the existing
// site-code-surface suite exercises the actual four adapters.
vi.mock('./PrototypePreviewer/projection-materializer', () => ({
  materializeProjectionCandidate: vi.fn(
    async (
      _request: ProjectionScopeMaterializeRequest,
      options: ProjectionMaterializerOptions
    ) => ({
      host: options.mount,
      scope: options.mount,
      activate() {},
      dispose: vi.fn(),
      setThemeSurfaceStyle() {},
    })
  ),
}));

const selector = '[data-site-code-surface], .starlight-aside--note';
const releases: Array<() => void> = [];
let observerKeeper: ReturnType<typeof retainHappyDomMutationCallbacks>;
beforeAll(() => {
  observerKeeper = retainHappyDomMutationCallbacks(window);
});
afterAll(() => observerKeeper.restore());
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  document.body.replaceChildren();
  await delivered();
  localStorage.clear();
  vi.mocked(materializeProjectionCandidate).mockClear();
  vi.restoreAllMocks();
});

function code() {
  const root = document.createElement('figure');
  root.dataset.siteCodeSurface = 'frame';
  root.innerHTML = '<pre><code>const original = true;</code></pre>';
  return root;
}

// A real observer delivery barrier, including non-element childList records.
// This introduces no clock delay or manually invoked observer callback.
function delivered() {
  return new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      observer.disconnect();
      resolve();
    });
    observer.observe(document.body, { childList: true });
    const marker = document.createComment('discovery delivery');
    document.body.append(marker);
    marker.remove();
  });
}

async function ready(root: HTMLElement, kind = 'code') {
  await vi.waitFor(() => expect(root.getAttribute(`data-${kind}-surface-view`)).toBe('ready'));
}

describe('CodeSurface document discovery', () => {
  it('scans the document on bootstrap and explicit rescan, not unrelated Search mutations', async () => {
    const root = code();
    const search = document.createElement('section');
    document.body.append(root, search);
    const query = vi.spyOn(document, 'querySelectorAll');
    const release = initSiteCodeSurfaces();
    releases.push(release);
    expect(query.mock.calls.filter(([value]) => value === selector)).toHaveLength(1);
    await ready(root);
    const mount = root.firstElementChild;
    query.mockClear();

    const result = document.createElement('div');
    result.textContent = 'Unrelated Search result';
    search.append(result);
    await delivered();
    expect(query.mock.calls.filter(([value]) => value === selector)).toHaveLength(0);
    expect(root.firstElementChild).toBe(mount);
    expect(vi.mocked(materializeProjectionCandidate)).toHaveBeenCalledTimes(1);

    expect(initSiteCodeSurfaces()).toBe(release);
    expect(query.mock.calls.filter(([value]) => value === selector)).toHaveLength(1);
    expect(root.firstElementChild).toBe(mount);
  });

  it.each(['parent-first', 'child-first'])(
    'discovers nested added code and note roots once per outer subtree (%s)',
    async (order) => {
      releases.push(initSiteCodeSurfaces());
      const parent = document.createElement('section');
      const child = document.createElement('div');
      const root = code();
      const source = root.firstElementChild;
      const note = document.createElement('aside');
      note.className = 'starlight-aside--note';
      note.innerHTML = '<p class="starlight-aside__title">Original note</p>';
      const title = note.firstElementChild;
      const parentQuery = vi.spyOn(parent, 'querySelectorAll');
      const childQuery = vi.spyOn(child, 'querySelectorAll');
      if (order === 'parent-first') {
        document.body.append(parent);
        parent.append(child);
        child.append(root, note);
      } else {
        document.body.append(child);
        child.append(root, note);
        document.body.append(parent);
        parent.append(child);
      }
      await ready(root);
      await ready(note, 'note');
      expect(parentQuery.mock.calls.filter(([value]) => value === selector)).toHaveLength(1);
      expect(childQuery.mock.calls.filter(([value]) => value === selector)).toHaveLength(0);
      expect(root.querySelector('pre')).toBe(source);
      expect(note.firstElementChild).toBe(title);
      expect(vi.mocked(materializeProjectionCandidate)).toHaveBeenCalledTimes(2);
    }
  );

  it('retains connected moves, cleans detached roots and discovers their next lifetime', async () => {
    const left = document.createElement('section');
    const right = document.createElement('section');
    document.body.append(left, right);
    releases.push(initSiteCodeSurfaces());
    const root = code();
    left.append(root);
    await ready(root);
    const first = initCodeSurface(root);
    const destroy = vi.spyOn(first, 'destroy');
    const mount = root.firstElementChild;

    right.append(root);
    root.remove();
    left.append(root);
    await delivered();
    expect(destroy).not.toHaveBeenCalled();
    expect(initCodeSurface(root)).toBe(first);
    expect(root.firstElementChild).toBe(mount);

    root.remove();
    await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());
    await destroy.mock.results[0]!.value;
    expect(root.querySelector('.site-code-surface-mount')).toBeNull();
    right.append(root);
    await ready(root);
    expect(initCodeSurface(root)).not.toBe(first);
    expect(root.querySelectorAll('.site-code-surface-mount')).toHaveLength(1);
    expect(vi.mocked(materializeProjectionCandidate)).toHaveBeenCalledTimes(2);

    const transient = code();
    right.append(transient);
    transient.remove();
    await delivered();
    expect(transient.querySelector('.site-code-surface-mount')).toBeNull();
    expect(vi.mocked(materializeProjectionCandidate)).toHaveBeenCalledTimes(2);
  });

  it('keeps newly discovered hidden roots pending until a visible reparent', async () => {
    releases.push(initSiteCodeSurfaces());
    const hidden = document.createElement('section');
    hidden.hidden = true;
    const root = code();
    hidden.append(root);
    document.body.append(hidden);
    await delivered();
    expect(root.querySelector('.site-code-surface-mount')).toBeNull();
    localStorage.setItem('preferred-prototypes-adapter', 'vue2');
    document.body.append(root);
    await ready(root);
    expect(root.dataset.codeSurfaceRuntime).toBe('vue2');
    const mount = root.firstElementChild;
    hidden.append(root);
    document.body.append(root);
    await delivered();
    expect(root.firstElementChild).toBe(mount);
    expect(vi.mocked(materializeProjectionCandidate)).toHaveBeenCalledTimes(1);
  });

  it.each(['dispose', 'page-swap'])(
    'stops pending and queued discovery at %s and permits a new lifetime',
    async (end) => {
      const active = code();
      const pending = code();
      pending.hidden = true;
      document.body.append(active, pending);
      const release = initSiteCodeSurfaces();
      releases.push(release);
      await ready(active);
      const queued = code();
      document.body.append(queued);
      if (end === 'dispose') release();
      else document.dispatchEvent(new Event('astro:before-swap'));
      pending.hidden = false;
      await delivered();
      for (const root of [active, pending, queued])
        expect(root.querySelector('.site-code-surface-mount')).toBeNull();
      expect(vi.mocked(materializeProjectionCandidate)).toHaveBeenCalledTimes(1);

      releases.push(initSiteCodeSurfaces());
      for (const root of [active, pending, queued]) await ready(root);
      expect(vi.mocked(materializeProjectionCandidate)).toHaveBeenCalledTimes(4);
    }
  );

  it('reports cleanup failures while continuing other disconnected-root cleanup', async () => {
    const first = code();
    const second = code();
    document.body.append(first, second);
    releases.push(initSiteCodeSurfaces());
    await ready(first);
    await ready(second);
    const failure = new Error('fixture cleanup failure');
    const candidate = await vi.mocked(materializeProjectionCandidate).mock.results[0]!.value;
    vi.mocked(candidate.dispose).mockRejectedValueOnce(failure);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    first.remove();
    second.remove();
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith('[CodeSurface] Cleanup failed.', failure)
    );
    expect(first.querySelector('.site-code-surface-mount')).toBeNull();
    expect(second.querySelector('.site-code-surface-mount')).toBeNull();
  });
});
