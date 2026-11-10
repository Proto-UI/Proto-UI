import { afterEach, describe, expect, it } from 'vitest';
import type { ParserOptions } from 'prettier';
import { parsers } from 'prettier/plugins/postcss';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputRoot } from '@proto.ui/prototypes-base/input';
import { asTextareaRoot } from '@proto.ui/prototypes-base/textarea';
import { AdaptToWebComponent, setElementProps } from '../../adapters/web-component/src';
import {
  collectProtoShadowStyleTokenUsage,
  collectProtoStyleTokens,
} from '../src/services/prototype-style-tokens';
import {
  renderProtoShadowSplitStyleArtifact,
  renderProtoStyleTokenCss,
} from '../src/services/proto-style-css';
import { toggle as bootstrapToggle } from '../../prototypes/bootstrap-2-3-2/src/toggle';

let serial = 0;
const name = () => `cli-disabled-${++serial}`;
const flush = async () => {
  await Promise.resolve();
  await (
    window as unknown as { happyDOM: { waitUntilComplete(): Promise<void> } }
  ).happyDOM.waitUntilComplete();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

// C-HOST-SURFACE-PROJECTION-0001 G; D-WEB-COMPONENT-SHADOW-PROFILE-0001 J/L.
// Disabled is attribute-lowered by the public Web Rule policy. A native
// disabled: token created directly through the internal lowering seam does
// not establish an admitted public Root authoring path.
describe('public split disabled token boundary', () => {
  it('collects official Textarea disabled rules only in the attribute form', async () => {
    const usage = (await collectProtoShadowStyleTokenUsage(
      'packages/prototypes/shadcn/src/textarea'
    )) as { tokens: string[]; rootTokens: string[]; templateTokens: string[] };
    // The helper parameter carries the real disabled State, so the collector
    // must cover the attribute variant emitted by the public Web optimizer.
    expect(usage.rootTokens).toContain('opacity-50');
    expect(usage.rootTokens).toContain('cursor-not-allowed');
    expect(usage.rootTokens).toContain('data-[disabled]:opacity-50');
    expect(usage.rootTokens).toContain('data-[disabled]:cursor-not-allowed');
    expect(usage.rootTokens).not.toContain('disabled:opacity-50');
    const css = renderProtoShadowSplitStyleArtifact(usage.tokens, usage).cssText;
    expect(css).toContain(
      ':host([data-pui-split-root-style~="opacity-50"]) > [data-pui-split-surface][data-pui-style~="opacity-50"]'
    );
    expect(css).toContain(
      ':host([data-pui-split-root-style~="data-[disabled]:opacity-50"][data-disabled])'
    );
  });

  it('rejects an authored native disabled variant before applying Root styles', () => {
    const proto = definePrototype({
      name: name(),
      setup(def) {
        def.feedback.style.use(tw('disabled:opacity-50'));
        return () => null;
      },
    });
    const C = AdaptToWebComponent(proto, {
      shadow: {
        mode: 'open',
        presentation: 'split',
        styleArtifact: renderProtoShadowSplitStyleArtifact(['disabled:opacity-50']),
      },
    });
    const host = new C();
    // DOM custom-element reactions report callback errors globally; direct
    // invocation on a detached host is a guarded no-op, so connect it for real
    // and observe the same public adapter's fail-fast boundary.
    expect(() => document.body.append(host)).toThrow(
      /invalid tw token.*forbidden character.*disabled:opacity-50/
    );
    expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
  });

  it.each(['input', 'textarea'] as const)(
    'keeps %s native disabled and condition-matched Root paint/sizing in sync',
    async (tag) => {
      const hook = tag === 'input' ? asInputRoot : asTextareaRoot;
      const proto = definePrototype({
        name: name(),
        modules: hook.modules,
        setup(def) {
          const state = hook().stateHandles!;
          def.rule({
            when: (w) => w.state(state.disabled).eq(true),
            intent: (i) => i.feedback.style.use(tw('opacity-50 p-4')),
          });
          return () => null;
        },
      });
      const tokens = ['data-[disabled]:opacity-50', 'data-[disabled]:p-4'];
      const artifact = renderProtoShadowSplitStyleArtifact(tokens, {
        rootTokens: tokens,
        templateTokens: [],
      });
      const selector = ':host([data-pui-split-root-style~="data-[disabled]:p-4"][data-disabled])';
      expect(artifact.cssText).toContain(`${selector} {\n    padding: 1rem;`);
      expect(artifact.cssText).toContain(
        `${selector}:host([data-pui-split-text-control]) {\n    padding: 0;`
      );
      expect(artifact.cssText).toContain(
        `${selector} > [data-pui-split-surface][data-pui-style~="data-[disabled]:p-4"]`
      );
      const C = AdaptToWebComponent(proto, {
        shadow: { mode: 'open', presentation: 'split', styleArtifact: artifact },
      });
      const host = new C();
      document.body.append(host);
      await flush();
      const editor = host.shadowRoot!.querySelector(tag)!;
      for (const disabled of [false, true, false]) {
        setElementProps(host, { disabled });
        host.update();
        await flush();
        expect(editor.disabled).toBe(disabled);
        expect(host.hasAttribute('data-disabled')).toBe(disabled);
        expect(host.getAttribute('data-pui-split-root-style')?.split(' ')).toEqual(tokens);
        expect(editor.getAttribute('data-pui-style')?.split(' ')).toEqual(tokens);
        expect(host.shadowRoot!.querySelector(tag)).toBe(editor);
      }
    }
  );
});

describe('helper-carried Rule stylesheet equivalence', () => {
  it('provides distinct active background and shadow rules for the actual Toggle lowering', async () => {
    const tokens = (await collectProtoStyleTokens(
      'packages/prototypes/bootstrap-2-3-2/src/toggle'
    )) as string[];
    const C = AdaptToWebComponent(bootstrapToggle, { registerAs: name() });
    const host = new C();
    setElementProps(host, { active: false });
    document.body.append(host);
    await flush();

    const runtimeTokens = host.getAttribute('data-pui-style')!.split(' ');
    const shadowToken = runtimeTokens.find((token) => token.startsWith('data-[active]:shadow-'));
    const backgroundToken = runtimeTokens.find((token) => token.startsWith('data-[active]:bg-'));
    const restShadowToken = runtimeTokens.find((token) => token.startsWith('shadow-'));
    expect(shadowToken).toBeDefined();
    expect(backgroundToken).toBeDefined();
    expect(restShadowToken).toBeDefined();
    expect(tokens).toContain(shadowToken);
    expect(tokens).toContain(backgroundToken);

    const css = renderProtoStyleTokenCss(tokens);
    const parser = parsers.css;
    type SelectorNode = {
      type: string;
      nodes?: SelectorNode[];
      value?: string;
      attribute?: string;
      operator?: string;
      namespace?: string | true;
      insensitive?: boolean;
      raws?: { unquoted?: string };
    };
    type CssNode = { type: string; name?: string; selector?: SelectorNode; nodes?: CssNode[] };
    const stylesheet: CssNode = await parser.parse(css, {
      parser: 'css',
      originalText: css,
      locStart: parser.locStart,
      locEnd: parser.locEnd,
    } as ParserOptions);
    expect(stylesheet.type).toBe('css-root');
    const rules: { selector: SelectorNode; style: CSSStyleDeclaration }[] = [];
    const visit = (node: CssNode) => {
      if (node.type === 'css-rule') {
        expect(node.selector).toBeDefined();
        const style = document.createElement('div').style;
        style.cssText = (node.nodes ?? [])
          .filter((child) => child.type === 'css-decl')
          .map((child) => css.slice(parser.locStart(child), parser.locEnd(child)))
          .join(';');
        rules.push({ selector: node.selector!, style });
      } else if (node.type === 'css-root' || (node.type === 'css-atrule' && node.name === 'layer')) {
        for (const child of node.nodes ?? []) visit(child);
      }
    };
    visit(stylesheet);

    // Happy DOM 15 discards @layer and treats ~= values as regular expressions.
    // Match parsed compound attribute selectors against raw DOM attributes;
    // the CSS parser, rather than string serialization, owns escapes/nesting.
    // Its lossless attribute.value includes source quotes; raws.unquoted is
    // the operand observed in the parser's projection of this generated CSS.
    // Reject unsupported selector shapes instead of ignoring their conditions.
    const matches = (selector: SelectorNode, element: Element): boolean => {
      const children = selector.nodes ?? [];
      switch (selector.type) {
        case 'selector-root':
          return children.some((child) => matches(child, element));
        case 'selector-selector':
          return children.every((child) => matches(child, element));
        case 'selector-pseudo':
          if (selector.value === ':where' || selector.value === ':is')
            return children.some((child) => matches(child, element));
          if (selector.value === ':not')
            return !children.some((child) => matches(child, element));
          break;
        case 'selector-attribute': {
          if (!selector.attribute || selector.namespace || selector.insensitive)
            throw new Error('Unsupported namespace or case flag in attribute-state regression');
          const value = element.getAttribute(selector.attribute!);
          if (!selector.operator) return value !== null;
          if (selector.operator === '=') return value === selector.raws?.unquoted;
          if (selector.operator === '~=')
            return value !== null && value.split(/[\t\n\f\r ]+/).includes(selector.raws?.unquoted!);
          break;
        }
      }
      throw new Error(`Unsupported selector in attribute-state regression: ${selector.type}`);
    };
    const containsToken = (selector: SelectorNode, token: string): boolean =>
      (selector.type === 'selector-attribute' &&
        selector.attribute === 'data-pui-style' &&
        selector.operator === '~=' &&
        selector.raws?.unquoted === token) ||
      (selector.nodes ?? []).some((child) => containsToken(child, token));

    const forToken = (token: string, property: string, active: boolean) => {
      const probe = document.createElement('div');
      const empty = document.createElement('div');
      probe.setAttribute('data-pui-style', token);
      empty.setAttribute('data-pui-style', '');
      probe.toggleAttribute('data-active', active);
      empty.toggleAttribute('data-active', active);
      const matching = rules.filter(
        (rule) =>
          containsToken(rule.selector, token) &&
          rule.style.getPropertyValue(property) !== '' &&
          matches(rule.selector, probe) &&
          !matches(rule.selector, empty)
      );
      expect(matching.length, `${token} must select its own ${property} declaration`).toBeGreaterThan(0);
      return matching.at(-1)!;
    };
    const shadow = forToken(shadowToken!, '--pui-shadow', true);
    const background = forToken(backgroundToken!, 'background-color', true);
    const resting = forToken(restShadowToken!, '--pui-shadow', false);
    expect(shadow.style.getPropertyValue('--pui-shadow')).not.toBe(
      resting.style.getPropertyValue('--pui-shadow')
    );
    // The actual host must match both independent declarations only while
    // active. Native cascade and paint remain the eight Bootstrap journeys.
    for (const active of [false, true, false]) {
      setElementProps(host, { active });
      host.update();
      await flush();
      expect(host.hasAttribute('data-active')).toBe(active);
      expect(matches(shadow.selector, host)).toBe(active);
      expect(matches(background.selector, host)).toBe(active);
    }
  });
});
