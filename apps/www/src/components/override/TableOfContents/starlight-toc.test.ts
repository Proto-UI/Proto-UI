import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StarlightTOC, currentHeadingIndex } from './starlight-toc';

let idle: IdleRequestCallback[];
let intersections: IntersectionObserverCallback[];
let disconnects: Array<ReturnType<typeof vi.fn>>;
beforeEach(() => {
  idle = [];
  intersections = [];
  disconnects = [];
  vi.stubGlobal('cancelIdleCallback', vi.fn());
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
    idle.push(callback);
    return 1;
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn();
      constructor(callback: IntersectionObserverCallback) {
        intersections.push(callback);
        disconnects.push(this.disconnect);
      }
      observe() {}
    }
  );
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('current heading is distinct from the visible section set', () => {
  it('selects the last started heading, including upward movement and Overview', () => {
    const tops = [100, 400, 900];
    expect(currentHeadingIndex([], 0)).toBe(-1);
    expect(currentHeadingIndex(tops, 50)).toBe(0);
    expect(currentHeadingIndex(tops, 400)).toBe(1);
    expect(currentHeadingIndex(tops, 950)).toBe(2);
    expect(currentHeadingIndex(tops, 500)).toBe(1);
    expect(currentHeadingIndex(tops, 100)).toBe(0);
  });

  it('ignores whole-document wrappers and nested public Text as current owners', () => {
    document.body.innerHTML = `<header></header><main><h1 id="_top">Title</h1>
      <div id="whole-document"><div data-doc-flow>
      <h2 id="section"><span data-typography-prototype="shadcn-text-root">Section</span></h2>
      <p id="paragraph">Content</p><h2 id="later">Later</h2></div></div></main>`;
    vi.spyOn(document.querySelector('header')!, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1440, 64)
    );
    const positions = { _top: -300, section: 80, later: 600 };
    for (const id of Object.keys(positions) as Array<keyof typeof positions>)
      vi.spyOn(document.getElementById(id)!, 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(0, positions[id], 300, 38)
      );
    const toc = document.createElement('sl-toc') as StarlightTOC;
    toc.innerHTML =
      '<a href="#_top" aria-current="true">Overview</a><a href="#section">Section</a><a href="#later">Later</a>';
    document.body.append(toc);
    for (const callback of idle) callback({ didTimeout: false, timeRemaining: () => 50 });
    const current = () =>
      [...toc.querySelectorAll('[aria-current="true"]')].map((e) => e.getAttribute('href'));
    expect(current()).toEqual(['#section']);
    expect(toc.querySelector('[href="#section"]')!.hasAttribute('in-view')).toBe(true);
    expect(toc.querySelector('[href="#later"]')!.hasAttribute('in-view')).toBe(true);
    for (const callback of intersections)
      callback(
        [
          {
            target: document.getElementById('whole-document')!,
            isIntersecting: true,
            time: 0,
            boundingClientRect: new DOMRect(0, 0, 1440, 2000),
            intersectionRect: new DOMRect(0, 96, 1440, 53),
            rootBounds: null,
            intersectionRatio: 1,
          },
        ] as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    expect(current()).toEqual(['#section']);
    positions._top = 100;
    positions.section = 450;
    positions.later = 900;
    window.dispatchEvent(new Event('scroll'));
    expect(current()).toEqual(['#_top']);
    expect(toc.visibleSections.map((section) => section.id)).toContain('section');
  });

  it('ignores headings outside the generated TOC, including a hidden gallery modal', () => {
    document.body.innerHTML = `<header></header><main><h1 id="_top">Title</h1>
      <h2 id="section">Section</h2><h3 id="not-in-toc">Embedded component</h3>
      <h2 id="下一节">Later</h2><div hidden><h3 id="lucide-modal-title-en">Icon</h3></div></main>`;
    vi.spyOn(document.querySelector('header')!, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1440, 64)
    );
    const positions = { _top: -300, section: 80, 'not-in-toc': 90, 下一节: 600 };
    for (const id of Object.keys(positions) as Array<keyof typeof positions>)
      vi.spyOn(document.getElementById(id)!, 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(0, positions[id], 300, 38)
      );
    vi.spyOn(
      document.getElementById('lucide-modal-title-en')!,
      'getBoundingClientRect'
    ).mockReturnValue(new DOMRect(0, 0, 0, 0));
    const toc = document.createElement('sl-toc') as StarlightTOC;
    toc.innerHTML = `<a href="#_top" aria-current="true">Overview</a>
      <a href="#section">Section</a><a href="#${encodeURIComponent('下一节')}">Later</a>`;
    document.body.append(toc);
    for (const callback of idle) callback({ didTimeout: false, timeRemaining: () => 50 });
    const current = () => toc.querySelector('[aria-current="true"]')?.textContent;
    expect(current()).toBe('Section');
    expect(toc.visibleSections.map(({ id }) => id)).toEqual(['section', '下一节']);
    expect(toc.visibleSections.every(({ link }) => link instanceof HTMLAnchorElement)).toBe(true);

    positions.section = -450;
    positions.下一节 = 80;
    window.dispatchEvent(new Event('scroll'));
    expect(current()).toBe('Later');
    positions._top = 100;
    positions.section = 450;
    positions.下一节 = 900;
    window.dispatchEvent(new Event('scroll'));
    expect(current()).toBe('Overview');
  });
});

it('cancels detached idle setup and reconnects with one live observer/listener owner', () => {
  document.body.innerHTML = '<header></header><main><h1 id="_top">Title</h1></main>';
  const toc = document.createElement('sl-toc') as StarlightTOC;
  toc.innerHTML = '<a href="#_top" aria-current="true">Overview</a>';
  const add = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  document.body.append(toc);
  const abandoned = idle[0];
  toc.remove();
  expect(window.cancelIdleCallback).toHaveBeenCalled();
  abandoned({ didTimeout: false, timeRemaining: () => 50 });
  expect(intersections).toHaveLength(0);
  expect(add.mock.calls.filter(([event]) => event === 'scroll' || event === 'resize')).toHaveLength(
    0
  );
  document.body.append(toc);
  idle[1]({ didTimeout: false, timeRemaining: () => 50 });
  expect(intersections).toHaveLength(1);
  expect(add.mock.calls.filter(([event]) => event === 'scroll' || event === 'resize')).toHaveLength(
    2
  );
  window.dispatchEvent(new Event('resize'));
  expect(disconnects[0]).toHaveBeenCalledOnce();
  toc.remove();
  expect(
    remove.mock.calls.filter(([event]) => event === 'scroll' || event === 'resize')
  ).toHaveLength(4);
  document.body.append(toc);
  idle[2]({ didTimeout: false, timeRemaining: () => 50 });
  expect(intersections).toHaveLength(2);
  toc.remove();
  expect(disconnects[1]).toHaveBeenCalledOnce();
});

it('projects one moving visible range without changing unique current', () => {
  document.body.innerHTML =
    '<header></header><main><h1 id="_top">Title</h1><h2 id="second">Second</h2><h2 id="third">Third</h2></main>';
  const positions = [0, 300, 1200];
  document
    .querySelectorAll('main [id]')
    .forEach((heading, i) =>
      vi
        .spyOn(heading, 'getBoundingClientRect')
        .mockImplementation(() => new DOMRect(0, positions[i], 300, 30))
    );
  const toc = document.createElement('sl-toc') as StarlightTOC;
  toc.innerHTML =
    '<nav><a href="#_top">Title</a><a href="#second">Second</a><a href="#third">Third</a></nav><div data-site-toc-highlight aria-hidden="true"></div>';
  vi.spyOn(toc, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 200, 200));
  toc
    .querySelectorAll('a')
    .forEach((link, i) =>
      vi
        .spyOn(link, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(100, 80 + i * 32, 200, 32))
    );
  document.body.append(toc);
  idle[0]({ didTimeout: false, timeRemaining: () => 50 });
  const range = toc.querySelector<HTMLElement>('[data-site-toc-highlight]')!;
  expect(range.style.transform).toBe('translate(0px, 30px)');
  expect(range.style.height).toBe('64px');
  expect(toc.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  positions[0] = -1200;
  positions[1] = -900;
  positions[2] = 0;
  window.dispatchEvent(new Event('scroll'));
  expect(range.style.transform).toBe('translate(0px, 94px)');
  expect(range.style.height).toBe('32px');
  positions[0] = 0;
  positions[1] = 300;
  positions[2] = 1200;
  window.dispatchEvent(new Event('scroll'));
  expect(range.style.transform).toBe('translate(0px, 30px)');
  expect(range.style.height).toBe('64px');
  toc.remove();
  expect(range.hasAttribute('data-toc-range-visible')).toBe(false);
});

it('coalesces geometry reads before writes, skips unchanged writes and retires pending frames', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let serial = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  let resize: ResizeObserverCallback | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
  );
  document.body.innerHTML = '<main><h1 id="_top">Title</h1><h2 id="next">Next</h2></main>';
  const events: string[] = [];
  let secondTop = 300;
  let rowHeight = 32;
  document.querySelectorAll('main [id]').forEach((heading, index) =>
    vi.spyOn(heading, 'getBoundingClientRect').mockImplementation(() => {
      events.push('read-heading');
      return new DOMRect(0, index ? secondTop : 0, 200, 30);
    })
  );
  const toc = document.createElement('sl-toc') as StarlightTOC;
  toc.innerHTML =
    '<a href="#_top">Title</a><a href="#next">Next</a><div data-site-toc-highlight aria-hidden="true"></div>';
  vi.spyOn(toc, 'getBoundingClientRect').mockImplementation(() => {
    events.push('read-container');
    return new DOMRect(0, 0, 200, 200);
  });
  toc.querySelectorAll('a').forEach((link, index) =>
    vi.spyOn(link, 'getBoundingClientRect').mockImplementation(() => {
      events.push('read-link');
      return new DOMRect(0, index * rowHeight, 200, rowHeight);
    })
  );
  const range = toc.querySelector<HTMLElement>('[data-site-toc-highlight]')!;
  const nativeWrite = range.style.setProperty.bind(range.style);
  const writes = vi.spyOn(range.style, 'setProperty').mockImplementation((...args) => {
    events.push('write-range');
    return nativeWrite(...args);
  });
  for (const link of toc.querySelectorAll('a')) {
    const set = link.setAttribute.bind(link);
    vi.spyOn(link, 'setAttribute').mockImplementation((...args) => {
      events.push('write-link');
      return set(...args);
    });
  }
  document.body.append(toc);
  idle[0]({ didTimeout: false, timeRemaining: () => 50 });
  expect(events.lastIndexOf('read-link')).toBeLessThan(
    events.findIndex((entry) => entry.startsWith('write'))
  );
  writes.mockClear();
  events.length = 0;
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  };
  for (let i = 0; i < 20; i++) window.dispatchEvent(new Event('scroll'));
  expect(frames.size).toBe(1);
  flush();
  expect(events.filter((event) => event === 'read-container')).toHaveLength(1);
  expect(events.filter((event) => event === 'read-link')).toHaveLength(2);
  expect(writes).not.toHaveBeenCalled();
  rowHeight = 48; // Host/font reflow fixture; no scroll event.
  resize!([], {} as ResizeObserver);
  flush();
  expect(range.style.height).toBe('96px');
  // A real rendering opportunity delivers ResizeObserver after layout and
  // before paint. Current must be repaired in that callback, without another
  // frame in which the resized page and old selection are painted together.
  secondTop = 0;
  window.dispatchEvent(new Event('scroll'));
  expect(frames.size).toBe(1);
  resize!([], {} as ResizeObserver);
  expect(frames.size).toBe(0);
  expect(toc.querySelector('[aria-current="true"]')?.getAttribute('href')).toBe('#next');
  writes.mockClear();
  resize!([], {} as ResizeObserver);
  expect(writes).not.toHaveBeenCalled();
  secondTop = 1200;
  window.dispatchEvent(new Event('hashchange'));
  flush();
  expect(range.style.height).toBe('48px');
  window.dispatchEvent(new Event('scroll'));
  const stale = [...frames.values()][0];
  toc.remove();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
  writes.mockClear();
  stale(0);
  expect(writes).not.toHaveBeenCalled();
  expect(range.hasAttribute('data-toc-range-visible')).toBe(false);
  document.body.append(toc);
  idle[1]({ didTimeout: false, timeRemaining: () => 50 });
  expect(range.hasAttribute('data-toc-range-visible')).toBe(true);
  expect(toc.querySelectorAll('[data-site-toc-highlight]')).toHaveLength(1);
});
