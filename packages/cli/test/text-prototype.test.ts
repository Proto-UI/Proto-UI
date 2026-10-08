// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderHostIndex } from '../src/services/codegen';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';
import { COMPONENT_REGISTRY } from '../src/registry/components';

const required = {
  'text-inherit': 'color: inherit;',
  'text-xs': 'font-size: 0.75rem;',
  'text-sm': 'font-size: 0.875rem;',
  'text-base': 'font-size: 1rem;',
  'text-lg': 'font-size: 1.125rem;',
  'text-xl': 'font-size: 1.25rem;',
  'text-2xl': 'font-size: 1.5rem;',
  'text-3xl': 'font-size: 1.875rem;',
  'text-4xl': 'font-size: 2.25rem;',
  'text-5xl': 'font-size: 3rem;',
  'font-normal': 'font-weight: 400;',
  'font-medium': 'font-weight: 500;',
  'font-semibold': 'font-weight: 600;',
  'font-bold': 'font-weight: 700;',
  italic: 'font-style: italic;',
  'not-italic': 'font-style: normal;',
  underline: 'text-decoration-line: underline;',
  'no-underline': 'text-decoration-line: none;',
  'line-through': 'text-decoration-line: line-through;',
  'tracking-normal': 'letter-spacing: 0;',
  'tracking-tight': 'letter-spacing: -0.025em;',
  'leading-tight': 'line-height: 1.25;',
  'leading-snug': 'line-height: 1.375;',
  'leading-normal': 'line-height: 1.5;',
  'leading-relaxed': 'line-height: 1.625;',
};

describe('Text public compiler consumption', () => {
  // T-TEXT-0001-CASE-COMPILER
  it.each(['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])(
    'closes all %s Text tokens from actual source and emits owned Web CSS',
    async (family) => {
      const tokens = (await collectProtoStyleTokens(
        path.resolve(`packages/prototypes/${family}/src/text`)
      )) as string[];
      const css = renderProtoStyleTokenCss(tokens);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      const familyRequired = { ...required } as Record<string, string>;
      if (family === 'bootstrap-2-3-2') {
        delete familyRequired['text-2xl'];
        delete familyRequired['leading-normal'];
        familyRequired['text-[1.53125rem]'] = 'font-size: 1.53125rem;';
        familyRequired['leading-[1.4285714285714286]'] = 'line-height: 1.4285714285714286;';
        familyRequired['leading-[2.5rem]'] = 'line-height: 2.5rem;';
      }
      for (const [token, declaration] of Object.entries(familyRequired)) {
        expect(tokens).toContain(token);
        expect(css).toContain(`:where([data-pui-style~="${token}"]) {\n    ${declaration}`);
      }
      expect(tokens).toEqual(
        expect.arrayContaining([
          'font-sans',
          'font-heading',
          'font-mono',
          'text-foreground',
          'text-muted-foreground',
        ])
      );
      expect(css).toContain('var(--pui-font-heading');
      // Composite text-size line-height must yield to the explicit leading input.
      expect(
        css.indexOf(
          family === 'bootstrap-2-3-2'
            ? 'data-pui-style~="leading-[1.4285714285714286]"'
            : 'data-pui-style~="leading-normal"'
        )
      ).toBeGreaterThan(css.indexOf('data-pui-style~="text-5xl"'));
      expect(css).not.toMatch(/(?:^|\n)\s*(?:body|h1|h2|p|label|a)\s*\{/);
    }
  );

  // T-TEXT-0001-CASE-PUBLIC
  it.each(['base', 'shadcn', 'brutalist'])(
    'exports %s Text and generates all four public Adapter facades',
    (family) => {
      const entry = COMPONENT_REGISTRY[`${family}-text`];
      expect(entry.importPath).toBe(`@proto.ui/prototypes-${family}/text`);
      const manifest = JSON.parse(
        readFileSync(`packages/prototypes/${family}/package.json`, 'utf8')
      );
      expect(manifest.exports['./text']).toEqual({
        types: './dist/text/index.d.ts',
        import: './dist/text/index.js',
        default: './dist/text/index.js',
      });
      for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
        const code = renderHostIndex(runtime, [`${family}-text`]);
        expect(code).toContain(`from '@proto.ui/prototypes-${family}/text'`);
        expect(code).toContain(entry.items[0].prototypeImport);
        expect(code).toContain(
          runtime === 'wc' ? entry.items[0].wcExport : entry.items[0].reactExport
        );
      }
    }
  );

  it.each(['bootstrap-2-3-2', 'liquid-glass'])(
    'keeps %s Text source-only and generates complete four-Web facades only explicitly',
    (family) => {
      for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
        expect(() => renderHostIndex(runtime, [`${family}-text`])).toThrow(/workspace-source-only/);
        expect(renderHostIndex(runtime, [`${family}-text`], { sourceMode: 'workspace' })).toContain(
          `from '@proto.ui/prototypes-${family}/text'`
        );
      }
      const manifest = JSON.parse(
        readFileSync(`packages/prototypes/${family}/package.json`, 'utf8')
      );
      expect(manifest.private).toBe(true);
      expect(manifest.exports['./text']).toEqual({
        types: './src/text/index.ts',
        default: './src/text/index.ts',
      });
    }
  );

  // T-TEXT-0001-CASE-LIMITS
  it('reports unsupported targets and unknown style tokens instead of inventing parity', () => {
    expect(() => renderHostIndex('gpui', ['shadcn-text'])).toThrow('unsupported host "gpui"');
    const css = renderProtoStyleTokenCss(['text-5xl', 'unsupported-text-feature']);
    expect(css).toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('unsupported-text-feature');
    expect(css).toContain('font-size: 3rem;');
  });
});
