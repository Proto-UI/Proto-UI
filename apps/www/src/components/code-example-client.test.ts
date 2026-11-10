import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ADAPTER,
  PREFERRED_ADAPTER_EVENT,
  PREFERRED_ADAPTER_KEY,
} from './adapter-preference';
import { initCodeExamples } from './code-example-client';
import { enhanceCodeExampleTabs, type TabProjection } from './code-example-tabs';
import { enhanceCodeExampleTree } from './code-example-tree';

// These tests retain the native fallback contract. The real Tabs projection has
// a separate suite and browser evidence; do not conflate the two owners.
vi.mock('./code-example-tabs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./code-example-tabs')>()),
  enhanceCodeExampleTabs: vi.fn(),
}));

vi.mock('./code-example-tree', () => ({ enhanceCodeExampleTree: vi.fn() }));

interface AcquiredProjection {
  kind: 'tree' | 'tabs';
  list: HTMLElement;
  selected: HTMLElement | null;
  projection: TabProjection;
}

const acquired: AcquiredProjection[] = [];
const tasks = new Map<number, () => void>();
const idleTasks = new Map<number, () => void>();
const browserWindow: Window = window;
let nextTask = 0;
let nextIdleTask = 0;

function installIdleTasks(): void {
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
    const id = nextIdleTask++;
    idleTasks.set(id, () => callback({ didTimeout: false, timeRemaining: () => 0 }));
    return id;
  });
  vi.stubGlobal('cancelIdleCallback', (id: number) => idleTasks.delete(id));
}

function recordProjection(kind: AcquiredProjection['kind'], list: HTMLElement): TabProjection {
  const projection = { select: vi.fn(), destroy: vi.fn() };
  acquired.push({
    kind,
    list,
    selected: list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]'),
    projection,
  });
  return projection;
}

// Deliver actual scheduled callbacks one at a time. These injected task turns
// distinguish yielding and ownership; they are not native timing evidence.
function runNextTask(pending = tasks): void {
  const next = pending.entries().next().value;
  if (!next) throw new Error('Expected a pending CodeExample task.');
  const [id, callback] = next;
  pending.delete(id);
  callback();
}

function finishTasks(pending = tasks): void {
  for (let count = 0; pending.size; count++) {
    if (count === 20) throw new Error('CodeExample projection work did not finish.');
    runNextTask(pending);
  }
}

function exampleMarkup(id: string, initialHost: 'wc' | 'react' = 'wc'): string {
  const hosts = ['wc', 'react'] as const;
  return `
    <section data-code-example data-initial-host="${initialHost}" aria-label="${id}">
      <div role="tablist" aria-label="Host" data-code-host-tabs>
        ${hosts
          .map(
            (host, index) => `<button
              id="${id}-host-tab-${index}"
              role="tab"
              data-code-host-tab
              data-code-host="${host}"
              aria-controls="${id}-host-panel-${index}"
              aria-selected="${host === initialHost}"
              tabindex="${host === initialHost ? 0 : -1}"
            >${host}</button>`
          )
          .join('')}
      </div>
      ${hosts
        .map(
          (host, hostIndex) => `<section
            id="${id}-host-panel-${hostIndex}"
            role="tabpanel"
            data-code-host-panel
            data-code-host="${host}"
            aria-labelledby="${id}-host-tab-${hostIndex}"
            ${host === initialHost ? '' : 'hidden'}
          >
            <section data-code-example-command aria-label="Terminal">
              <figure data-code-shell><pre><code>npx @proto.ui/cli@latest add ${host} shadcn-button</code></pre></figure>
            </section>
            <div role="tablist" aria-label="Files" data-code-file-tabs>
              ${['src/styles.css', host === 'react' ? 'src/Demo.tsx' : 'src/main.ts']
                .map(
                  (name, fileIndex) => `<button
                    id="${id}-${host}-file-tab-${fileIndex}"
                    role="tab"
                    data-code-file-tab
                    data-code-file-index="${fileIndex}"
                    aria-controls="${id}-${host}-file-panel-${fileIndex}"
                    aria-selected="${fileIndex === 0}"
                    tabindex="${fileIndex === 0 ? 0 : -1}"
                  >${name}</button>`
                )
                .join('')}
            </div>
            ${[0, 1]
              .map(
                (fileIndex) => `<figure
                  id="${id}-${host}-file-panel-${fileIndex}"
                  role="tabpanel"
                  data-code-file-panel
                  data-code-file-index="${fileIndex}"
                  aria-labelledby="${id}-${host}-file-tab-${fileIndex}"
                  ${fileIndex === 0 ? '' : 'hidden'}
                ></figure>`
              )
              .join('')}
          </section>`
        )
        .join('')}
    </section>`;
}

function selectedHost(root: HTMLElement): string | undefined {
  return root.querySelector<HTMLElement>('[data-code-host-tab][aria-selected="true"]')?.dataset
    .codeHost;
}

function selectedFile(root: HTMLElement, host: string): string | undefined {
  return root
    .querySelector<HTMLElement>(`[data-code-host-panel][data-code-host="${host}"]`)
    ?.querySelector<HTMLElement>('[data-code-file-tab][aria-selected="true"]')?.dataset
    .codeFileIndex;
}

function press(target: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key });
  target.dispatchEvent(event);
  return event;
}

describe('CodeExample client', () => {
  beforeEach(() => {
    document.body.innerHTML = exampleMarkup('first');
    localStorage.clear();
    acquired.length = 0;
    tasks.clear();
    idleTasks.clear();
    nextTask = 0;
    nextIdleTask = 0;
    // Retain the existing timer-path cases; idle admission is exercised below.
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.stubGlobal('cancelIdleCallback', undefined);
    vi.mocked(enhanceCodeExampleTree)
      .mockReset()
      .mockImplementation(({ list }) => recordProjection('tree', list));
    vi.mocked(enhanceCodeExampleTabs)
      .mockReset()
      .mockImplementation(({ list }) => recordProjection('tabs', list));
    vi.spyOn(browserWindow, 'setTimeout').mockImplementation((callback) => {
      if (typeof callback !== 'function') throw new Error('Expected a function timer.');
      const id = ++nextTask;
      tasks.set(id, () => callback());
      return id;
    });
    vi.spyOn(browserWindow, 'clearTimeout').mockImplementation((id) => {
      if (id !== undefined) tasks.delete(id);
    });
  });

  afterEach(() => {
    document.dispatchEvent(new Event('astro:before-swap'));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('uses a supported stored host and retains SSR fallback for unsupported values', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    localStorage.setItem(PREFERRED_ADAPTER_KEY, 'react');
    initCodeExamples(document);
    expect(selectedHost(root)).toBe('react');

    document.body.innerHTML = exampleMarkup('second', 'react');
    localStorage.setItem(PREFERRED_ADAPTER_KEY, 'unsupported');
    const fallback = document.querySelector<HTMLElement>('[data-code-example]')!;
    initCodeExamples(document);
    expect(selectedHost(fallback)).toBe('react');

    localStorage.clear();
    document.body.innerHTML = exampleMarkup('third', 'react');
    const defaultFallback = document.querySelector<HTMLElement>('[data-code-example]')!;
    initCodeExamples(document);
    expect(DEFAULT_ADAPTER).toBe('wc');
    expect(selectedHost(defaultFallback)).toBe('react');
  });

  it('synchronizes valid global host events across global-following instances', () => {
    document.body.innerHTML = exampleMarkup('first') + exampleMarkup('second');
    initCodeExamples(document);
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    const roots = [...document.querySelectorAll<HTMLElement>('[data-code-example]')];
    expect(roots.map(selectedHost)).toEqual(['react', 'react']);

    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'bad' } })
    );
    expect(roots.map(selectedHost)).toEqual(['react', 'react']);
  });

  it('keeps direct host activation local without storage writes or global events', () => {
    document.body.innerHTML = exampleMarkup('first') + exampleMarkup('second');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const globalEvent = vi.fn();
    document.addEventListener(PREFERRED_ADAPTER_EVENT, globalEvent);
    initCodeExamples(document);

    const roots = [...document.querySelectorAll<HTMLElement>('[data-code-example]')];
    roots[0].querySelector<HTMLButtonElement>('[data-code-host="react"]')!.click();
    expect(selectedHost(roots[0])).toBe('react');
    expect(selectedHost(roots[1])).toBe('wc');
    expect(setItem).not.toHaveBeenCalled();
    expect(globalEvent).not.toHaveBeenCalled();

    document.dispatchEvent(new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'wc' } }));
    expect(selectedHost(roots[0])).toBe('react');
    expect(selectedHost(roots[1])).toBe('wc');
    document.removeEventListener(PREFERRED_ADAPTER_EVENT, globalEvent);
  });

  it('remembers the selected file independently for each host', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    initCodeExamples(document);
    root
      .querySelector<HTMLButtonElement>(
        '[data-code-host-panel][data-code-host="wc"] [data-code-file-index="1"]'
      )!
      .click();
    root.querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="react"]')!.click();
    expect(selectedFile(root, 'react')).toBe('0');
    root
      .querySelector<HTMLButtonElement>(
        '[data-code-host-panel][data-code-host="react"] [data-code-file-index="1"]'
      )!
      .click();
    root.querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="wc"]')!.click();
    expect(selectedFile(root, 'wc')).toBe('1');
    expect(selectedFile(root, 'react')).toBe('1');
  });

  it('applies exact ARIA, hidden, focus, and non-wrapping keyboard transitions', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    initCodeExamples(document);
    const hostTabs = [...root.querySelectorAll<HTMLButtonElement>('[data-code-host-tab]')];
    const firstBoundary = press(hostTabs[0], 'ArrowLeft');
    expect(firstBoundary.defaultPrevented).toBe(false);
    expect(document.activeElement).not.toBe(hostTabs[1]);

    hostTabs[0].focus();
    const right = press(hostTabs[0], 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(hostTabs[1]);
    expect(hostTabs.map((tab) => [tab.getAttribute('aria-selected'), tab.tabIndex])).toEqual([
      ['false', -1],
      ['true', 0],
    ]);
    expect(
      root.querySelector<HTMLElement>('[data-code-host-panel][data-code-host="wc"]')!.hidden
    ).toBe(true);
    expect(
      root.querySelector<HTMLElement>('[data-code-host-panel][data-code-host="react"]')!.hidden
    ).toBe(false);

    const lastBoundary = press(hostTabs[1], 'ArrowRight');
    expect(lastBoundary.defaultPrevented).toBe(false);
    const home = press(hostTabs[1], 'Home');
    expect(home.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(hostTabs[0]);
    const end = press(hostTabs[0], 'End');
    expect(end.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(hostTabs[1]);
    expect(press(hostTabs[1], 'ArrowDown').defaultPrevented).toBe(false);
  });

  it('contains file keyboard activation within its nested tablist', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    initCodeExamples(document);
    const wcPanel = root.querySelector<HTMLElement>('[data-code-host-panel][data-code-host="wc"]')!;
    const fileTabs = [...wcPanel.querySelectorAll<HTMLButtonElement>('[data-code-file-tab]')];
    fileTabs[0].focus();
    press(fileTabs[0], 'End');
    expect(document.activeElement).toBe(fileTabs[1]);
    expect(selectedFile(root, 'wc')).toBe('1');
    expect(selectedHost(root)).toBe('wc');
  });

  it('lets an explicit WIP host remain selectable without inventing file or copy controls', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    root
      .querySelector('[data-code-host-tabs]')!
      .insertAdjacentHTML(
        'beforeend',
        '<button role="tab" data-code-host-tab data-code-host="qt" aria-selected="false" aria-controls="qt-wip" tabindex="-1">Qt</button>'
      );
    root.insertAdjacentHTML(
      'beforeend',
      '<section id="qt-wip" data-code-host-panel data-code-host="qt" role="tabpanel" hidden><p data-code-example-wip>WIP: no stable CLI path yet.</p></section>'
    );
    initCodeExamples(document);
    root.querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="qt"]')!.click();
    expect(selectedHost(root)).toBe('qt');
    const panel = root.querySelector<HTMLElement>('#qt-wip')!;
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('[data-code-file-tabs], [data-site-copy], pre')).toBeNull();
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    expect(selectedHost(root)).toBe('qt');
  });

  it('keeps terminal commands outside file tab selection', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    initCodeExamples(document);
    const panel = root.querySelector<HTMLElement>('[data-code-host-panel][data-code-host="wc"]')!;
    const command = panel.querySelector<HTMLElement>('[data-code-example-command]')!;
    panel.querySelectorAll<HTMLButtonElement>('[data-code-file-tab]')[1].click();
    expect(command.hidden).toBe(false);
    expect(
      command.querySelector('[role="tab"], [role="tabpanel"], [data-code-file-panel]')
    ).toBeNull();
    expect(command.textContent).toContain('add wc shadcn-button');
    expect(panel.querySelector('[data-code-file-tabs]')!.textContent).not.toContain('install.sh');
  });

  it('initializes each root idempotently', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    initCodeExamples(document);
    initCodeExamples(document);
    const react = root.querySelector<HTMLButtonElement>(
      '[data-code-host-tab][data-code-host="react"]'
    )!;
    react.click();
    expect(root.dataset.codeExampleInit).toBe('1');
    expect(selectedHost(root)).toBe('react');
  });

  it('yields between complete groups while pending native choices stay current', () => {
    document.body.innerHTML = exampleMarkup('first') + exampleMarkup('second');
    const roots = [...document.querySelectorAll<HTMLElement>('[data-code-example]')];
    initCodeExamples(document);
    initCodeExamples(document);
    expect(acquired).toEqual([]);
    expect(tasks.size).toBe(1);
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    const selectedReactFile = roots[0].querySelector<HTMLButtonElement>(
      '[data-code-host-panel][data-code-host="react"] [data-code-file-index="1"]'
    )!;
    selectedReactFile.click();
    roots[0].querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="wc"]')!.click();
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    expect(roots.map(selectedHost)).toEqual(['wc', 'react']);
    expect(selectedFile(roots[0], 'react')).toBe('1');
    runNextTask();
    expect(acquired).toHaveLength(1);
    expect(acquired[0].kind).toBe('tree');
    expect(tasks.size).toBe(1);
    for (let turn = 0; tasks.size; turn++) {
      if (turn === 20) throw new Error('CodeExample groups did not finish.');
      const count = acquired.length;
      runNextTask();
      expect(acquired.length - count).toBeLessThanOrEqual(1);
    }
    expect(acquired).toHaveLength(6);
    for (const root of roots) {
      const groups = acquired.filter(({ list }) => root.contains(list));
      expect(groups.map(({ kind }) => kind)).toEqual(['tree', 'tree', 'tabs']);
      expect(groups[2].selected?.dataset.codeHost).toBe(selectedHost(root));
    }
    expect(acquired.find(({ list }) => list.contains(selectedReactFile))?.selected).toBe(
      selectedReactFile
    );
    expect(roots.map(selectedHost)).toEqual(['wc', 'react']);
    expect(selectedFile(roots[0], 'react')).toBe('1');
  });

  it('preserves current choices through complete idle groups and retires a partial owner before replacement', () => {
    installIdleTasks();
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    const react = root.querySelector<HTMLButtonElement>(
      '[data-code-host-tab][data-code-host="react"]'
    )!;
    const reactFile = root.querySelector<HTMLButtonElement>(
      '[data-code-host-panel][data-code-host="react"] [data-code-file-index="1"]'
    )!;
    initCodeExamples(document);
    initCodeExamples(document);
    react.click();
    reactFile.click();
    expect(selectedHost(root)).toBe('react');
    expect(selectedFile(root, 'react')).toBe('1');
    expect(tasks.size).toBe(0);
    expect(idleTasks.size).toBe(1);
    expect(acquired).toEqual([]);
    runNextTask(idleTasks);
    expect(acquired).toHaveLength(1);
    expect(acquired[0].kind).toBe('tree');
    runNextTask(idleTasks);
    expect(acquired).toHaveLength(2);
    expect(acquired[1].kind).toBe('tree');
    expect(acquired[1].selected).toBe(reactFile);
    expect(idleTasks.size).toBe(1);
    const released: number[] = [];
    for (const [index, { projection }] of acquired.entries())
      vi.mocked(projection.destroy).mockImplementation(() => {
        released.push(index);
      });
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(idleTasks.size).toBe(0);
    expect(released).toEqual([1, 0]);
    finishTasks(idleTasks);
    expect(acquired).toHaveLength(2);
    root.querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="wc"]')!.click();
    expect(selectedHost(root)).toBe('react');
    initCodeExamples(root);
    react.click();
    reactFile.click();
    finishTasks(idleTasks);
    expect(acquired.slice(2).map(({ kind }) => kind)).toEqual(['tree', 'tree', 'tabs']);
    expect(acquired[3].selected).toBe(reactFile);
    expect(acquired[4].selected).toBe(react);
    expect(released).toEqual([1, 0]);
    for (const { projection } of acquired.slice(0, 2))
      expect(projection.destroy).toHaveBeenCalledTimes(1);
  });

  it('cancels a zero idle handle without consuming an unrelated timer or blocking fresh work', () => {
    installIdleTasks();
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    initCodeExamples(document);
    initCodeExamples(document);
    expect([...idleTasks.keys()]).toEqual([0]);
    nextTask = -1;
    let timerRan = false;
    expect(
      browserWindow.setTimeout(() => {
        timerRan = true;
      }, 0)
    ).toBe(0);
    // A later capability change must not change the API owning the pending task.
    vi.stubGlobal('requestIdleCallback', undefined);
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(idleTasks.size).toBe(0);
    expect(tasks.has(0)).toBe(true);
    runNextTask();
    expect(timerRan).toBe(true);
    expect(acquired).toEqual([]);
    expect(root.dataset.codeExampleInit).toBeUndefined();
    initCodeExamples(root);
    finishTasks();
    expect(acquired.map(({ kind }) => kind)).toEqual(['tree', 'tree', 'tabs']);
  });

  it('keeps zero-handle timer fallback ownership when idle support appears before teardown', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    nextTask = -1;
    initCodeExamples(document);
    initCodeExamples(document);
    expect([...tasks.keys()]).toEqual([0]);
    installIdleTasks();
    let idleRan = false;
    expect(
      browserWindow.requestIdleCallback(() => {
        idleRan = true;
      })
    ).toBe(0);
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(tasks.size).toBe(0);
    expect(idleTasks.has(0)).toBe(true);
    runNextTask(idleTasks);
    expect(idleRan).toBe(true);
    expect(acquired).toEqual([]);
    expect(root.dataset.codeExampleInit).toBeUndefined();
    initCodeExamples(root);
    finishTasks(idleTasks);
    expect(acquired.map(({ kind }) => kind)).toEqual(['tree', 'tree', 'tabs']);
  });

  it('prepares current native state before insertion and enhances only after connection', () => {
    const fragment = document.createElement('div');
    fragment.innerHTML = exampleMarkup('detached');
    const root = fragment.querySelector<HTMLElement>('[data-code-example]')!;
    localStorage.setItem(PREFERRED_ADAPTER_KEY, 'react');
    initCodeExamples(root);
    expect(selectedHost(root)).toBe('react');
    expect(acquired).toEqual([]);
    document.body.append(root);
    finishTasks();
    expect(acquired).toHaveLength(3);
    expect(selectedHost(root)).toBe('react');
  });

  it('reconciles a native file choice made during acquisition without duplicating its owner', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    vi.mocked(enhanceCodeExampleTree).mockImplementationOnce((options) => {
      const projection = recordProjection('tree', options.list);
      initCodeExamples(document);
      options.tabs[1].click();
      return projection;
    });
    initCodeExamples(document);
    runNextTask();
    expect(acquired).toHaveLength(1);
    expect(selectedFile(root, 'wc')).toBe('1');
    expect(acquired[0].projection.select).toHaveBeenCalledTimes(1);
    expect(acquired[0].projection.select).toHaveBeenCalledWith(1);
    finishTasks();
    expect(acquired.map(({ kind }) => kind)).toEqual(['tree', 'tree', 'tabs']);
    expect(selectedFile(root, 'wc')).toBe('1');
  });

  it('cancels before its first group and permits a fresh explicit initialization', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    initCodeExamples(document);
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(tasks.size).toBe(0);
    expect(acquired).toEqual([]);
    expect(root.dataset.codeExampleInit).toBeUndefined();
    root.querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="react"]')!.click();
    expect(selectedHost(root)).toBe('wc');
    initCodeExamples(root);
    root.querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="react"]')!.click();
    expect(selectedHost(root)).toBe('react');
    finishTasks();
    expect(acquired).toHaveLength(3);
  });

  it('releases acquired groups in reverse order and ignores retired gestures and callbacks', () => {
    const root = document.querySelector<HTMLElement>('[data-code-example]')!;
    let lateSelect: ((index: number) => void) | undefined;
    vi.mocked(enhanceCodeExampleTabs).mockImplementationOnce((options) => {
      lateSelect = options.onSelect;
      return recordProjection('tabs', options.list);
    });
    initCodeExamples(document);
    finishTasks();
    const released: number[] = [];
    for (const [index, { projection }] of acquired.entries()) {
      vi.mocked(projection.destroy).mockImplementation(() => {
        released.push(index);
      });
    }
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(released).toEqual([2, 1, 0]);
    expect(tasks.size).toBe(0);
    if (!lateSelect) throw new Error('Expected the acquired host selection callback.');
    lateSelect(1);
    root.querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="react"]')!.click();
    document.dispatchEvent(
      new CustomEvent(PREFERRED_ADAPTER_EVENT, { detail: { adapter: 'react' } })
    );
    expect(selectedHost(root)).toBe('wc');
    expect(root.dataset.codeExampleInit).toBeUndefined();
    for (const { projection } of acquired) expect(projection.destroy).toHaveBeenCalledTimes(1);
  });

  it.each(['disconnect', 'adopt'] as const)(
    'retires partial acquisition after %s without running a later group',
    (action) => {
      const root = document.querySelector<HTMLElement>('[data-code-example]')!;
      initCodeExamples(document);
      runNextTask();
      expect(acquired).toHaveLength(1);
      if (action === 'disconnect') root.remove();
      else {
        const other = document.implementation.createHTMLDocument('other');
        // Happy DOM requires explicit adoption to establish the root's document.
        other.body.append(other.adoptNode(root));
        expect(root.ownerDocument).toBe(other);
        expect(root.isConnected).toBe(true);
      }
      const hostTabs = [...root.querySelectorAll<HTMLButtonElement>('[data-code-host-tab]')];
      const focus = vi.spyOn(hostTabs[1], 'focus');
      expect(press(hostTabs[0], 'ArrowRight').defaultPrevented).toBe(false);
      expect(focus).not.toHaveBeenCalled();
      finishTasks();
      expect(acquired).toHaveLength(1);
      expect(acquired[0].projection.destroy).toHaveBeenCalledTimes(1);
      expect(root.dataset.codeExampleInit).toBeUndefined();
      root
        .querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="react"]')!
        .click();
      expect(selectedHost(root)).toBe('wc');
    }
  );

  it.each([false, true])(
    'retains an in-flight claim through route teardown and a late release failure=%s',
    (fails) => {
      const root = document.querySelector<HTMLElement>('[data-code-example]')!;
      const error = new Error('late projection release failed');
      vi.mocked(enhanceCodeExampleTree).mockImplementationOnce(({ list }) => {
        const projection = recordProjection('tree', list);
        if (fails)
          vi.mocked(projection.destroy).mockImplementationOnce(() => {
            throw error;
          });
        document.dispatchEvent(new Event('astro:before-swap'));
        initCodeExamples(document);
        expect(root.dataset.codeExampleInit).toBe('1');
        return projection;
      });
      initCodeExamples(document);
      if (fails) expect(() => runNextTask()).toThrow(error);
      else runNextTask();
      expect(acquired).toHaveLength(1);
      expect(acquired[0].projection.destroy).toHaveBeenCalledTimes(1);
      expect(tasks.size).toBe(0);
      expect(root.dataset.codeExampleInit).toBe(fails ? '1' : undefined);
      initCodeExamples(document);
      finishTasks();
      expect(acquired).toHaveLength(fails ? 1 : 4);
    }
  );

  it('attempts all reverse releases including falsy failures and lets another root finish', () => {
    document.body.innerHTML = exampleMarkup('first') + exampleMarkup('second');
    const [first, second] = [...document.querySelectorAll<HTMLElement>('[data-code-example]')];
    initCodeExamples(document);
    for (let turn = 0; acquired.filter(({ list }) => first.contains(list)).length < 2; turn++) {
      if (turn === 20) throw new Error('Expected two acquired file groups.');
      runNextTask();
    }
    const retiring = acquired.filter(({ list }) => first.contains(list));
    expect(retiring).toHaveLength(2);
    const error = new Error('first group cleanup failed');
    vi.mocked(retiring[0].projection.destroy).mockImplementationOnce(() => {
      throw error;
    });
    vi.mocked(retiring[1].projection.destroy).mockImplementationOnce(() => {
      throw undefined;
    });
    first.remove();
    let failure: unknown;
    for (let turn = 0; tasks.size && !(failure instanceof AggregateError); turn++) {
      if (turn === 20) throw new Error('Expected disconnected owner cleanup.');
      try {
        runNextTask();
      } catch (error) {
        failure = error;
      }
    }
    if (!(failure instanceof AggregateError)) throw new Error('Expected both cleanup failures.');
    expect(failure.errors).toEqual([undefined, error]);
    for (const { projection } of retiring) expect(projection.destroy).toHaveBeenCalledTimes(1);
    // Failed retirement is not a successful release or permission to replace
    // a possibly still-live projection. Other roots remain independent.
    expect(first.dataset.codeExampleInit).toBe('1');
    finishTasks();
    expect(acquired.filter(({ list }) => second.contains(list)).map(({ kind }) => kind)).toEqual([
      'tree',
      'tree',
      'tabs',
    ]);
    second
      .querySelector<HTMLButtonElement>('[data-code-host-tab][data-code-host="react"]')!
      .click();
    expect(selectedHost(second)).toBe('react');
  });

  it('preserves a scheduling failure while releasing every pending owner', () => {
    document.body.innerHTML = exampleMarkup('first') + exampleMarkup('second');
    const roots = [...document.querySelectorAll<HTMLElement>('[data-code-example]')];
    vi.mocked(enhanceCodeExampleTree).mockImplementationOnce(({ list }) => {
      const projection = recordProjection('tree', list);
      vi.mocked(projection.destroy).mockImplementationOnce(() => {
        throw undefined;
      });
      return projection;
    });
    initCodeExamples(document);
    const error = new Error('browser task scheduling failed');
    vi.mocked(browserWindow.setTimeout).mockImplementationOnce(() => {
      throw error;
    });
    let failure: unknown;
    try {
      runNextTask();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBe(error);
    expect(tasks.size).toBe(0);
    expect(acquired).toHaveLength(1);
    expect(acquired[0].projection.destroy).toHaveBeenCalledTimes(1);
    const failedRoot = roots.find((root) => root.contains(acquired[0].list))!;
    const releasedRoot = roots.find((root) => root !== failedRoot)!;
    expect(failedRoot.dataset.codeExampleInit).toBe('1');
    expect(releasedRoot.dataset.codeExampleInit).toBeUndefined();
    initCodeExamples(document);
    finishTasks();
    expect(acquired).toHaveLength(4);
  });
});
