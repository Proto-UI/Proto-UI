// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { recordLibraryFontTrace } from './library-card-font-trace';
let fonts: EventTarget & { status: string; [Symbol.iterator](): Iterator<object> };
let face: {
  family: string;
  status: string;
  display: string;
  weight: string;
  style: string;
  stretch: string;
};
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
beforeEach(() => {
  document.body.innerHTML = `<article data-library="brutalist">
    <span class="library-card__kind">Family · status</span>
    <h2><span data-library-part="brutalist-text">Brutalist</span></h2>
    <a data-library-action><span data-library-part="brutalist-text">Explore <b>→</b></span></a>
  </article>`;
  face = {
    family: 'Controlled face',
    status: 'loading',
    display: 'optional',
    weight: '100 1000',
    style: 'normal',
    stretch: 'normal',
  };
  fonts = Object.assign(new EventTarget(), {
    status: 'loading',
    *[Symbol.iterator]() {
      yield face;
    },
  });
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
  // Happy DOM's rectangles are not browser font/layout evidence.
});
afterEach(() => {
  recordLibraryFontTrace('stop');
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else delete (document as unknown as { fonts?: unknown }).fonts;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
const finish = () =>
  recordLibraryFontTrace('stop') as {
    checkpoints: Record<
      string,
      {
        nodes: Array<{ id: number; textNodes: Array<{ id: number }> }>;
        faces: Array<{ id: number; status: string }>;
      }
    >;
    rows: Array<{ reason: string }>;
    dropped: number;
    errors: string[];
  };

it('keeps face, host and text identities stable across movement and distinguishes replacement', async () => {
  recordLibraryFontTrace('held-before');
  const title = document.querySelector('h2 span')!;
  const text = title.firstChild!;
  title.append(text);
  recordLibraryFontTrace('same-node');
  title.replaceChildren(document.createTextNode('Brutalist'));
  face.status = 'loaded';
  fonts.status = 'loaded';
  fonts.dispatchEvent(new Event('loadingdone'));
  recordLibraryFontTrace('enhanced-after');
  const result = finish();
  expect(result.errors).toEqual([]);
  const before = result.checkpoints['held-before'];
  const same = result.checkpoints['same-node'];
  const after = result.checkpoints['enhanced-after'];
  expect(same.nodes[1]).toEqual(before.nodes[1]);
  expect(after.nodes[1].id).toBe(before.nodes[1].id);
  expect(after.nodes[1].textNodes[0].id).not.toBe(before.nodes[1].textNodes[0].id);
  expect(after.faces[0].id).toBe(before.faces[0].id);
  expect(after.faces[0].status).toBe('loaded');
  expect(result.rows.some((row) => row.reason === 'fonts.loadingdone')).toBe(true);
});

it('caps event storage while preserving exact endpoint checkpoints and disconnects cleanly', () => {
  recordLibraryFontTrace('held-before');
  for (let index = 0; index < 110; index++) fonts.dispatchEvent(new Event('loading'));
  recordLibraryFontTrace('enhanced-after');
  const result = finish();
  expect(result.rows).toHaveLength(96);
  expect(result.dropped).toBe(14);
  expect(Object.keys(result.checkpoints)).toEqual(['held-before', 'enhanced-after', 'stop']);
  fonts.dispatchEvent(new Event('loadingdone'));
  expect(result.rows).toHaveLength(96);
  expect(
    (window as unknown as { __libraryFontTrace?: unknown }).__libraryFontTrace
  ).toBeUndefined();
});

it('contains observer read errors without changing the DOM or invoking focus/font loads', () => {
  const html = document.body.innerHTML;
  const focus = vi.spyOn(HTMLElement.prototype, 'focus');
  recordLibraryFontTrace('held-before');
  const read = vi.spyOn(document, 'createRange').mockImplementation(() => {
    throw new Error('controlled read fault');
  });
  fonts.dispatchEvent(new Event('loadingdone'));
  read.mockRestore();
  const result = finish();
  expect(result.errors).toEqual(['fonts.loadingdone: Error: controlled read fault']);
  expect(document.body.innerHTML).toBe(html);
  expect(focus).not.toHaveBeenCalled();
});
