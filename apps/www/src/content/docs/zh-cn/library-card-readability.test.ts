import { expect, it } from 'vitest';
import {
  libraryCardFontFailures,
  libraryCardReadabilityFailures,
} from './library-card-readability';

const text = (width = 160, fontSize = '32px', overflow = 0) => ({
  width,
  fontSize,
  overflow,
  effectiveOpacity: 1,
  visibility: 'visible',
});
const card = () => ({
  family: 'shadcn',
  root: text(176),
  title: text(158, '48px'),
  body: text(),
  action: text(),
  textLeaves: [text(), text()],
});

it('rejects the recorded c49 single-letter columns even when every root fits', () => {
  // Actual no-script-320-text-200.json: c49ae230 / tree 5eec47cd.
  for (const [family, width, overflow] of [
    ['base', 16, 19],
    ['shadcn', 14, 21],
    ['lucide', 16, 17],
  ] as const) {
    const measured = { ...card(), family, title: text(width, '48px', overflow) };
    expect(measured.root.overflow).toBe(0);
    expect(libraryCardReadabilityFailures([measured])).toEqual([
      `${family}.title: width=${width}, overflow=${overflow}`,
      `${family}.title: fewer than three ems of reading width`,
    ]);
  }
});

it('rejects collapsed, overflowing or hidden leaves independently of the root', () => {
  expect(libraryCardReadabilityFailures([card()])).toEqual([]);
  const narrow = card();
  narrow.title.width = 100;
  expect(libraryCardReadabilityFailures([narrow])).toContain(
    'shadcn.title: fewer than three ems of reading width'
  );
  const squeezed = card();
  squeezed.textLeaves[0].width = 32;
  expect(libraryCardReadabilityFailures([squeezed])).toEqual([
    'shadcn.text[0]: fewer than two ems of reading width',
  ]);
  const overflow = card();
  overflow.textLeaves[1].overflow = 3;
  expect(libraryCardReadabilityFailures([overflow])).toEqual([
    'shadcn.text[1]: width=160, overflow=3',
  ]);
  const hidden = card();
  hidden.textLeaves[0].effectiveOpacity = 0;
  expect(libraryCardReadabilityFailures([hidden])).toEqual(['shadcn.text[0]: hidden text']);
  const missing = card();
  missing.textLeaves = [];
  expect(libraryCardReadabilityFailures([missing])).toEqual(['shadcn: missing text leaves']);
});

const fonts = (familyName = 'DM Sans 9pt', isCustomFont = true) => ({
  nodes: ['caption', 'title', 'action'].map((name) => ({
    name,
    fonts: [
      { familyName, isCustomFont, glyphCount: 9 },
      ...(name !== 'title'
        ? [{ familyName: 'Noto Sans CJK SC', isCustomFont: false, glyphCount: 2 }]
        : []),
    ],
  })),
});

it('requires real DM Sans glyphs and permits the existing CJK fallback', () => {
  expect(libraryCardFontFailures(fonts())).toEqual([]);
  expect(libraryCardFontFailures(fonts('DejaVu Sans', false))).toEqual([
    'caption: real DM Sans glyphs missing',
    'title: real DM Sans glyphs missing',
    'title: unexpected fallback glyphs',
    'action: real DM Sans glyphs missing',
  ]);
  expect(libraryCardFontFailures({ error: 'CDP unavailable', nodes: [] })).toContain(
    'CDP unavailable'
  );
  const missing = fonts();
  missing.nodes[1].fonts = [];
  expect(libraryCardFontFailures(missing)).toEqual(['title: real DM Sans glyphs missing']);
});
