import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import {
  acquireHeaderKeyboardFocus,
  type HeaderKeyboardSnapshot,
} from './quick-start-first-frame-keyboard';

const state = (nodeId: number, focused = false): HeaderKeyboardSnapshot => ({
  documentHasFocus: true,
  selectionRangeCount: 0,
  focused,
  active: {
    nodeId,
    tag: nodeId === 0 ? 'body' : 'a',
    inHeader: nodeId > 1,
    precedesHeader: nodeId === 1,
  },
  target: {
    tabIndex: 0,
    checkVisibility: true,
    disabled: false,
    blockedByClosedDetails: false,
    hiddenOrInert: false,
    rect: { width: 44, height: 44 },
    css: { display: 'block', visibility: 'visible', opacity: '1' },
  },
});
async function drive(states: HeaderKeyboardSnapshot[]) {
  let index = 0;
  const reads: number[] = [];
  const result = acquireHeaderKeyboardFocus(
    async () => {
      reads.push(index);
      return states[Math.min(index, states.length - 1)]!;
    },
    async () => {
      index++;
    }
  );
  return { result: await result, reads, presses: index };
}

describe('native Header keyboard driver (injected observations, no browser)', () => {
  it('walks the fresh-document prefix forward before any Selection is set', async () => {
    expect(await drive([state(0), state(1), state(2), state(3, true)])).toEqual({
      result: 3,
      reads: [0, 1, 2, 3],
      presses: 3,
    });
  });
  it('rejects the previous Range-first starting condition even if body is active', async () => {
    await expect(drive([{ ...state(0), selectionRangeCount: 1 }, state(3, true)])).rejects.toThrow(
      'no Selection'
    );
  });
  it('rejects a document without native focus', async () => {
    await expect(drive([{ ...state(0), documentHasFocus: false }])).rejects.toThrow(
      'focused fresh document'
    );
  });
  it('rejects an existing focused link instead of pretending it is a fresh document', async () => {
    await expect(drive([state(2)])).rejects.toThrow('body active');
  });
  it.each([
    ['negative tabindex', { tabIndex: -1 }],
    ['hidden ancestor', { hiddenOrInert: true }],
    ['closed details content', { blockedByClosedDetails: true }],
    ['native visibility rejection', { checkVisibility: false }],
    ['disabled control', { disabled: true }],
    ['zero geometry', { rect: { width: 0, height: 44 } }],
    ['hidden CSS', { css: { display: 'none', visibility: 'visible', opacity: '1' } }],
  ] as const)('rejects target %s before any key', async (_label, change) => {
    await expect(
      drive([{ ...state(0), target: { ...state(0).target, ...change } }])
    ).rejects.toThrow('prerequisites');
  });
  it('rejects a repeated node identity, without mistaking different anchors for a loop', async () => {
    await expect(drive([state(0), state(1), state(2), state(2)])).rejects.toThrow(
      'repeated a focus owner'
    );
  });
  it('stops when native Tab passes the Header prefix instead of scanning a sidebar', async () => {
    const outside = state(10);
    outside.active!.inHeader = false;
    await expect(drive([state(0), state(1), outside])).rejects.toThrow('passed the Header prefix');
  });
  it('does not raise its eight-step bound to make an unreachable target pass', async () => {
    await expect(drive(Array.from({ length: 10 }, (_, i) => state(i, i === 9)))).rejects.toThrow(
      'eight-step prefix'
    );
  });
  it('does not confuse a browser-created caret during Tab with a pre-existing code Range', async () => {
    expect(await drive([state(0), { ...state(2, true), selectionRangeCount: 1 }])).toMatchObject({
      result: 1,
    });
  });
  it('rejects focus leaving the document even if a stale target fact is true', async () => {
    await expect(drive([state(0), { ...state(2, true), documentHasFocus: false }])).rejects.toThrow(
      'left document focus'
    );
  });
});

it('the native lane labels exact identity/input/visibility and strictly checks Range setup', () => {
  const source = readFileSync(
    'apps/www/src/content/docs/zh-cn/quick-start-first-frame-fragment-control.browser.test.ts',
    'utf8'
  );
  for (const field of [
    'key: event.key',
    'shiftKey',
    'nodeId:',
    'href:',
    'tabIndex:',
    'blockedByClosedDetails',
    'contentVisibility:',
    'activePath:',
    'composedPath:',
    'root.mode',
    'documentHasFocus:',
  ])
    expect(source).toContain(
      field === 'key: event.key' ? 'key: event instanceof KeyboardEvent ? event.key : null' : field
    );
  const keyboard = source.slice(
    source.indexOf("          if (input === 'keyboard') {"),
    source.indexOf('          const before = await page.evaluate(readControl)')
  );
  expect(keyboard.indexOf('acquireHeaderKeyboardFocus(')).toBeLessThan(
    keyboard.indexOf('__nativeFragmentControl.selectCode()')
  );
  expect(keyboard).toContain('expect(');
  expect(keyboard).toContain('rangeSetup.focusRetained');
  expect(keyboard).not.toContain('.focus(');
  expect(keyboard).not.toContain('Shift+Tab');
  expect(source).toContain('expect(before.trustedTabCount).toBe(before.keyboardSteps)');
});

describe('actual native focus description (DOM-only observations)', () => {
  const source = readFileSync(
    'apps/www/src/content/docs/zh-cn/quick-start-first-frame-fragment-control.browser.test.ts',
    'utf8'
  );
  const raw = source
    .split('// native-focus-description-start\n')[1]
    ?.split('// native-focus-description-end')[0];
  if (!raw) throw new Error('Missing native descriptor');
  const install = () =>
    new Function(`${transformSync(raw, { loader: 'ts' }).code}\nreturn describe;`)() as (
      node: Node
    ) => any;
  it('distinguishes repeated identity from two separate anchors and records href/id/order', () => {
    document.body.innerHTML =
      '<a id="skip" href="#_top">Skip</a><header data-docs-site-header><a id="one" href="/one">One</a><a id="two" href="/two">Two</a></header><aside><a id="outside" href="/outside">Outside</a></aside>';
    const describe = install();
    const one = document.querySelector('#one')!;
    expect(describe(one).nodeId).toBe(describe(one).nodeId);
    expect(describe(one).nodeId).not.toBe(describe(document.querySelector('#two')!).nodeId);
    expect(describe(one)).toMatchObject({
      id: 'one',
      href: '/one',
      inHeader: true,
      precedesHeader: false,
    });
    expect(describe(document.querySelector('#skip')!)).toMatchObject({
      inHeader: false,
      precedesHeader: true,
    });
    expect(describe(document.querySelector('#outside')!)).toMatchObject({
      inHeader: false,
      precedesHeader: false,
    });
  });
  it('distinguishes the first summary of closed details from its closed content', () => {
    document.body.innerHTML =
      '<header data-docs-site-header><details><summary><span id="icon">Menu</span></summary><a href="/closed">Closed</a><summary id="second">Second summary</summary></details></header>';
    const describe = install();
    expect(describe(document.querySelector('summary')!).blockedByClosedDetails).toBe(false);
    expect(describe(document.querySelector('#icon')!).blockedByClosedDetails).toBe(false);
    expect(describe(document.querySelector('a')!).blockedByClosedDetails).toBe(true);
    expect(describe(document.querySelector('#second')!).blockedByClosedDetails).toBe(true);
  });
  it('retains hidden/inert ancestry and exposed shadow provenance without flattening it away', () => {
    document.body.innerHTML = '<header data-docs-site-header><div id="host" inert></div></header>';
    const root = document.querySelector('#host')!.attachShadow({ mode: 'open' });
    root.innerHTML = '<a id="shadow" href="/shadow" tabindex="-1">Shadow</a>';
    const value = install()(root.querySelector('a')!);
    expect(value).toMatchObject({
      root: { type: 'shadow', mode: 'open', host: 'div' },
      hiddenOrInert: true,
      tabIndex: -1,
    });
    expect(value.ancestors.some((node: any) => node.id === 'host' && node.inert)).toBe(true);
  });
});
