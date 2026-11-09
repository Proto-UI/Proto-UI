import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { collectFamilyStyleClosure } from '../../../scripts/styles/family-style-closure';
import { collectProtoStyleTokens } from '../src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../src/services/proto-style-css';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';
import { BRUTALIST_STYLE_TOKENS } from '../src/generated/brutalist-style-tokens';
import { DRAFT_FAMILY_STYLE_TOKENS } from '../src/generated/draft-family-style-tokens';

describe('Bootstrap invalid-control entry closure', () => {
  for (const entry of ['field', 'number-field', 'input-otp']) {
    it(`${entry} delivers the actual invalid ink selector without a full-family fallback`, async () => {
      // These are the supported grouped Prototype entries used by CLI generation.
      // This does not certify single-file extraction of optional Field bindings.
      const tokens = await collectProtoStyleTokens(
        path.resolve('packages/prototypes/bootstrap-2-3-2/src', entry)
      );
      for (const token of ['data-[invalid]:text-[#953b39]', 'data-[invalid]:border-[#953b39]']) {
        expect(tokens).toContain(token);
        expect(DRAFT_FAMILY_STYLE_TOKENS['bootstrap-2-3-2']).toContain(token);
      }
      for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
        const css = render(tokens);
        expect(css).toContain('[data-pui-style~="data-[invalid]:text-[#953b39]"]');
        expect(css).toContain('color: #953b39;');
        expect(css).not.toContain('Unsupported Proto UI style tokens');
      }
    }, 30_000);
  }
});

it('follows static Base value dependencies while excluding unrelated and type-only families', async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'pui-family-closure-'));
  const family = path.join(root, 'family');
  const base = path.join(root, 'base');
  try {
    for (const dir of [family, path.join(base, 'used'), path.join(base, 'unused')])
      await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(family, 'index.ts'),
      "import { asUsed } from '@proto.ui/prototypes-base/used';\nimport type { Unused } from '@proto.ui/prototypes-base';\ntw('p-2'); asUsed();\n"
    );
    await fs.writeFile(path.join(base, 'used/index.ts'), "export { asUsed } from './root.js';\n");
    await fs.writeFile(
      path.join(base, 'used/root.ts'),
      "import '../shared'; export function asUsed() { tw('content-start'); }\n"
    );
    await fs.writeFile(path.join(base, 'shared.ts'), "tw('overflow-auto');\n");
    await fs.writeFile(path.join(base, 'unused/index.ts'), "tw('z-50');\n");
    const closure = await collectFamilyStyleClosure(family, base);
    expect(closure.tokens).toEqual(['content-start', 'overflow-auto', 'p-2']);
    expect(closure.baseFiles.some((file) => file.includes('/unused/'))).toBe(false);
    // Removing the actual value dependency must remove Base structural tokens.
    await fs.writeFile(
      path.join(family, 'index.ts'),
      "import type { Unused } from '@proto.ui/prototypes-base'; tw('p-2');\n"
    );
    expect((await collectFamilyStyleClosure(family, base)).tokens).toEqual(['p-2']);
    await fs.writeFile(
      path.join(family, 'index.ts'),
      "import { anyBase } from '@proto.ui/prototypes-base'; anyBase();\n"
    );
    await expect(collectFamilyStyleClosure(family, base)).rejects.toThrow(
      'Unbounded Base root value import'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe('real family preset inherited physical closure', () => {
  for (const [family, preset] of Object.entries({
    shadcn: SHADCN_STYLE_TOKENS,
    brutalist: BRUTALIST_STYLE_TOKENS,
    ...DRAFT_FAMILY_STYLE_TOKENS,
  })) {
    it(`${family} includes the actual inherited Drawer scrollport CSS`, async () => {
      const baseRoot = path.resolve('packages/prototypes/base/src');
      const direct = (await collectProtoStyleTokens(path.join(baseRoot, 'drawer'))) as string[];
      const required = direct.filter(
        (token) => token.includes('pui-drag-progress') || token === 'content-start'
      );
      const closure = await collectFamilyStyleClosure(
        path.resolve('packages/prototypes', family, 'src'),
        baseRoot
      );
      expect(closure.baseFiles).toContain(path.join(baseRoot, 'drawer/content.proto.ts'));
      expect([...preset]).toEqual(closure.tokens);
      const missing = (tokens: readonly string[]) =>
        required.filter((token) => !tokens.includes(token));
      expect(missing(preset)).toEqual([]);
      expect(missing(preset.filter((token) => token !== required[0]))).toEqual([required[0]]);
      for (const css of [
        renderProtoStyleTokenCss([...preset]),
        renderProtoShadowStyleTokenCss([...preset]),
      ]) {
        expect(css).not.toContain('Unsupported Proto UI style tokens');
        expect(css).toContain('align-content: flex-start;');
      }
      // The full family+Base closure scan is far past the 5s default now that
      // multi-profile recipes are projected.
    }, 120_000);
  }
});
