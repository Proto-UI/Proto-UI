import assert from 'node:assert/strict';

// Serialized into the browser. Keep this read-only and self-contained: the
// viewport and the source content are different owners after ScrollArea adopts pre.
export function readCodeReadingGeometry(viewport: Element) {
  const source = viewport.matches('pre') ? viewport : viewport.querySelector('pre');
  if (!source) throw new Error('The reading viewport must contain its source pre');
  const css = getComputedStyle(source);
  const paddingTop = parseFloat(css.paddingTop);
  const paddingBottom = parseFloat(css.paddingBottom);
  const code = source.querySelector('code');
  return {
    owner: viewport.localName,
    containsSource: viewport.matches('pre') || viewport.contains(source),
    sourceHeight: source.getBoundingClientRect().height,
    sourceWidth: source.getBoundingClientRect().width,
    sourceContentHeight: source.clientHeight - paddingTop - paddingBottom,
    paddingTop,
    paddingBottom,
    codeHeight: code?.getBoundingClientRect().height ?? 0,
    lineHeights: [...(code?.querySelectorAll('.line') ?? [])].map(
      (line) => line.getBoundingClientRect().height
    ),
    overflowX: getComputedStyle(viewport).overflowX,
    overflowY: getComputedStyle(viewport).overflowY,
    height: viewport.clientHeight,
    fullHeight: viewport.scrollHeight,
    width: viewport.clientWidth,
    fullWidth: viewport.scrollWidth,
    lineHeight: parseFloat(css.lineHeight),
    rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
    viewportHeight: innerHeight,
    raw: code?.getAttribute('data-raw-code'),
    documentOverflow: document.documentElement.scrollWidth - innerWidth,
  };
}

export function assertNaturalOneLineCode(
  facts: ReturnType<typeof readCodeReadingGeometry>,
  kind: 'baseline' | 'candidate',
  label: string
) {
  assert.ok(facts.raw && facts.raw.split('\n').length === 1, `${label}: one real source line`);
  assert.ok(facts.lineHeight > 0, `${label}: a measurable line height`);
  assert.ok(
    facts.sourceContentHeight > 0 && Math.abs(facts.sourceContentHeight - facts.lineHeight) <= 1,
    `${label}: the source content box keeps its natural one-line height`
  );
  assert.ok(
    facts.height > 0 &&
      Math.abs(facts.height - facts.lineHeight - facts.paddingTop - facts.paddingBottom) <= 1 &&
      Math.abs(facts.fullHeight - facts.height) <= 1,
    `${label}: the reading viewport fits the whole line and its padding without blank height`
  );
  if (kind === 'candidate') {
    assert.equal(facts.lineHeights.length, 1, `${label}: one actual rendered source line`);
    assert.ok(
      Math.abs(facts.lineHeights[0]! - facts.lineHeight) <= 1 &&
        Math.abs(facts.codeHeight - facts.lineHeight) <= 1,
      `${label}: the actual line and code content retain their line height`
    );
    // This is an independent authored value, not a subtraction that would also
    // accept missing padding. The aged baseline retains its own historical style.
    const authoredPadding = 0.875 * facts.rootFontSize;
    assert.ok(
      authoredPadding > 0 &&
        Math.abs(facts.paddingTop - authoredPadding) <= 1 &&
        Math.abs(facts.paddingBottom - authoredPadding) <= 1,
      `${label}: the authored 0.875rem top and bottom source padding remains present`
    );
  }
}

export function assertClosedHeaderState(state: {
  menuCount: number;
  panelCount: number;
  expanded: string | null;
  hidden: boolean;
  inert: boolean;
  menuFocused: boolean;
}) {
  assert.equal(state.menuCount, 1, 'One actual Header menu command');
  assert.equal(state.panelCount, 1, 'One actual Header panel');
  assert.equal(state.expanded, 'false', 'Escape immediately collapses the Header command');
  assert.ok(state.hidden || state.inert, 'Any still-painted closing Header panel is inert');
  assert.ok(state.menuFocused, 'Escape immediately returns native focus to the Header command');
}
