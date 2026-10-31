import { describe, expect, it, vi } from 'vitest';
import { createHomepageLocaleSelect, parseHomepageLocale } from './homepage-locale-select';
import type { DemoNode } from '../PrototypePreviewer/demo-types';
import { assertProjectionRecipeClosure } from '../PrototypePreviewer/projection-composition';

const locale = {
  value: 'en',
  label: 'Language',
  options: [
    { value: 'en', label: 'English', path: '/en/' },
    { value: 'zh-cn', label: '简体中文', path: '/zh-cn/' },
  ],
};
function nodes(node: DemoNode): DemoNode[] {
  return [
    node,
    ...('children' in node
      ? (node.children || []).flatMap((child) => (typeof child === 'string' ? [] : nodes(child)))
      : []),
  ];
}
describe('homepage locale Select composition', () => {
  describe.each(['shadcn', 'brutalist'] as const)('%s exact authored recipe', (family) => {
    it.each(['wc', 'react', 'vue', 'vue2'] as const)(
      '%s declares only the actual locale Select anatomy',
      (runtime) => {
        const { demo, prototypeIds } = createHomepageLocaleSelect(locale, family, runtime, () => true);
        const expected = ['root', 'trigger', 'value', 'content', 'item'].map(
          (part) => `${family}-select-${part}`
        );
        if (family === 'shadcn')
          expected.push('shadcn-select-surface', 'shadcn-select-viewport', 'shadcn-select-item-text');
        expect([...prototypeIds].sort()).toEqual(expected.sort());
        expect(new Set(prototypeIds).size).toBe(prototypeIds.length);
        expect(() =>
          assertProjectionRecipeClosure(demo.root, prototypeIds, 'homepage-home-language')
        ).not.toThrow();
        const authored = nodes(demo.root)
          .filter((node) => node.kind === 'proto')
          .map((node) => node.prototypeId);
        expect([...new Set(authored)].sort()).toEqual([...prototypeIds].sort());
      }
    );

    it('still rejects an undeclared trigger and an unused required part', () => {
      const { demo, prototypeIds } = createHomepageLocaleSelect(locale, family, 'wc', () => true);
      expect(() =>
        assertProjectionRecipeClosure(
          demo.root,
          prototypeIds.filter((id) => id !== `${family}-select-trigger`),
          'homepage-home-language'
        )
      ).toThrow(`uses undeclared Prototype(s): ${family}-select-trigger`);
      expect(() =>
        assertProjectionRecipeClosure(
          demo.root,
          [...prototypeIds, `${family}-select-group`],
          'homepage-home-language'
        )
      ).toThrow(`missing required Prototype(s): ${family}-select-group`);
    });
  });

  it.each(['shadcn', 'brutalist'] as const)(
    '%s uses public Select anatomy and the current locale',
    (family) => {
      const { demo, prototypeIds } = createHomepageLocaleSelect(locale, family, 'wc', () => true);
      const all = nodes(demo.root);
      expect(all.some((node) => node.kind === 'box' && node.tag === 'a')).toBe(false);
      expect(
        all.find((node) => node.kind === 'proto' && node.ref === 'home-locale-root')
      ).toMatchObject({
        prototypeId: `${family}-select-root`,
        props: { value: 'en', closeOnSelect: true },
      });
      const trigger = all.find(
        (node) => node.kind === 'proto' && node.ref === 'home-locale-trigger'
      );
      expect(trigger).toMatchObject({
        props: { accessibleLabel: 'Language' },
      });
      expect(prototypeIds).toContain(`${family}-select-trigger`);
      if (family === 'shadcn') expect(prototypeIds).toContain('shadcn-select-item-text');
    }
  );
  it.each(['wc', 'react', 'vue', 'vue2'] as const)(
    '%s binds one event channel and retires stale navigation',
    (runtime) => {
      window.history.replaceState(null, '', '/en/?q=1#anchor');
      document.body.innerHTML =
        '<div id="owner"><div id="root"></div><button id="trigger"></button></div>';
      const owner = document.querySelector<HTMLElement>('#owner')!;
      const root = document.querySelector<HTMLElement>('#root')!;
      const trigger = document.querySelector<HTMLElement>('#trigger')!;
      const setProps = vi.fn();
      const call = vi.fn();
      let active = false;
      const { demo } = createHomepageLocaleSelect(locale, 'shadcn', runtime, () => active);
      const cleanup = demo.setup!({
        host: owner,
        refs: {
          'home-locale-owner': owner,
          'home-locale-root': root,
          'home-locale-trigger': trigger,
        },
        api: { call, setProps, getExposes: () => undefined },
      });
      const callback =
        runtime === 'wc'
          ? (detail: unknown) => root.dispatchEvent(new CustomEvent('valueChange', { detail }))
          : setProps.mock.calls[0][1].onValueChange;
      callback({ value: 'zh-cn' });
      expect(call).not.toHaveBeenCalled();
      active = true;
      callback({ value: 'zh-cn' });
      expect(call).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/zh-cn/');
      expect(window.location.search).toBe('?q=1');
      if (typeof cleanup === 'function') cleanup();
      callback({ value: 'en' });
      expect(call).toHaveBeenCalledTimes(1);
      document.body.replaceChildren();
    }
  );
});

it.each([
  '{',
  'null',
  '{"value":"en","label":"Language","options":[]}',
  '{"value":"en","label":"Language","options":[{"value":"en","label":"English","path":"//external.example/"}]}',
])('rejects malformed locale metadata without throwing: %s', (raw) => {
  expect(parseHomepageLocale(raw)).toBeUndefined();
});
it('retains a validated metadata snapshot and explicit shared Header appearance', () => {
  expect(parseHomepageLocale(JSON.stringify(locale))).toEqual(locale);
  const { demo } = createHomepageLocaleSelect(locale, 'shadcn', 'wc', () => true);
  const all = nodes(demo.root);
  expect(
    all.find((node) => node.kind === 'proto' && node.ref === 'home-locale-root')
  ).toMatchObject({ props: { styleProfile: 'rhea' } });
  expect(
    all.find((node) => node.kind === 'proto' && node.ref === 'home-locale-trigger')
  ).toMatchObject({ props: { appearance: 'default' } });
});
