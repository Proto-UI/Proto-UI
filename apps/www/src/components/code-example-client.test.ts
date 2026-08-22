import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ADAPTER,
  PREFERRED_ADAPTER_EVENT,
  PREFERRED_ADAPTER_KEY,
} from './adapter-preference';
import { initCodeExamples } from './code-example-client';

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
            <div role="tablist" aria-label="Files" data-code-file-tabs>
              ${['install.sh', host === 'react' ? 'Demo.tsx' : 'main.ts']
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
