// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../src/index';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';
import { BRUTALIST_STYLE_TOKENS } from '../src/generated/brutalist-style-tokens';

const required = [
  ['w-[var(--proto-ui-available-width)]', 'width: var(--proto-ui-available-width);'],
  ['h-[var(--proto-ui-available-height)]', 'height: var(--proto-ui-available-height);'],
  ['overscroll-contain', 'overscroll-behavior: contain;'],
] as const;

function missingRules(css: string, mode: 'document' | 'shadow'): string[] {
  const blocks = css.split('}');
  return required
    .filter(([token, declaration]) => {
      // The real preset companion uses split Root delivery, not a document
      // selector transplanted into a ShadowRoot. Geometry belongs to the host;
      // overscroll belongs to its scroll surface.
      const root = `:host([data-pui-split-root-style~="${token}"])`;
      const selector =
        mode === 'document'
          ? `:where([data-pui-style~="${token}"])`
          : token === 'overscroll-contain'
            ? `${root} > [data-pui-split-surface][data-pui-style~="${token}"]`
            : root;
      return !blocks.some((block) => {
        const separator = block.lastIndexOf('{');
        return (
          block.slice(0, separator).trim().endsWith(selector) &&
          block.slice(separator + 1).includes(declaration)
        );
      });
    })
    .map(([token]) => token);
}

async function presetOutput(family: string, mode: 'document' | 'shadow'): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'pui-navigation-preset-'));
  try {
    const shadow = path.join(directory, 'shadow.js');
    await run([
      family,
      '--styles-dir',
      directory,
      ...(mode === 'shadow' ? ['--shadow-out', shadow] : []),
    ]);
    const documentCss = await readFile(
      path.join(directory, 'proto-ui-tokens.generated.css'),
      'utf8'
    );
    expect(documentCss).not.toContain('Unsupported Proto UI style tokens');
    if (mode === 'document') return documentCss;
    const module = await readFile(shadow, 'utf8');
    const literal = module.match(/const artifact = Object\.freeze\((.+)\);/)?.[1];
    expect(literal).toBeDefined();
    // Inspect the serialized artifact as data; never import generated JavaScript.
    const artifact = JSON.parse(literal!);
    expect(artifact.kind).toBe('proto-ui.shadow-style');
    expect(artifact.version).toBe(1);
    expect(artifact.environment).toBe('host-color-scheme-v1');
    expect(typeof artifact.cssText).toBe('string');
    expect(artifact.cssText).not.toContain('Unsupported Proto UI style tokens');
    return artifact.cssText as string;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe.sequential('canonical navigation preset delivery (not native geometry)', () => {
  for (const [family, manifest] of [
    ['shadcn', SHADCN_STYLE_TOKENS],
    ['brutalist', BRUTALIST_STYLE_TOKENS],
  ] as const) {
    it.each(['document', 'shadow'] as const)(
      family + ' actual %s preset command emits all navigation rules',
      async (mode) => {
        for (const [token] of required) expect(manifest).toContain(token);
        expect(missingRules(await presetOutput(family, mode), mode)).toEqual([]);
      }
    );
    it.each(required.map(([token]) => token))(
      family + ' detects removing canonical navigation token %s',
      async (token) => {
        const before = [...manifest];
        const index = manifest.indexOf(token);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(manifest.filter((entry) => entry === token)).toHaveLength(1);
        // The actual CLI imports this same canonical array. Restore it in
        // finally; never mutate a generated source file or expected assertions.
        manifest.splice(index, 1);
        try {
          for (const mode of ['document', 'shadow'] as const) {
            expect(missingRules(await presetOutput(family, mode), mode)).toEqual([token]);
          }
        } finally {
          manifest.splice(index, 0, token);
          expect(manifest).toEqual(before);
        }
      }
    );
  }
});
