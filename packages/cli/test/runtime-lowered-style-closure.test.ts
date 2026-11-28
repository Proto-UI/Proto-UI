// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { asButton } from '@proto.ui/prototypes-base/button';
import {
  collectExportedPrototypes,
  collectFamilyRuntimeStyleClosure,
} from '../../../scripts/styles/runtime-style-closure';
import * as shadcnPrototypes from '../../prototypes/shadcn/src/index';
import * as brutalistPrototypes from '../../prototypes/brutalist/src/index';
import * as bootstrapPrototypes from '../../prototypes/bootstrap-2-3-2/src/index';
import * as liquidGlassPrototypes from '../../prototypes/liquid-glass/src/index';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';
import { BRUTALIST_STYLE_TOKENS } from '../src/generated/brutalist-style-tokens';
import { DRAFT_FAMILY_STYLE_TOKENS } from '../src/generated/draft-family-style-tokens';
import {
  renderProtoShadowStyleTokenCss,
  renderProtoStyleTokenCss,
} from '../src/services/proto-style-css';

const FAMILIES: ReadonlyArray<{
  name: string;
  exports: Record<string, unknown>;
  presetTokens: readonly string[];
}> = [
  {
    name: 'shadcn',
    exports: shadcnPrototypes,
    presetTokens: SHADCN_STYLE_TOKENS,
  },
  {
    name: 'brutalist',
    exports: brutalistPrototypes,
    presetTokens: BRUTALIST_STYLE_TOKENS,
  },
  {
    name: 'bootstrap-2-3-2',
    exports: bootstrapPrototypes,
    presetTokens: DRAFT_FAMILY_STYLE_TOKENS['bootstrap-2-3-2'],
  },
  {
    name: 'liquid-glass',
    exports: liquidGlassPrototypes,
    presetTokens: DRAFT_FAMILY_STYLE_TOKENS['liquid-glass'],
  },
];

describe('runtime lowered rule & style token closure across all shipped prototypes', () => {
  for (const family of FAMILIES) {
    it(`${family.name}: every live prototype setup, exposed attribute, and lowered rule token is covered by generated CLI CSS`, async () => {
      const prototypes = collectExportedPrototypes(family.exports);
      expect(prototypes.length).toBeGreaterThan(0);

      const presetSet = new Set(family.presetTokens);
      const result = await collectFamilyRuntimeStyleClosure(prototypes);

      expect(result.unmounted, 'prototypes that failed headless runtime setup').toEqual([]);
      expect(result.mountedCount).toBe(prototypes.length);
      expect(result.invalidAttrs, 'exposed states with unselectable data-* attributes').toEqual([]);

      const missingTokens: string[] = [];
      for (const [protoName, tokens] of result.tokensByPrototype.entries()) {
        for (const token of tokens) {
          if (!presetSet.has(token)) {
            missingTokens.push(`${protoName}: ${token}`);
          }
        }
      }

      expect(
        missingTokens,
        'runtime-lowered or RuleIR style tokens missing from generated family style table'
      ).toEqual([]);

      if (family.name === 'brutalist') {
        // Preserve direct reachability coverage for two-step inherited state
        // handles (`asCheckboxGroupItem().stateHandles.focusVisible`).
        const checkboxItemTokens = result.tokensByPrototype.get('brutalist-checkbox-group-item');
        expect(checkboxItemTokens?.some((token) => token.startsWith('data-[focus-visible]:'))).toBe(
          true
        );
      }

      expect(result.tokens.length).toBeGreaterThan(0);
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render(result.tokens);
        expect(css).not.toContain('Unsupported Proto UI style tokens');
      }
    }, 60_000);
  }

  it('catches unextracted lowered rule tokens even through dynamic TS composition patterns', async () => {
    const SHARED_OPTIONS = ['default', 'compact'] as const;
    const registerVisual = (
      def: Parameters<Parameters<typeof definePrototype>[0]['setup']>[0],
      focusState: ReturnType<typeof asButton>['stateHandles'] extends infer H
        ? H extends { focusVisible: infer S }
          ? S
          : never
        : never,
      useConditional: boolean
    ) => {
      def.rule({
        when: (w) =>
          useConditional
            ? w.state(focusState as any).eq(true)
            : w.all(w.state(focusState as any).eq(true)),
        intent: (i) => i.feedback.style.use(tw('bg-[#123456]')),
      });
    };

    const syntheticButton = definePrototype({
      name: 'synthetic-runtime-closure-probe',
      modules: asButton.modules,
      setup(def) {
        // Patterns that historically triggered static AST prover false-positives:
        // props.define before asButton, shared option array, helper closure, ternary when.
        def.props.define({
          density: { type: 'string', default: SHARED_OPTIONS[0], empty: 'fallback' },
        });
        const inherited = asButton();
        registerVisual(def, inherited.stateHandles!.focusVisible, true);
      },
    });

    const result = await collectFamilyRuntimeStyleClosure([syntheticButton]);
    expect(result.unmounted).toEqual([]);
    expect(result.invalidAttrs).toEqual([]);
    expect(result.tokens).toContain('data-[focus-visible]:bg-[#123456]');

    const presetWithoutProbe = new Set(SHADCN_STYLE_TOKENS);
    const missing = result.tokens.filter((token) => !presetWithoutProbe.has(token));
    expect(missing).toContain('data-[focus-visible]:bg-[#123456]');
  });
});
