import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(
  'apps/www/src/content/docs/zh-cn/quick-start-first-frame.browser.test.ts',
  'utf8'
);
const snippet = source
  .split('// quick-start-code-paint-start\n')[1]
  ?.split('// quick-start-code-paint-end')[0];
if (!snippet) throw new Error('Missing actual Quick Start code paint observation');
const read = new Function(
  `${transformSync(snippet, { loader: 'ts' }).code}\nreturn readCodeTextPaint;`
)() as (
  owner: HTMLElement,
  pre: HTMLElement
) => {
  paint: DOMRect;
  content: DOMRect;
  viewport: DOMRect;
  glyphs: DOMRect;
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function fixture(ready = false) {
  document.body.innerHTML =
    '<figure data-code-shell><div data-code-scroll-root><div data-code-content><pre><code>pnpm create proto-ui@next</code></pre></div></div></figure>';
  const owner = document.querySelector<HTMLElement>('figure')!;
  const container = owner.querySelector<HTMLElement>('[data-code-scroll-root]')!;
  const pre = owner.querySelector('pre')!;
  const viewport = ready ? document.createElement('div') : pre;
  if (ready) {
    container.dataset.codeScrollReady = '';
    viewport.dataset.codeScrollViewport = '';
    viewport.append(container.firstElementChild!);
    container.append(viewport);
  }
  viewport.style.overflowX = 'auto';
  viewport.style.overflowY = 'auto';
  const boxes = {
    pre: new DOMRect(28, 190, ready ? 273.84375 : 263, 52),
    viewport: new DOMRect(28, 190, 263, 52),
    glyphs: new DOMRect(42, 204, 245.84375, 24),
  };
  vi.spyOn(pre, 'getBoundingClientRect').mockImplementation(() => boxes.pre);
  if (ready) vi.spyOn(viewport, 'getBoundingClientRect').mockImplementation(() => boxes.viewport);
  for (const [key, value] of Object.entries({
    clientLeft: 0,
    clientTop: 0,
    clientWidth: 263,
    clientHeight: 52,
  }))
    Object.defineProperty(viewport, key, { configurable: true, value });
  const range = document.createRange();
  vi.spyOn(range, 'getBoundingClientRect').mockImplementation(() => boxes.glyphs);
  vi.spyOn(document, 'createRange').mockReturnValue(range);
  return { owner, container, pre, viewport, boxes, read: () => read(owner, pre) };
}

describe('actual Quick Start visible code observation (DOM geometry fixtures)', () => {
  it('retains the SSR viewport and actual text bounds', () => {
    const value = fixture().read();
    expect(value.paint).toEqual({ x: 28, y: 190, width: 263, height: 52 });
    expect(value.content.width).toBe(263);
    expect(value.glyphs).toEqual({ x: 42, y: 204, width: 245.84375, height: 24 });
  });
  it('separates adopted intrinsic content from its containing scroll viewport', () => {
    const value = fixture(true).read();
    expect(value.paint).toEqual({ x: 28, y: 190, width: 263, height: 52 });
    expect(value.content.width).toBe(273.84375);
    expect(value.viewport.width).toBe(263);
    expect(value.glyphs.width).toBe(245.84375);
  });
  it('does not clamp an overflow-visible surface merely because it has a viewport marker', () => {
    const setup = fixture(true);
    setup.viewport.style.overflowX = 'visible';
    setup.viewport.style.overflowY = 'visible';
    expect(setup.read().paint.width).toBe(273.84375);
  });
  it('preserves actual glyph movement even when the clipped frame stays unchanged', () => {
    const setup = fixture(true);
    const before = setup.read();
    setup.boxes.glyphs = new DOMRect(44, 204, 245.84375, 24);
    const after = setup.read();
    expect(after.paint).toEqual(before.paint);
    expect(after.glyphs.x - before.glyphs.x).toBe(2);
    expect(source).toContain('`code text glyphs.${dimension}`');
  });
  it('retains displacement of the actual pre inside its clip', () => {
    const setup = fixture(true);
    setup.boxes.pre = new DOMRect(30, 190, 273.84375, 52);
    expect(setup.read().paint).toEqual({ x: 30, y: 190, width: 261, height: 52 });
  });
  it('rejects a marked sibling that does not contain the native pre', () => {
    const setup = fixture(true);
    setup.container.append(setup.pre.parentElement!);
    expect(setup.read).toThrow('containing viewport');
  });
  it('rejects duplicate viewport ownership', () => {
    const setup = fixture(true);
    const duplicate = document.createElement('div');
    duplicate.dataset.codeScrollViewport = '';
    setup.container.append(duplicate);
    expect(setup.read).toThrow('containing viewport');
  });
  it('rejects a duplicate native pre', () => {
    const setup = fixture();
    setup.container.append(document.createElement('pre'));
    expect(setup.read).toThrow('unique owned native pre');
  });
  it('keeps a zero-height clip observable instead of certifying visible text', () => {
    const setup = fixture(true);
    Object.defineProperty(setup.viewport, 'clientHeight', { value: 0 });
    expect(setup.read().paint.height).toBe(0);
  });
  it('rejects missing authored code text', () => {
    const setup = fixture();
    setup.pre.replaceChildren();
    expect(setup.read).toThrow('remain readable');
  });
});
