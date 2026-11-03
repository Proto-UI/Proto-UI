// @vitest-environment node
// Definition/oracle checks only. Never imports or executes the native browser suite.
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { expect, it } from 'vitest';
import insetDemo from '../demo-shadcn-dropdown-inset.demo';
import { parse } from 'yaml';
import {
  DROPDOWN_DEMOS,
  dropdownPreviewSelector,
  channelsClose,
  hasNamedDropdownGroup,
} from './finf-dropdown-recipe-evidence';
const file = 'apps/www/src/content/docs/zh-cn/finf-dropdown-recipes.browser.test.ts';
const source = readFileSync(file, 'utf8');
it('selects the intended second/third previewers by DemoID despite order or unrelated siblings', () => {
  const window = new Window();
  try {
    window.document.body.innerHTML = `<section data-previewer-id="old" data-demo-id="demo-shadcn-dropdown"></section><section data-previewer-id="second" data-demo-id="${DROPDOWN_DEMOS.destructive}"></section><section data-previewer-id="third" data-demo-id="${DROPDOWN_DEMOS.inset}"></section>`;
    expect(
      window.document
        .querySelector(dropdownPreviewSelector('destructive'))
        ?.getAttribute('data-previewer-id')
    ).toBe('second');
    expect(
      window.document
        .querySelector(dropdownPreviewSelector('inset'))
        ?.getAttribute('data-previewer-id')
    ).toBe('third');
    window.document.body.prepend(window.document.body.lastElementChild!);
    expect(
      window.document
        .querySelector(dropdownPreviewSelector('inset'))
        ?.getAttribute('data-previewer-id')
    ).toBe('third');
  } finally {
    window.happyDOM.abort();
  }
  expect(source).not.toContain('.first()');
  expect(source).not.toContain('waitForPreviewRuntime');
  expect(source).toContain("trigger.getAttribute('aria-controls')");
});
it('retains exact-source sandbox, loopback, timeouts and failure receipts', () => {
  for (const guard of [
    'process.env.GITHUB_ACTIONS',
    'process.env.CANDIDATE_SHA',
    "['diff', '--name-only', 'HEAD']",
    "['ls-files', '--others', '--exclude-standard']",
    'chromiumSandbox: true',
    'blocked-before-browser',
    "context.route('**/*'",
    'route.abort()',
    'setDefaultTimeout(15_000)',
    'setDefaultNavigationTimeout(30_000)',
    '90_000',
    '80_000',
    'clearTimeout(watchdog)',
    '60_000',
    'finally',
    'await context?.close()',
    'await stopServer()',
    'expect(errors).toEqual([])',
    'expect(deniedRequests).toEqual([])',
    "createHash('sha256')",
  ])
    expect(source).toContain(guard);
  expect(source).toMatch(/revision,\s+tree,/);
  for (const forbidden of [
    '--no-sandbox',
    'dispatchEvent(',
    'setElementProps(',
    'waitForTimeout(',
    'addStyleTag(',
    '.skip(',
  ])
    expect(source).not.toContain(forbidden);
});
it('separates rest/focus/held press, checks disabled ownership and inset/Lucide output', () => {
  for (const assertion of [
    "capture('rest'",
    "capture('focus'",
    "capture('pressed'",
    "capture('disabled'",
    "capture('inset'",
    "capture('closed'",
    'await page.mouse.down()',
    "item.getAttribute('data-pressed')",
    "page.keyboard.press('End')",
    "page.keyboard.press('Space')",
    "menu.waitFor({ state: 'hidden' })",
    'measured.rem * 2',
    'label.rem * 0.5',
    "viewBox: '0 0 24 24'",
    'width: 16',
    'aria-labelledby',
  ])
    expect(source).toContain(assertion);
  expect(source.indexOf("capture('pressed'")).toBeLessThan(source.indexOf('await page.mouse.up()'));
});
it('rejects wrong alpha, accent/foreground colors and invalid computed channels', () => {
  expect(channelsClose([220, 20, 40, 26], [220, 20, 40, 26])).toBe(true);
  expect(channelsClose([220, 20, 40, 51], [220, 20, 40, 26])).toBe(false);
  expect(channelsClose([210, 210, 210, 255], [220, 20, 40, 26])).toBe(false);
  expect(channelsClose([NaN, 20, 40, 26], [220, 20, 40, 26])).toBe(false);
  expect(channelsClose([1, 2, 3], [1, 2, 3])).toBe(false);
});
it('keeps browser catalog implementations planned until real terminal receipts exist', () => {
  for (const component of ['ITEM', 'LABEL']) {
    const entity = parse(
      readFileSync(`spec/tests/T-SHADCN-DROPDOWN-MENU-${component}-0001.yaml`, 'utf8')
    );
    const implementation = entity.implementations.find(
      (value: { path?: string }) => value.path === file
    );
    expect(entity.status).toBe('draft');
    expect(implementation).toMatchObject({
      kind: 'adapter-test',
      status: 'planned',
      required: true,
    });
  }
});

it('rejects absent, mismatched or non-group Label naming relations', () => {
  expect(hasNamedDropdownGroup('group', 'label-id', 'label-id')).toBe(true);
  expect(hasNamedDropdownGroup('group', null, null)).toBe(false);
  expect(hasNamedDropdownGroup('group', 'label-id', null)).toBe(false);
  expect(hasNamedDropdownGroup('group', null, 'label-id')).toBe(false);
  expect(hasNamedDropdownGroup('group', 'wrong-label', 'label-id')).toBe(false);
  expect(hasNamedDropdownGroup(null, 'label-id', 'label-id')).toBe(false);
  expect(hasNamedDropdownGroup('group', '', '')).toBe(false);
  expect(source).toContain('expect(\n                hasNamedDropdownGroup(');
});

it('drives inset changes through the public demo control and keeps the fixed physical-left oracle', () => {
  const callbacks = new Map<string, Record<string, unknown>>();
  insetDemo.setup({
    host: {} as HTMLElement,
    refs: {},
    api: {
      call: () => undefined,
      getExposes: () => undefined,
      setProps(ref, next) {
        callbacks.set(ref, { ...callbacks.get(ref), ...next });
      },
    },
  });
  const click = callbacks.get('toggle-inset')?.onClick as () => void;
  expect(click).toBeTypeOf('function');
  for (const inset of [false, true, false, true]) {
    click();
    for (const name of ['more-label', 'paste', 'rename'])
      expect(callbacks.get(name)).toEqual({ inset });
  }
  expect(source).toContain('02cad61166c4c20edbc8a3f71bd720eed4c1f49b');
  expect(source).not.toContain('c2a67849be260701852b0977ba15eb5f3a0ce2a4');
  expect(source).toContain("for (const direction of ['ltr', 'rtl'] as const)");
  expect(source).toContain('[true, false, true].entries()');
  expect(source).toContain('geometry.paddingRight');
  expect(source).toContain('geometry.direction');
  expect(source).toContain('.toBe(enabled ? 2 : 0.5)');
});

it('sets direction at the demo author boundary and observes portal propagation before geometry', () => {
  // Starlight gives main its own locale direction, so changing html alone is insufficient.
  expect(source).toContain('await previewer.evaluate(');
  expect(source).toContain("(element, dir) => element.setAttribute('dir', dir)");
  expect(source).toContain(
    '.poll(() => trigger.evaluate((element) => getComputedStyle(element).direction))'
  );
  expect(source).toContain(
    '.poll(() => menu.evaluate((element) => getComputedStyle(element).direction))'
  );
  expect(source).not.toContain('document.documentElement.dir = dir');
  expect(source).toContain('expect(geometry.direction).toBe(direction)');
  expect(source).toContain("if (original === null) element.removeAttribute('dir')");
});
