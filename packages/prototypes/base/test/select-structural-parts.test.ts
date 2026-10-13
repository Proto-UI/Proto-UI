import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { definePrototype } from '@proto.ui/core';
import {
  selectRoot,
  selectContent,
  selectGroup,
  selectLabel,
  selectSeparator,
  selectItem,
  selectSurface,
  selectViewport,
  selectItemText,
  asSelectGroup,
  asSelectLabel,
  asSelectSeparator,
} from '../src/select';

for (const proto of [
  selectRoot,
  selectContent,
  selectGroup,
  selectLabel,
  selectSeparator,
  selectItem,
  selectSurface,
  selectViewport,
  selectItemText,
])
  AdaptToWebComponent(proto as any);
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const part = (name: string, props: Record<string, unknown> = {}) => {
  const element = document.createElement('base-select-' + name) as any;
  setElementProps(element, props);
  return element;
};
const item = (value: string) => {
  const e = part('item', { value, textValue: value });
  e.textContent = value;
  return e;
};
const group = (text: string) => {
  const g = part('group'),
    l = part('label');
  l.textContent = text;
  g.append(l);
  return { g, l };
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

it('keeps two genuine group-local names and mixed item order without changing selection ownership', async () => {
  const root = part('root', { defaultValue: 'b' }),
    content = part('content');
  const a = group('First'),
    b = group('Second'),
    separator = part('separator');
  a.g.append(item('a'));
  b.g.append(item('b'));
  content.append(item('before'), a.g, separator, b.g, item('after'));
  root.append(content);
  document.body.append(root);
  await flush();
  expect(a.g.getAttribute('role')).toBe('group');
  expect(a.l.id).not.toBe('');
  expect(b.l.id).not.toBe('');
  expect(a.l.id).not.toBe(b.l.id);
  expect(a.g.getAttribute('aria-labelledby')).toBe(a.l.id);
  expect(b.g.getAttribute('aria-labelledby')).toBe(b.l.id);
  expect(
    root
      .getExposes()
      .getCollectionItems()
      .map((entry: any) => entry.value)
  ).toEqual(['before', 'a', 'b', 'after']);
  expect(root.getExposes().value.get()).toBe('b');
  expect(root.getExposes().textValue.get()).toBe('b');
  for (const passive of [a.g, a.l, separator]) {
    expect(passive.getAttribute('tabindex')).toBeNull();
    for (const key of [
      'requestValue',
      'requestOpen',
      'focusSelf',
      'getCollectionItems',
      'getCollectionItem',
    ])
      expect(passive.getExposes()[key]).toBeUndefined();
  }
});

it('names nested groups locally and stops malformed nested Select labels at the Select boundary', async () => {
  const root = part('root'),
    content = part('content'),
    outer = group('Outer');
  const inner = group('Inner'),
    nestedRoot = part('root'),
    nestedContent = part('content'),
    nested = group('Nested Select');
  const orphan = part('label');
  orphan.textContent = 'Not the outer label';
  nestedContent.append(orphan, nested.g);
  nestedRoot.append(nestedContent);
  outer.g.append(inner.g, nestedRoot);
  content.append(outer.g);
  root.append(content);
  document.body.append(root);
  await flush();
  expect(outer.g.getAttribute('aria-labelledby')).toBe(outer.l.id);
  expect(inner.g.getAttribute('aria-labelledby')).toBe(inner.l.id);
  expect(nested.g.getAttribute('aria-labelledby')).toBe(nested.l.id);
  expect(nestedRoot.getAttribute('role')).toBeNull();
  expect(nestedRoot.getAttribute('aria-labelledby')).toBeNull();
  outer.l.remove();
  await flush();
  expect(outer.g.getAttribute('aria-labelledby')).toBeNull();
  expect(nested.g.getAttribute('aria-labelledby')).toBe(nested.l.id);
});

it('fails closed for missing and duplicate labels, then rebinds removal and replacement', async () => {
  const root = part('root'),
    content = part('content'),
    g = part('group');
  content.append(g);
  root.append(content);
  document.body.append(root);
  await flush();
  expect(g.getAttribute('aria-labelledby')).toBeNull();
  const one = part('label'),
    two = part('label');
  one.textContent = 'One';
  two.textContent = 'Two';
  g.append(one);
  await flush();
  expect(g.getAttribute('aria-labelledby')).toBe(one.id);
  g.append(two);
  await flush();
  expect(g.getAttribute('aria-labelledby')).toBeNull();
  two.remove();
  await flush();
  expect(g.getAttribute('aria-labelledby')).toBe(one.id);
  one.remove();
  await flush();
  expect(g.getAttribute('aria-labelledby')).toBeNull();
  const replacement = part('label');
  replacement.textContent = 'Replacement';
  g.append(replacement);
  await flush();
  expect(g.getAttribute('aria-labelledby')).toBe(replacement.id);
});

it('reparents labels and groups without stale source names, and cleans disposed scopes', async () => {
  const root = part('root'),
    content = part('content'),
    a = group('Moving'),
    b = part('group');
  content.append(a.g, b);
  root.append(content);
  document.body.append(root);
  await flush();
  b.append(a.l);
  await flush();
  expect(a.g.getAttribute('aria-labelledby')).toBeNull();
  expect(b.getAttribute('aria-labelledby')).toBe(a.l.id);
  const second = part('root'),
    secondContent = part('content');
  second.append(secondContent);
  document.body.append(second);
  secondContent.append(b);
  await flush();
  expect(b.getAttribute('aria-labelledby')).toBe(a.l.id);
  root.remove();
  await flush();
  expect(b.getAttribute('aria-labelledby')).toBe(a.l.id);
  second.remove();
  await flush();
  const next = part('root'),
    nextContent = part('content'),
    nextGroup = group('Fresh');
  nextContent.append(nextGroup.g);
  next.append(nextContent);
  document.body.append(next);
  await flush();
  expect(nextGroup.g.getAttribute('aria-labelledby')).toBe(nextGroup.l.id);
});

it('preserves Viewport item collection order through optional Group wrappers', async () => {
  const root = part('root'),
    content = part('content'),
    surface = part('surface'),
    viewport = part('viewport'),
    g = group('Options');
  const a = item('a'),
    b = item('b');
  const text = part('item-text');
  text.textContent = 'a';
  a.replaceChildren(text);
  g.g.append(a);
  viewport.append(g.g, b);
  surface.append(viewport);
  content.append(surface);
  root.append(content);
  document.body.append(root);
  await flush();
  expect(
    root
      .getExposes()
      .getCollectionItems()
      .map((entry: any) => entry.value)
  ).toEqual(['a', 'b']);
});

it('exports equivalent direct and authored hooks, and separator is hidden and contentless', async () => {
  for (const [name, hook] of [
    ['group', asSelectGroup],
    ['label', asSelectLabel],
    ['separator', asSelectSeparator],
  ] as const) {
    AdaptToWebComponent(
      definePrototype({
        name: 'test-select-' + name,
        setup() {
          hook();
          if (name === 'separator') return () => null;
        },
      }) as any
    );
  }
  const root = part('root'),
    content = part('content');
  const g = document.createElement('test-select-group'),
    l = document.createElement('test-select-label'),
    s = document.createElement('test-select-separator');
  l.textContent = 'Hook label';
  s.append(document.createElement('button'));
  g.append(l);
  content.append(g, s);
  root.append(content);
  document.body.append(root);
  await flush();
  expect(g.getAttribute('aria-labelledby')).toBe(l.id);
  expect(s.getAttribute('aria-hidden')).toBe('true');
  expect(s.getAttribute('role')).toBeNull();
  expect(s.querySelector('slot')).toBeNull();
  expect(s.querySelector('button')).toBeNull();
  expect(s.childNodes).toHaveLength(0);
});
