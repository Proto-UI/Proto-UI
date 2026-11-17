import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import { tabsRoot, tabsList, tabsTrigger } from '../src/tabs';
import { styleScope } from '../src/style-scope';

const Scope = AdaptToWebComponent(styleScope);
const Root = AdaptToWebComponent(tabsRoot);
const List = AdaptToWebComponent(tabsList);
const Trigger = AdaptToWebComponent(tabsTrigger);
const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
const stylesheet = document.createElement('style');

beforeAll(async () => {
  const tokens = await collectProtoStyleTokens(path.resolve('packages/prototypes/shadcn/src/tabs'));
  if (!tokens.every((token): token is string => typeof token === 'string'))
    throw new Error('Expected serializable Tabs style tokens');
  stylesheet.textContent = renderProtoStyleTokenCss(tokens).replace(
    /@layer proto-ui \{\n([\s\S]*)\n\}\n$/,
    '$1'
  );
  document.head.append(stylesheet);
});
afterAll(() => stylesheet.remove());
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('Shadcn Tabs underline keeps the unused decoration out of label flow', () => {
  for (const orientation of ['horizontal', 'vertical'] as const)
    for (const initialAppearance of ['underline', 'default'] as const)
      it(`${orientation}: ${initialAppearance} entry and appearance roundtrip preserve the live owner`, async () => {
        const scope = new Scope();
        const root = new Root();
        const list = new List();
        const trigger = new Trigger();
        const caller = document.createTextNode('Account');
        setElementProps(scope, { styleProfile: 'nova' });
        setElementProps(root, { value: 'a', orientation });
        setElementProps(list, { variant: 'line' });
        setElementProps(trigger, { value: 'a', appearance: initialAppearance });
        trigger.append(caller);
        list.append(trigger);
        root.append(list);
        scope.append(root);
        document.body.append(scope);
        await flush();

        // Observe the adapter-owned leaf; the Prototype never queries physical DOM.
        const leaf = trigger.querySelector<HTMLElement>('[data-pui-owned-decoration]');
        if (!leaf) throw new Error('Expected the committed owned decoration');
        const selected = trigger.getExposes().selected;
        const value = root.getExposes().value;
        trigger.focus();
        const assertUnderline = () => {
          const css = getComputedStyle(leaf);
          // A zero-width flex child still contributes gap. It must leave flow,
          // not merely have empty text. Native label width is checked separately.
          expect(
            css.position === 'absolute' || css.position === 'fixed' || css.display === 'none'
          ).toBe(true);
          expect(css.display === 'none' || css.opacity === '0').toBe(true);
          expect(trigger.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
          expect(caller.parentNode).toBe(trigger);
          expect(trigger.textContent).toBe('Account');
          expect(leaf.getAttribute('aria-hidden')).toBe('true');
          expect(leaf.hasAttribute('inert')).toBe(true);
          expect(trigger.getExposes().selected).toBe(selected);
          expect(root.getExposes().value).toBe(value);
          expect(selected.get()).toBe(true);
          expect(value.get()).toBe('a');
          expect(document.activeElement).toBe(trigger);
        };

        if (initialAppearance === 'underline') assertUnderline();
        setElementProps(trigger, { value: 'a', appearance: 'default' });
        await flush();
        const defaultPaint = leaf.getAttribute('data-pui-style');
        expect(getComputedStyle(leaf).position).toBe('absolute');
        expect(getComputedStyle(leaf).opacity).toBe('1');
        setElementProps(trigger, { value: 'a', appearance: 'underline' });
        await flush();
        assertUnderline();
        setElementProps(trigger, { value: 'a', appearance: 'default' });
        await flush();
        expect(leaf.getAttribute('data-pui-style')).toBe(defaultPaint);
        expect(getComputedStyle(leaf).opacity).toBe('1');
        expect(trigger.querySelector('[data-pui-owned-decoration]')).toBe(leaf);
        expect(caller.parentNode).toBe(trigger);
        expect(document.activeElement).toBe(trigger);
      });
});
