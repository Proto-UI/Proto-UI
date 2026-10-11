import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { createReactAdapter, type ReactRuntime } from '@proto.ui/adapter-react';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '../src/tabs';
import beforeTrigger from './fixtures/tabs-trigger-before-underline';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import path from 'node:path';

const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
const React = require('react') as ReactRuntime;
const { renderToString } = require('react-dom/server') as { renderToString(node: unknown): string };
const adapt = createReactAdapter(React);
const root = adapt(tabsRoot),
  list = adapt(tabsList),
  content = adapt(tabsContent);
function ssr(trigger: typeof tabsTrigger) {
  const Trigger = adapt(trigger);
  return renderToString(
    React.createElement(
      root,
      { value: 'a' },
      React.createElement(list, {}, React.createElement(Trigger, { value: 'a' }, 'Alpha')),
      React.createElement(content, { value: 'a', keepMounted: true }, 'Panel')
    )
  );
}
it('retains the exact existing React SSR shell before hydration (neither snapshot claims live SSR styling)', () => {
  const before = ssr(beforeTrigger),
    after = ssr(tabsTrigger);
  expect(after).toBe(before);
  expect(before).toBe('');
  expect(after).toBe('');
  // This adapter initializes runtime visual facts at mount, not renderToString.
  expect(after).not.toContain('data-selected');
});
const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});
it('compares pre/post default CSS facts, restores default tokens, and bounds simulated paint evidence', async () => {
  const raw = await collectProtoStyleTokens(path.resolve('packages/prototypes/shadcn/src/tabs'));
  const old = await collectProtoStyleTokens(
    path.resolve('packages/prototypes/shadcn/test/fixtures')
  );
  const all = [...raw, ...old];
  if (!all.every((token): token is string => typeof token === 'string'))
    throw new Error('Non-string token');
  const style = document.createElement('style');
  style.textContent = renderProtoStyleTokenCss(all).replace(
    /@layer proto-ui \{\n([\s\S]*)\n\}\n$/,
    '$1'
  );
  document.head.append(style);
  cleanups.push(() => style.remove());
  const mount = (prefix: string, trigger: typeof tabsTrigger) => {
    for (const [part, proto] of [
      ['root', tabsRoot],
      ['list', tabsList],
      ['trigger', trigger],
    ] as const)
      if (!customElements.get(`${prefix}-${part}`))
        customElements.define(`${prefix}-${part}`, AdaptToWebComponent(proto, { register: false }));
    const r = document.createElement(`${prefix}-root`),
      l = document.createElement(`${prefix}-list`),
      t = document.createElement(`${prefix}-trigger`);
    setElementProps(r, { value: 'a' });
    setElementProps(t, { value: 'a' });
    t.style.setProperty('--pui-background', 'rgb(255, 255, 255)');
    t.style.setProperty('--pui-foreground', 'rgb(0, 0, 0)');
    t.style.setProperty('--pui-muted-foreground', 'rgb(100, 100, 100)');
    l.append(t);
    r.append(l);
    document.body.append(r);
    return t;
  };
  const before = mount('tabs-before', beforeTrigger),
    after = mount('tabs-after', tabsTrigger);
  await vi.waitFor(() => expect(after.getAttribute('aria-selected')).toBe('true'));
  await vi.waitFor(() => expect(after.getAttribute('data-pui-style')).toContain('bg-background'));
  for (const key of [
    'backgroundColor',
    'color',
    'borderRadius',
    'paddingLeft',
    'fontSize',
  ] as const)
    expect(getComputedStyle(after)[key], key).toBe(getComputedStyle(before)[key]);
  const defaultPaint = getComputedStyle(after).backgroundColor;
  expect(style.textContent).toContain('padding-inline: 0.5rem;');
  expect(defaultPaint).toBe('rgb(255, 255, 255)');
  expect(getComputedStyle(after).fontSize).toBe('14px');
  setElementProps(after, { value: 'a', appearance: 'underline' });
  await vi.waitFor(() => expect(after.getAttribute('data-pui-style')).toContain('border-b-2'));
  expect(getComputedStyle(after).backgroundColor).toBe('transparent');
  // HappyDOM wrongly matches ~="border" against border-0/border-b-2.
  // Assert exact source/CSS and current tokens here; native 2px paint is a CI gate.
  expect(after.getAttribute('data-pui-style')!.split(/\s+/)).not.toContain('border');
  expect(style.textContent).toContain('border-bottom-width: 2px;');
  expect(after.getAttribute('data-pui-style')!.split(/\s+/)).toContain('rounded-none');
  expect(after.getAttribute('data-pui-style')!.split(/\s+/)).not.toContain('rounded-md');
  setElementProps(after, { value: 'a', appearance: 'default' });
  await vi.waitFor(() => expect(getComputedStyle(after).backgroundColor).toBe(defaultPaint));
  expect(after.getAttribute('data-pui-style')).not.toContain('border-b-2');
  expect(getComputedStyle(after).paddingLeft).toBe(getComputedStyle(before).paddingLeft);
});

it('records the simulated selector limitation independently of any Proto or generated style', () => {
  const div = document.createElement('div');
  div.setAttribute('data-pui-style', 'border-0 border-b-2');
  expect(div.getAttribute('data-pui-style')!.split(/\s+/)).not.toContain('border');
  // Environment characterization, not a browser acceptance assertion. Native
  // selector matching must be false and is explicitly left to browser CI.
  expect(div.matches('[data-pui-style~="border"]')).toBe(true);
});
