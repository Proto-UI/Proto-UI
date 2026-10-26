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

const PACKAGE = 'resolution-mode-hooks';

/**
 * A real producer implementation. The state name differs per implementation,
 * so the certified state identifies which implementation was read.
 */
function producer(name: string, state: string): string {
  return [
    "import { defineAsHook } from '@proto.ui/core';",
    `export const asMode = defineAsHook({ name: '${name}',`,
    `  setup(d) { d.state.bool('${state}', false); } });`,
  ].join('\n');
}

/**
 * The authored rule the coverage scan reads. The state handle it names is the
 * one the selected implementation declares, so only the implementation Node
 * selects for this importer can satisfy the read.
 */
function consumer(state: string): string {
  return [
    `import { asMode } from '${PACKAGE}';`,
    'const result = asMode();',
    `def.rule({ when: (w) => w.state(result.stateHandles.${state}).eq(true),`,
    "  intent: (i) => i.feedback.style.use(tw('bg-primary')) });",
  ].join('\n');
}

type PackageShape = {
  /** The consumer package scope, which decides how a `.ts` importer resolves. */
  scope?: 'module' | 'commonjs';
  /** The installed package's `exports` map. */
  exports?: unknown;
  /** Extra conditions the consumer's tsconfig configures. */
  customConditions?: string[];
  /** The extra files the installed package ships. */
  files?: Record<string, string>;
  /**
   * The legacy entry fields the installed package ships instead of an
   * `exports` map. Node reads `main`; a bundler reads `module`.
   */
  legacy?: { types?: string; module?: string; main?: string };
  /** The module resolution the consumer's tsconfig configures. */
  resolution?: 'NodeNext' | 'Bundler';
};

/**
 * A real installed package under `node_modules`, so the import resolves the
 * way an installed package does rather than through an authored relative
 * path. The package ships no TypeScript source, so the resolution itself has
 * to pick the implementation instead of reading an authored file.
 */
async function createInstalledPackage(
  shape: PackageShape = {}
): Promise<{ dir: string; root: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'hook-resolution-mode-'));
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ type: shape.scope ?? 'module' })
  );
  const resolution = shape.resolution ?? 'NodeNext';
  await writeFile(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: resolution === 'Bundler' ? 'ESNext' : 'NodeNext',
        moduleResolution: resolution,
        ...(shape.customConditions ? { customConditions: shape.customConditions } : {}),
      },
    })
  );
  const root = path.join(dir, 'node_modules', PACKAGE);
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: PACKAGE,
      ...(shape.legacy
        ? shape.legacy
        : {
            exports: shape.exports ?? { '.': { import: './import.js', require: './require.js' } },
          }),
    })
  );
  const files: Record<string, string> = {
    ...(shape.legacy
      ? {}
      : {
          'import.js': producer('alpha', 'alphaReady'),
          'require.js': producer('beta', 'betaReady'),
        }),
    ...(shape.files ?? {}),
  };
  for (const [file, text] of Object.entries(files)) {
    await writeFile(path.join(root, file), text);
  }
  return { dir, root: realpathSync.native(root) };
}

/**
 * The resolution Node itself performs for an ES module. It is the reference
 * the extractor has to agree with, so it is read from a real Node rather than
 * restated here.
 */
function nativeEsmResolution(dir: string, specifier: string, conditions: string[] = []): string {
  const resolved = execFileSync(
    process.execPath,
    [
      ...conditions.flatMap((condition) => ['--conditions', condition]),
      '--input-type=module',
      '--eval',
      `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    { cwd: dir, encoding: 'utf8' }
  ).trim();
  return realpathSync.native(fileURLToPath(resolved));
}

/**
 * The resolution Node itself performs for a CommonJS module.
 */
function nativeCjsResolution(dir: string, specifier: string): string {
  const resolved = execFileSync(
    process.execPath,
    ['--eval', `console.log(require.resolve(${JSON.stringify(specifier)}))`],
    { cwd: dir, encoding: 'utf8' }
  ).trim();
  return realpathSync.native(resolved);
}

describe('hook source resolution mode', () => {
  it('resolves the export an .mts importer loads', async () => {
    const { dir, root } = await createInstalledPackage();
    try {
      const native = nativeEsmResolution(dir, PACKAGE);
      expect(native).toBe(path.join(root, 'import.js'));

      const consumerFile = path.join(dir, 'consumer.proto.mts');
      const source = consumer('alphaReady');
      await writeFile(consumerFile, source);

      const resolved = createHookSourceModuleContext().resolveModule(consumerFile, PACKAGE);
      expect(resolved?.file).toBe(native);

      const scan = scanRuleStateReads(source, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asMode', state: 'alphaReady' },
      ]);
      // The certified implementation is the file Node resolved, so the
      // extractor cannot certify the other format's implementation.
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([native]);

      const tokens = await collectProtoStyleTokensFromFiles([consumerFile]);
      expect(tokens).toContain('data-[alpha-ready]:bg-primary');
      expect(tokens).not.toContain('data-[beta-ready]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves the export a .cts importer loads', async () => {
    const { dir, root } = await createInstalledPackage();
    try {
      const native = nativeCjsResolution(dir, PACKAGE);
      expect(native).toBe(path.join(root, 'require.js'));

      const consumerFile = path.join(dir, 'consumer.proto.cts');
      const source = consumer('betaReady');
      await writeFile(consumerFile, source);

      const resolved = createHookSourceModuleContext().resolveModule(consumerFile, PACKAGE);
      expect(resolved?.file).toBe(native);

      const scan = scanRuleStateReads(source, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asMode', state: 'betaReady' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([native]);

      const tokens = await collectProtoStyleTokensFromFiles([consumerFile]);
      expect(tokens).toContain('data-[beta-ready]:bg-primary');
      expect(tokens).not.toContain('data-[alpha-ready]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves the export a .ts importer loads in an ES module scope', async () => {
    const { dir, root } = await createInstalledPackage({ scope: 'module' });
    try {
      const native = nativeEsmResolution(dir, PACKAGE);
      expect(native).toBe(path.join(root, 'import.js'));

      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const source = consumer('alphaReady');
      await writeFile(consumerFile, source);

      const resolved = createHookSourceModuleContext().resolveModule(consumerFile, PACKAGE);
      expect(resolved?.file).toBe(native);

      const scan = scanRuleStateReads(source, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asMode', state: 'alphaReady' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([native]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves the export a .ts importer loads in a CommonJS scope', async () => {
    const { dir, root } = await createInstalledPackage({ scope: 'commonjs' });
    try {
      const native = nativeCjsResolution(dir, PACKAGE);
      expect(native).toBe(path.join(root, 'require.js'));

      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const source = consumer('betaReady');
      await writeFile(consumerFile, source);

      const resolved = createHookSourceModuleContext().resolveModule(consumerFile, PACKAGE);
      expect(resolved?.file).toBe(native);

      const scan = scanRuleStateReads(source, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asMode', state: 'betaReady' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([native]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps a configured custom condition ahead of the format exports', async () => {
    const { dir, root } = await createInstalledPackage({
      customConditions: ['custom'],
      exports: {
        '.': {
          custom: './custom.js',
          import: './import.js',
          require: './require.js',
        },
      },
      files: { 'custom.js': producer('gamma', 'gammaReady') },
    });
    try {
      const native = nativeEsmResolution(dir, PACKAGE, ['custom']);
      expect(native).toBe(path.join(root, 'custom.js'));

      const consumerFile = path.join(dir, 'consumer.proto.mts');
      const source = consumer('gammaReady');
      await writeFile(consumerFile, source);

      const resolved = createHookSourceModuleContext().resolveModule(consumerFile, PACKAGE);
      expect(resolved?.file).toBe(native);

      const scan = scanRuleStateReads(source, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asMode', state: 'gammaReady' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([native]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps a declaration export out of the runtime entry', async () => {
    const { dir, root } = await createInstalledPackage({
      exports: {
        '.': {
          types: './types.d.ts',
          import: './import.js',
          require: './require.js',
        },
      },
      files: { 'types.d.ts': 'export declare const asMode: unknown;\n' },
    });
    try {
      const native = nativeEsmResolution(dir, PACKAGE);
      expect(native).toBe(path.join(root, 'import.js'));

      const consumerFile = path.join(dir, 'consumer.proto.mts');
      const source = consumer('alphaReady');
      await writeFile(consumerFile, source);

      const resolved = createHookSourceModuleContext().resolveModule(consumerFile, PACKAGE);
      expect(resolved?.file).toBe(native);

      const scan = scanRuleStateReads(source, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asMode', state: 'alphaReady' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([native]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reads the main entry Node loads for a package without an exports map', async () => {
    const { dir, root } = await createInstalledPackage({
      legacy: { types: './types.d.ts', module: './module.mjs', main: './main.js' },
      files: {
        'types.d.ts': 'export declare const asMode: unknown;\n',
        'main.js': producer('main', 'mainReady'),
        'module.mjs': producer('module', 'moduleReady'),
      },
    });
    try {
      // A package without an `exports` map is entered through its `main`
      // field. The `module` field is a bundler convention Node never reads,
      // so the implementation Node loads is the one the extractor has to read.
      const native = nativeEsmResolution(dir, PACKAGE);
      expect(native).toBe(path.join(root, 'main.js'));

      const consumerFile = path.join(dir, 'consumer.proto.mts');
      const source = consumer('mainReady');
      await writeFile(consumerFile, source);

      const resolved = createHookSourceModuleContext().resolveModule(consumerFile, PACKAGE);
      expect(resolved?.file).toBe(native);

      const scan = scanRuleStateReads(source, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asMode', state: 'mainReady' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([native]);

      const tokens = await collectProtoStyleTokensFromFiles([consumerFile]);
      expect(tokens).toContain('data-[main-ready]:bg-primary');
      expect(tokens).not.toContain('data-[module-ready]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reads the module entry a bundler loads for a package without an exports map', async () => {
    const { dir, root } = await createInstalledPackage({
      resolution: 'Bundler',
      legacy: { types: './types.d.ts', module: './module.mjs', main: './main.js' },
      files: {
        'types.d.ts': 'export declare const asMode: unknown;\n',
        'main.js': producer('main', 'mainReady'),
        'module.mjs': producer('module', 'moduleReady'),
      },
    });
    try {
      // A bundler loads the `module` entry of a package without an `exports`
      // map, so the bundler entry stays ahead of `main` there.
      const bundlerEntry = path.join(root, 'module.mjs');

      const consumerFile = path.join(dir, 'consumer.proto.ts');
      const source = consumer('moduleReady');
      await writeFile(consumerFile, source);

      const resolved = createHookSourceModuleContext().resolveModule(consumerFile, PACKAGE);
      expect(resolved?.file).toBe(bundlerEntry);

      const scan = scanRuleStateReads(source, consumerFile, createHookSourceSummaryContext());
      expect(scan.unresolved).toEqual([]);
      expect(scan.usages.map(({ hook, state }) => ({ hook, state }))).toEqual([
        { hook: 'asMode', state: 'moduleReady' },
      ]);
      expect(scan.usages.map(({ provenance }) => provenance?.owner.file)).toEqual([bundlerEntry]);

      const tokens = await collectProtoStyleTokensFromFiles([consumerFile]);
      expect(tokens).toContain('data-[module-ready]:bg-primary');
      expect(tokens).not.toContain('data-[main-ready]:bg-primary');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
