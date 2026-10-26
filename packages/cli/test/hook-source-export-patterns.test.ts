import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { scanRuleStateReads } from '../src/services/lowered-hook-coverage';
import { createHookSourceModuleContext } from '../src/services/hook-source-module';
import { createHookSourceSummaryContext } from '../src/services/hook-source-summary';
import { collectProtoStyleTokensFromFiles } from '../src/services/prototype-style-tokens';

/**
 * A real installed package. The `exports` map holds overlapping subpath
 * patterns, so Node has to rank them:
 *
 * - `./features/*` and `./*longsuffix` both match `./features/longsuffix`.
 *   The longer prefix before `*` wins, so Node selects `./features/*`.
 * - `./tie/*` and `./tie/*suffix` share a prefix, so the longer key wins.
 *
 * Each pattern carries its own declaration entry, so a runtime entry that
 * disagrees with the declaration entry shows up as a different implementation
 * rather than as a missing file.
 */
const EXPORTS = {
  './features/*': {
    types: './types/features/*.d.ts',
    default: './runtime/features/*.js',
  },
  './*longsuffix': {
    types: './types/beta.d.ts',
    default: './runtime/beta.js',
  },
  './tie/*': {
    types: './types/tie-short.d.ts',
    default: './runtime/tie-short.js',
  },
  './tie/*suffix': {
    types: './types/tie-long.d.ts',
    default: './runtime/tie-long.js',
  },
} as const;

/**
 * A real producer implementation. The state name differs per implementation,
 * so the certified state identifies which implementation was read.
 */
function producer(name: string, state: string): string {
  return [
    "import { defineAsHook } from '@proto.ui/core';",
    `export const asPattern = defineAsHook({ name: '${name}',`,
    `  setup(d) { d.state.bool('${state}', false); } });`,
  ].join('\n');
}

/**
 * A real installed package under `node_modules`, so the import resolves the
 * way an installed package does rather than through an authored relative path.
 * Each implementation declares a different state, so the certified state
 * identifies which implementation was read.
 */
async function createInstalledPackage(
  exportsMap: unknown = EXPORTS
): Promise<{ dir: string; root: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'hook-export-patterns-'));
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  await writeFile(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' } })
  );
  const root = path.join(dir, 'node_modules', 'pattern-hooks');
  await mkdir(path.join(root, 'types', 'features'), { recursive: true });
  await mkdir(path.join(root, 'runtime', 'features'), { recursive: true });
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'pattern-hooks', type: 'module', exports: exportsMap })
  );
  const files: Record<string, string> = {
    'types/features/longsuffix.d.ts': 'export declare const asPattern: unknown;\n',
    'types/beta.d.ts': 'export declare const asPattern: unknown;\n',
    'types/tie-short.d.ts': 'export declare const asPattern: unknown;\n',
    'types/tie-long.d.ts': 'export declare const asPattern: unknown;\n',
    'runtime/features/longsuffix.js': producer('alpha', 'alphaReady'),
    'runtime/beta.js': producer('beta', 'betaReady'),
    'runtime/tie-short.js': producer('tieShort', 'tieShortReady'),
    'runtime/tie-long.js': producer('tieLong', 'tieLongReady'),
  };
  for (const [file, text] of Object.entries(files)) {
    await writeFile(path.join(root, file), text);
  }
  return { dir, root: realpathSync.native(root) };
}

/**
 * The resolution Node itself performs. It is the reference the extractor has
 * to agree with, so it is read from a real Node rather than restated here.
 */
function nativeResolution(dir: string, specifier: string): string {
  const resolved = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    { cwd: dir, encoding: 'utf8' }
  ).trim();
  return realpathSync.native(fileURLToPath(resolved));
}

describe('hook source export patterns', () => {
  const alpha = {
    types: './types/features/longsuffix.d.ts',
    default: './runtime/features/longsuffix.js',
  };
  const beta = { types: './types/beta.d.ts', default: './runtime/beta.js' };
  const matchingCases = [
    { name: 'empty wildcard', subpath: 'empty/', exports: { './empty/*': alpha }, rejected: true },
    {
      name: 'overlapping prefix and suffix',
      subpath: 'xyz',
      exports: { './xy*yz': alpha, './*': beta },
    },
    {
      name: 'multiple asterisks',
      subpath: 'multi/x*',
      exports: { './multi/**': alpha, './multi/*': beta },
    },
    {
      name: 'null selected target',
      subpath: 'private/x',
      exports: { './private/*': null, './*': beta },
      rejected: true,
    },
    {
      name: 'inactive selected condition',
      subpath: 'gated/x',
      exports: { './gated/*': { browser: './runtime/features/longsuffix.js' }, './*': beta },
      rejected: true,
    },
  ];

  it.each(matchingCases)('agrees with native resolution for $name', async (control) => {
    const { dir, root } = await createInstalledPackage(control.exports);
    try {
      const specifier = `pattern-hooks/${control.subpath}`;
      const native = JSON.parse(
        execFileSync(
          process.execPath,
          [
            '--input-type=module',
            '--eval',
            `try { console.log(JSON.stringify({ file: import.meta.resolve(${JSON.stringify(specifier)}) })); } catch (error) { console.log(JSON.stringify({ code: error.code })); }`,
          ],
          { cwd: dir, encoding: 'utf8' }
        )
      );
      const consumerFile = path.join(dir, 'consumer.mts');
      await writeFile(consumerFile, `import { asPattern } from ${JSON.stringify(specifier)};\n`);
      const actual = createHookSourceModuleContext().resolveModule(consumerFile, specifier);
      if (control.rejected) {
        expect(native).toEqual({ code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
        expect(actual).toBeNull();
      } else {
        expect(fileURLToPath(native.file)).toBe(path.join(root, 'runtime', 'beta.js'));
        expect(actual?.file).toBe(fileURLToPath(native.file));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves the pattern Node selects when two export patterns overlap', async () => {
    const { dir, root } = await createInstalledPackage();
    try {
      const native = nativeResolution(dir, 'pattern-hooks/features/longsuffix');
      // Node ranks the longer prefix before `*` first, so the `./features/*`
      // entry wins over the longer `./*longsuffix` key.
      expect(native).toBe(path.join(root, 'runtime', 'features', 'longsuffix.js'));

      const consumer = [
        "import { asPattern } from 'pattern-hooks/features/longsuffix';",
        'const result = asPattern();',
        'def.rule({ when: (w) => w.state(result.stateHandles.alphaReady).eq(true),',
        "  intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
      ].join('\n');
      const consumerFile = path.join(dir, 'consumer.proto.mts');
      await writeFile(consumerFile, consumer);

      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asPattern', state: 'alphaReady' },
      ]);
      // The certified implementation is the file Node resolved, so the
      // extractor cannot certify the other pattern's implementation.
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([native]);

      const tokens = await collectProtoStyleTokensFromFiles([consumerFile]);
      expect(tokens).toContain('data-[alpha-ready]:bg-primary');
      expect(tokens).not.toContain('data-[beta-ready]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the longer key when two export patterns share a prefix', async () => {
    const { dir, root } = await createInstalledPackage();
    try {
      const native = nativeResolution(dir, 'pattern-hooks/tie/xsuffix');
      // Both `./tie/*` and `./tie/*suffix` match `./tie/xsuffix`. Their
      // prefixes are equally long, so the longer key wins.
      expect(native).toBe(path.join(root, 'runtime', 'tie-long.js'));

      const consumer = [
        "import { asPattern } from 'pattern-hooks/tie/xsuffix';",
        'const result = asPattern();',
        'def.rule({ when: (w) => w.state(result.stateHandles.tieLongReady).eq(true),',
        "  intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
      ].join('\n');
      const consumerFile = path.join(dir, 'consumer.proto.mts');
      await writeFile(consumerFile, consumer);

      const scan = scanRuleStateReads(consumer, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asPattern', state: 'tieLongReady' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([native]);

      const tokens = await collectProtoStyleTokensFromFiles([consumerFile]);
      expect(tokens).toContain('data-[tie-long-ready]:bg-primary');
      expect(tokens).not.toContain('data-[tie-short-ready]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
