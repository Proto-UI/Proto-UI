import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { asInputRoot } from '@proto.ui/prototypes-base/input';
import { asTextareaRoot } from '@proto.ui/prototypes-base/textarea';
import { AdaptToWebComponent, setElementProps } from '../../adapters/web-component/src';
import { collectProtoShadowStyleTokenUsage } from '../src/services/prototype-style-tokens';
import { renderProtoShadowSplitStyleArtifact } from '../src/services/proto-style-css';

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
    expect(usage.rootTokens).toContain('data-[disabled]:opacity-50');
    expect(usage.rootTokens).not.toContain('disabled:opacity-50');
    const css = renderProtoShadowSplitStyleArtifact(usage.tokens, usage).cssText;
    expect(css).toContain(
      ':host([data-pui-split-root-style~="data-[disabled]:opacity-50"][data-disabled]) > [data-pui-split-surface][data-pui-style~="data-[disabled]:opacity-50"]'
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
    // invocation observes the same public adapter's fail-fast boundary.
    expect(() => (host as unknown as { connectedCallback(): void }).connectedCallback()).toThrow(
      /invalid tw token.*forbidden character.*disabled:opacity-50/
    );
    expect(host.hasAttribute('data-pui-split-root-style')).toBe(false);
    expect(host.shadowRoot!.childNodes).toHaveLength(0);
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
