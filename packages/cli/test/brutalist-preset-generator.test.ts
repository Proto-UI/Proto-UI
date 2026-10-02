// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
describe('Brutalist preset generator', () => {
  it('generates and checks both manifests under an escaped native path', () => {
    // Keep dependency resolution in the workspace, but never write its shipped
    // manifests or rely on their checkout newline form. No dependencies copied.
    const cache = path.join(root, 'node_modules/.cache');
    mkdirSync(cache, { recursive: true });
    const fixture = mkdtempSync(path.join(cache, 'brutalist-generator 空格 # %-'));
    try {
      for (const relative of [
        'package.json',
        'scripts/styles/generate-brutalist-style-tokens.ts',
        'packages/cli/src/services/prototype-style-tokens.ts',
        'packages/cli/src/generated/lowered-variant-order.ts',
        'packages/prototypes/brutalist/src',
      ]) {
        const target = path.join(fixture, relative);
        mkdirSync(path.dirname(target), { recursive: true });
        cpSync(path.join(root, relative), target, { recursive: true });
      }
      const run = (args: string[]) => {
        const result = spawnSync(
          process.execPath,
          [
            '--import',
            'tsx',
            path.join(fixture, 'scripts/styles/generate-brutalist-style-tokens.ts'),
            ...args,
          ],
          { cwd: root, encoding: 'utf8', timeout: 30_000 }
        );
        expect(result.error, result.stderr).toBeUndefined();
        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
        return result.stdout;
      };
      expect(run([])).toContain('Generated');
      const generated = ['brutalist-style-tokens.ts', 'brutalist-theme.ts'].map((name) =>
        path.join(fixture, 'packages/cli/src/generated', name)
      );
      const before = generated.map((file) => readFileSync(file, 'utf8'));
      expect(before[0]).toContain('BRUTALIST_STYLE_TOKENS');
      expect(before[1]).toContain('BRUTALIST_THEME_CSS');
      expect(run(['--check'])).toContain('Brutalist preset token and theme manifests are current');
      expect(generated.map((file) => readFileSync(file, 'utf8'))).toEqual(before);
    } finally {
      // mkdtemp returns the exact directory created here, not a broad root.
      if (path.dirname(path.resolve(fixture)) !== path.resolve(cache)) {
        throw new Error('Generator fixture cleanup escaped its cache directory.');
      }
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 70_000);
});
