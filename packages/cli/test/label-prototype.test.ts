// @vitest-environment node
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderHostIndex } from '../src/services/codegen';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';
import { listComponentChoices } from '../src/registry/components';

describe('Label compiler consumption boundaries', () => {
  it.each(['base', 'shadcn', 'brutalist'])(
    'generates all four installed-consumer %s Label facades',
    (family) => {
      for (const host of ['wc', 'react', 'vue', 'vue2'])
        expect(renderHostIndex(host, [`${family}-label`])).toContain(
          `from '@proto.ui/prototypes-${family}/label'`
        );
    }
  );
  it.each(['bootstrap-2-3-2', 'liquid-glass'])(
    'requires explicit workspace generation for private-source %s Label',
    (family) => {
      for (const host of ['wc', 'react', 'vue', 'vue2']) {
        expect(() => renderHostIndex(host, [`${family}-label`])).toThrow(/workspace-source-only/);
        expect(renderHostIndex(host, [`${family}-label`], { sourceMode: 'workspace' })).toContain(
          `from '@proto.ui/prototypes-${family}/label'`
        );
      }
      expect(listComponentChoices().some((item) => item.value === `${family}-label`)).toBe(false);
    }
  );
  it.each(['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])(
    'closes the actual %s Label style source without global suppression',
    async (family) => {
      const tokens = await collectProtoStyleTokens(
        path.resolve(`packages/prototypes/${family}/src/label`)
      );
      const stringTokens = tokens.filter((token): token is string => typeof token === 'string');
      expect(stringTokens).toHaveLength(tokens.length);
      const css = renderProtoStyleTokenCss(stringTokens);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('color: var(--pui-foreground)');
    }
  );
  it('diagnoses a host without facade lowering', () => {
    expect(() => renderHostIndex('gpui', ['base-label'])).toThrow('unsupported host');
  });
});
