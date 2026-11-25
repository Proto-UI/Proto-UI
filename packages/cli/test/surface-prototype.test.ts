// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderHostIndex } from '../src/services/codegen';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';
import { COMPONENT_REGISTRY, listComponentChoices } from '../src/registry/components';

describe('Surface public compiler consumption', () => {
  it.each(['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])(
    'closes actual %s Surface tokens through the Web compiler',
    async (family) => {
      const tokens = (await collectProtoStyleTokens(
        path.resolve(`packages/prototypes/${family}/src/surface`)
      )) as string[];
      const css = renderProtoStyleTokenCss(tokens);
      expect(tokens.length).toBeGreaterThan(15);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      expect(css).toContain('border');
      expect(css).toContain('transition-duration: var(--pui-surface-transition-duration, 0ms)');
      expect(css).toContain('@starting-style');
      expect(css).toContain('@media (forced-colors: active)');
      expect(css).toContain('outline-color: Highlight;');
      expect(css.indexOf('@starting-style')).toBeGreaterThan(css.indexOf('opacity: 1;'));
      expect(css.indexOf('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(
        css.indexOf('transition-duration: var(--pui-surface-transition-duration, 0ms)')
      );
      expect(css.indexOf('@media (forced-colors: active)')).toBeGreaterThan(
        css.indexOf('outline: 2px solid transparent;')
      );
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
      expect(css).toContain('opacity: 0;');
      expect(css).toContain('opacity: 1;');
      expect(css).toContain('border-radius');
      expect(css).not.toMatch(/(?:^|\n)\s*(?:body|h1|p|a)\s*\{/);
    }
  );
  // T-TEXT-0001-CASE-PUBLIC
  it.each(['base', 'shadcn', 'brutalist'])(
    'exports %s Surface and generates all four public Adapter facades',
    (family) => {
      const entry = COMPONENT_REGISTRY[`${family}-surface`];
      expect(entry.importPath).toBe(`@proto.ui/prototypes-${family}/surface`);
      const manifest = JSON.parse(
        readFileSync(`packages/prototypes/${family}/package.json`, 'utf8')
      );
      expect(manifest.exports['./surface']).toEqual({
        ...(family === 'base' ? { proto: './src/surface/index.ts' } : {}),
        types: './dist/surface/index.d.ts',
        import: './dist/surface/index.js',
        default: './dist/surface/index.js',
      });
      for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
        const code = renderHostIndex(runtime, [`${family}-surface`]);
        expect(code).toContain(`from '@proto.ui/prototypes-${family}/surface'`);
        expect(code).toContain(entry.items[0].prototypeImport);
        expect(code).toContain(
          runtime === 'wc' ? entry.items[0].wcExport : entry.items[0].reactExport
        );
      }
    }
  );

  it.each(['bootstrap-2-3-2', 'liquid-glass'])(
    'keeps %s Surface source exports available only inside the workspace',
    (family) => {
      const manifest = JSON.parse(
        readFileSync(`packages/prototypes/${family}/package.json`, 'utf8')
      );
      expect(manifest.private).toBe(true);
      expect(manifest.protoUi.release.scan).toBe(false);
      expect(manifest.exports['./surface']).toEqual({
        types: './src/surface/index.ts',
        default: './src/surface/index.ts',
      });
      expect(COMPONENT_REGISTRY).not.toHaveProperty(`${family}-surface`);
      expect(listComponentChoices().map((choice) => choice.value)).not.toContain(
        `${family}-surface`
      );
    }
  );

  it('offers only publishable packages through the public component registry', () => {
    for (const entry of Object.values(COMPONENT_REGISTRY)) {
      const family = entry.packageName.replace('@proto.ui/prototypes-', '');
      const manifest = JSON.parse(
        readFileSync(`packages/prototypes/${family}/package.json`, 'utf8')
      );
      expect(manifest.private, entry.id).not.toBe(true);
      expect(manifest.protoUi?.release?.scan, entry.id).not.toBe(false);
    }
  });

  // T-TEXT-0001-CASE-LIMITS
  it('reports unsupported targets and unknown style tokens instead of inventing parity', () => {
    expect(() => renderHostIndex('gpui', ['shadcn-surface'])).toThrow('unsupported host "gpui"');
    const css = renderProtoStyleTokenCss(['border-0', 'unsupported-surface-feature']);
    expect(css).toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('unsupported-surface-feature');
    expect(css).toContain('border-width: 0px;');
  });
});
