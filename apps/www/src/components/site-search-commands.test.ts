import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFERRED_ADAPTER_EVENT } from './adapter-preference';
import { getPrototype } from './PrototypePreviewer/registry';
import searchIcon from '../../../../packages/prototypes/lucide/src/icons/search';
import closeIcon from '../../../../packages/prototypes/lucide/src/icons/x';
const faults = vi.hoisted(() => ({ materialize: vi.fn(), theme: vi.fn() }));
vi.mock('./PrototypePreviewer/projection-materializer', () => ({
  materializeProjectionCandidate: faults.materialize,
}));
vi.mock('./PrototypePreviewer/projection-theme', () => ({
  watchProjectionThemeSurfaceStyle: faults.theme,
}));
import { initDocumentationSearchCommands, searchCommandParticipant } from './site-search-commands';
const handles: Array<ReturnType<typeof initDocumentationSearchCommands>> = [];
const owners: Array<ReturnType<typeof searchCommandParticipant>> = [];
const made: Array<ReturnType<typeof candidate>> = [];
const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
function candidate(): {
  host: HTMLElement;
  scope: HTMLElement;
  activate: ReturnType<typeof vi.fn>;
  setLocked: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  setThemeSurfaceStyle: ReturnType<typeof vi.fn>;
} {
  const value = {
    host: document.createElement('div'),
    scope: document.createElement('div'),
    activate: vi.fn(),
    setLocked: vi.fn(),
    dispose: vi.fn(),
    setThemeSurfaceStyle: vi.fn(),
  };
  made.push(value);
  return value;
}
function mount() {
  document.body.innerHTML =
    '<site-search data-search-initial-family="shadcn"><div data-search-command-mount="open"></div><dialog><div data-search-command-mount="close"></div><div data-search-command-mount="retry"></div></dialog></site-search>';
  const root = document.querySelector<HTMLElement>('site-search')!;
  const owner = searchCommandParticipant(root);
  owners.push(owner);
  owner.bind({ open() {}, close() {}, retry() {} });
  const handle = initDocumentationSearchCommands(owner);
  handles.push(handle);
  return { root, owner, handle };
}
beforeEach(() => {
  faults.materialize.mockReset().mockImplementation(async () => candidate());
  faults.theme.mockReset().mockReturnValue(() => {});
  localStorage.clear();
  made.length = 0;
});
afterEach(async () => {
  for (const handle of handles.splice(0)) await handle.destroy();
  for (const owner of owners.splice(0)) owner.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Search projection failure and lifetime boundaries (materializer fault doubles)', () => {
  it('cleans two successful siblings after one initial failure and retries with a fresh owner namespace', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    faults.materialize.mockRejectedValueOnce(new Error('unavailable initial runtime'));
    const { root, owner, handle } = mount();
    await handle.ready;
    expect(root.dataset.searchView).toBe('unavailable');
    expect(made).toHaveLength(2);
    for (const item of made) {
      expect(item.activate).not.toHaveBeenCalled();
      expect(item.dispose).toHaveBeenCalledOnce();
    }
    const firstOwner = faults.materialize.mock.calls[0]![1].ownerId;
    expect(searchCommandParticipant(root)).toBe(owner);
    await handle.refresh();
    expect(root.dataset.searchView).toBe('ready');
    expect(faults.materialize.mock.calls[3]![1].ownerId).not.toBe(firstOwner);
    expect(error).toHaveBeenCalledTimes(1);
  });
  it('treats theme setup failure as a failed whole generation and disposes all prepared commands', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    faults.theme.mockImplementationOnce(() => {
      throw new Error('theme failed');
    });
    const { root, handle } = mount();
    await handle.ready;
    expect(root.dataset.searchView).toBe('unavailable');
    expect(made).toHaveLength(3);
    for (const item of made) expect(item.dispose).toHaveBeenCalledOnce();
  });
  it('revokes a pending generation on dispose, waits for its cleanup and ignores later preference changes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    faults.materialize.mockImplementation(async () => {
      await gate;
      return candidate();
    });
    const { root, owner, handle } = mount();
    const destruction = handle.destroy();
    owner.dispose();
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    expect(faults.materialize).toHaveBeenCalledTimes(3);
    release();
    await destruction;
    await handle.ready;
    await settle();
    expect(root.dataset.searchView).not.toBe('ready');
    for (const item of made) {
      expect(item.activate).not.toHaveBeenCalled();
      expect(item.dispose).toHaveBeenCalledOnce();
    }
  });
  it('refuses a second independent scope for homepage Search', () => {
    const root = document.createElement('header');
    root.dataset.homepageRuntime = '';
    root.innerHTML =
      '<site-search><div data-search-command-mount="open"></div><div data-search-command-mount="close"></div><div data-search-command-mount="retry"></div></site-search>';
    document.body.append(root);
    const owner = searchCommandParticipant(root.querySelector('site-search')!);
    owners.push(owner);
    expect(() => initDocumentationSearchCommands(owner)).toThrow('page transaction');
  });
});

it('registers Search fixed glyph prototypes before starting any command generation', () => {
  expect(getPrototype('lucide-search-icon')).toBe(searchIcon);
  expect(getPrototype('lucide-x-icon')).toBe(closeIcon);
  expect(faults.materialize).not.toHaveBeenCalled();
});
