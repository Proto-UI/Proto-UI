import { describe, expect, it } from 'vitest';
import { isPreviewCandidate, readPreviewSource, staticSvgText } from './documentation-image-source';
const svg = (children: string, attributes = '') => {
  const div = document.createElement('div');
  div.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-label="diagram" ${attributes}>${children}</svg>`;
  return div.firstElementChild as unknown as SVGSVGElement;
};
describe('bounded static inline SVG admission', () => {
  it('admits plain static shapes and text without modifying the original', () => {
    const source = svg(
      '<g fill="currentColor"><path d="M0 0 L10 10"/><text x="5" y="10">A &amp; B</text></g>'
    );
    const before = source.outerHTML;
    expect(staticSvgText(source)).toContain('A &amp; B');
    expect(source.outerHTML).toBe(before);
  });
  it.each([
    '<script>alert(1)</script>',
    '<foreignObject><div>active</div></foreignObject>',
    '<style>path { fill: url(https://example.com/a) }</style>',
    '<image href="https://example.com/a.png"/>',
    '<use href="#a"/>',
    '<defs><g id="a"><use href="#a"/></g></defs>',
    '<path onload="alert(1)"/>',
    '<a href="https://example.com"><path/></a>',
    '<animate attributeName="fill"/>',
    '<svg><path/></svg>',
    '<path style="fill:red"/>',
    '<path fill="url(#a)"/>',
    '<path fill="u&#114;l(https://example.com/a)"/>',
    '<path fill="u\\72l(#a)"/>',
    '<path class="external-style"/>',
    '<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#a"/>',
    '<path xmlns="http://example.com/other"/>',
    '<!-- comment -->',
  ])('declines unsupported markup without trying to sanitize: %s', (markup) => {
    expect(staticSvgText(svg(markup))).toBeNull();
  });
  it('declines namespaced attributes and processing instructions', () => {
    expect(staticSvgText(svg('<path/>', 'xml:base="https://example.com"'))).toBeNull();
  });
  it('bounds total element and serialization size', () => {
    expect(staticSvgText(svg('<path/>'.repeat(1001)))).toBeNull();
  });
});
describe('rendered Markdown/MDX media candidates', () => {
  function fixture(markup: string) {
    const content = document.createElement('div');
    content.className = 'sl-markdown-content';
    content.innerHTML = markup;
    const media = content.querySelector('img')!;
    return { content, media };
  }
  it.each([
    'a href="/go"',
    'button',
    'div role="button"',
    'div tabindex="0"',
    'custom-demo',
    'div data-image-preview="off"',
  ])('does not steal existing %s behavior', (parent) => {
    const tag = parent.split(' ')[0];
    const { media, content } = fixture(`<${parent}><img src="/a.svg" alt="diagram"/></${tag}>`);
    expect(isPreviewCandidate(media, content)).toBe(false);
  });
  it('preserves current image URL, original alt and authored caption', () => {
    const { media, content } = fixture(
      '<figure><picture><source srcset="/hi.png 2x"/><img src="/a.svg" alt="original"/></picture><figcaption>Author caption</figcaption></figure>'
    );
    expect(isPreviewCandidate(media, content)).toBe(true);
    expect(readPreviewSource(media)).toMatchObject({ alt: 'original', caption: 'Author caption' });
  });
  it('keeps decorative and explicitly disabled images unenhanced', () => {
    for (const attrs of [
      'alt=""',
      'alt="figure" aria-hidden="true"',
      'alt="figure" role="presentation"',
      'alt="figure" data-image-preview="off"',
    ]) {
      expect(readPreviewSource(fixture(`<img src="/a.png" ${attrs}/>`).media)).toBeNull();
    }
  });
  it.each(['hidden', 'inert', 'contenteditable="true"', 'usemap="#hotspots"', 'controls'])(
    'does not enhance native media boundary %s',
    (attrs) => {
      const { media, content } = fixture(`<img src="/a.png" alt="Figure" ${attrs}/>`);
      expect(readPreviewSource(media)).toBeNull();
      expect(isPreviewCandidate(media, content)).toBe(false);
    }
  );
  it.each(['hidden', 'inert', 'contenteditable="true"'])(
    'does not enhance within native ancestor boundary %s',
    (attrs) => {
      const { media, content } = fixture(`<div ${attrs}><img src="/a.png" alt="Figure"/></div>`);
      expect(readPreviewSource(media)).toBeNull();
      expect(isPreviewCandidate(media, content)).toBe(false);
    }
  );
  it.each([null, 'anonymous', 'use-credentials'])(
    'preserves CORS %s and authored no-referrer policy',
    (crossOrigin) => {
      const { media } = fixture(
        '<img src="https://example.com/a.png" alt="Figure" referrerpolicy="no-referrer"/>'
      );
      if (crossOrigin !== null) media.crossOrigin = crossOrigin;
      expect(readPreviewSource(media)).toMatchObject({
        crossOrigin,
        referrerPolicy: 'no-referrer',
      });
    }
  );
  it('does not accept active source schemes', () => {
    expect(
      readPreviewSource(fixture('<img src="javascript:alert(1)" alt="figure"/>').media)
    ).toBeNull();
  });
  it('retains the explicit legacy image trigger migration path', () => {
    const { content, media } = fixture(
      '<button data-diagram-open><img src="/a.svg" alt="figure"/></button>'
    );
    expect(isPreviewCandidate(media, content)).toBe(true);
  });
});
