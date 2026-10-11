// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderHostIndex } from '../src/services/codegen';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import { renderProtoStyleTokenCss } from '../src/services/proto-style-css';
import { COMPONENT_REGISTRY } from '../src/registry/components';

describe('draft Shadcn Card public consumption', () => {
  it('exports the exact family entry and all four facade generators', () => {
    const entry = COMPONENT_REGISTRY['shadcn-card'];
    expect(entry.importPath).toBe('@proto.ui/prototypes-shadcn/card');
    expect(entry.items.map((item) => item.prototypeImport)).toEqual([
      'shadcnCardRoot',
      'shadcnCardHeader',
      'shadcnCardContent',
      'shadcnCardFooter',
    ]);
    const manifest = JSON.parse(readFileSync('packages/prototypes/shadcn/package.json', 'utf8'));
    expect(manifest.exports['./card']).toEqual({
      types: './dist/card/index.d.ts',
      import: './dist/card/index.js',
      default: './dist/card/index.js',
    });
    for (const runtime of ['wc', 'react', 'vue', 'vue2']) {
      const code = renderHostIndex(runtime, ['shadcn-card']);
      expect(code).toContain("from '@proto.ui/prototypes-shadcn/card'");
      for (const item of entry.items) expect(code).toContain(item.prototypeImport);
    }
  });
  it('extracts every part recipe from source without unresolved CSS tokens', async () => {
    const tokens = (await collectProtoStyleTokens(
      path.resolve('packages/prototypes/shadcn/src/card')
    )) as string[];
    expect(tokens).toEqual(
      expect.arrayContaining([
        'bg-card',
        'text-card-foreground',
        'rounded-xl',
        'shadow-sm',
        'px-6',
        'grid-rows-[auto_auto]',
      ])
    );
    expect(renderProtoStyleTokenCss(tokens)).not.toContain('Unsupported Proto UI style tokens');
  });
  it('keeps the two new grid lowerings finite and rejects unknown or injected forms', () => {
    for (const token of [
      'grid-rows-[auto_1fr]',
      'auto-rows-max',
      'auto-rows-[1fr]',
      'grid-rows-[auto_auto];color:red',
    ]) {
      const css = renderProtoStyleTokenCss([token]);
      expect(css).toContain('Unsupported Proto UI style tokens');
      expect(css).not.toContain('grid-template-rows:');
      expect(css).not.toContain('grid-auto-rows:');
      expect(css).not.toContain('color: red;');
    }
  });
});
