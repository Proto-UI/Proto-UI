// @vitest-environment node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compileRustDataFile,
  compileRustDataPrototype,
  diffRustDataCompilation,
  rustDataCompilationArtifacts,
  writeRustDataCompilation,
  type RustDataCompilation,
} from '../src/rust-data';

const directories: string[] = [];
const cargo = process.env.PROTO_UI_RUST_DATA_CARGO ?? process.env.CARGO ?? 'cargo';
const hasCargo = spawnSync(cargo, ['--version'], { encoding: 'utf8' }).status === 0;
const nativeTest = hasCargo || process.env.PROTO_UI_REQUIRE_RUST_DATA_TESTS === '1' ? it : it.skip;
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});
async function temporary(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'proto-rust-data-'));
  directories.push(directory);
  return directory;
}
const options = { methods: ['offset'], crateName: 'headless-decisions' };
const helper = (amount: number) =>
  `export function shift(value: number): number { return value + ${amount}; }`;
const source = (specifier: string) => `import { definePrototype } from '@proto.ui/core';
import { shift as compute } from ${JSON.stringify(specifier)};
export default definePrototype({name:'data-source',setup(def){def.expose.method('offset',compute);return r=>r.slot();}});`;
function compiled(result: Awaited<ReturnType<typeof compileRustDataFile>>): RustDataCompilation {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
function receipt(compilation: RustDataCompilation) {
  const artifact = rustDataCompilationArtifacts(compilation).find(
    ({ path }) => path === 'provenance.json'
  );
  return JSON.parse(artifact!.contents);
}

describe('private Rust data source and artifact boundary', () => {
  it('tracks imported and re-exported helpers rather than hashing only the entry', async () => {
    const root = await temporary();
    await writeFile(path.join(root, 'entry.proto.ts'), source('./bridge'));
    await writeFile(path.join(root, 'bridge.ts'), `export { shift } from './helper';`);
    await writeFile(path.join(root, 'helper.ts'), helper(2));
    const first = compiled(await compileRustDataFile('entry.proto.ts', { ...options, root }));
    const firstReceipt = receipt(first);
    expect(firstReceipt.sourceFiles.map(({ file }: { file: string }) => file).sort()).toEqual([
      'bridge.ts',
      'entry.proto.ts',
      'helper.ts',
    ]);

    await writeFile(path.join(root, 'helper.ts'), helper(7));
    const second = compiled(await compileRustDataFile('entry.proto.ts', { ...options, root }));
    expect(second.ir.sourceFiles.find(({ file }) => file === 'entry.proto.ts')!.sha256).toBe(
      first.ir.sourceFiles.find(({ file }) => file === 'entry.proto.ts')!.sha256
    );
    expect(second.ir.source.sha256).not.toBe(first.ir.source.sha256);
    expect(second.output.code).not.toBe(first.output.code);
    expect(receipt(second).sourceFiles).not.toEqual(firstReceipt.sourceFiles);
    const manifest = (value: RustDataCompilation) =>
      value.output.supportingFiles.find(({ path }) => path === 'Cargo.toml')!.contents;
    expect(manifest(second)).toBe(manifest(first));
    expect(manifest(first)).toContain('name = "headless-decisions"');
  });

  it('uses explicit proto package exports and records the selecting manifest', async () => {
    const root = await temporary();
    const packageRoot = path.join(root, 'node_modules/@test/decisions');
    await mkdir(path.join(packageRoot, 'src'), { recursive: true });
    const manifest = JSON.stringify({
      name: '@test/decisions',
      exports: { '.': { proto: './src/entry.ts', default: './unexecuted.js' } },
    });
    await writeFile(path.join(packageRoot, 'package.json'), manifest);
    await writeFile(path.join(packageRoot, 'src/entry.ts'), helper(3));
    await writeFile(
      path.join(packageRoot, 'unexecuted.js'),
      `throw new Error('Runtime package must not execute');`
    );
    await writeFile(path.join(root, 'entry.proto.ts'), source('@test/decisions'));
    const result = compiled(await compileRustDataFile('entry.proto.ts', { ...options, root }));
    expect(result.output.provenance.sourceResolution).toMatchObject({
      version: 1,
      packages: [{ sha256: createHash('sha256').update(manifest).digest('hex') }],
    });
    expect(Object.values(result.output.provenance.sourceResolution!.imports)).toContain(
      'node_modules/@test/decisions/src/entry.ts'
    );
    expect(receipt(result).sourceFiles).toHaveLength(2);
  });

  it('keeps absent files and missing closed inputs distinct from internal defects', async () => {
    const root = await temporary();
    expect(await compileRustDataFile('missing.proto.ts', { ...options, root })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1003', category: 'invalid-input' }],
    });
    expect(
      await compileRustDataFile('entry.proto.ts', {
        ...options,
        sourceSnapshot: { entry: 'entry.proto.ts', files: {} },
      })
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1003', category: 'invalid-input' }],
    });
    const files = Object.defineProperty({}, 'entry.proto.ts', {
      get() {
        throw new TypeError('snapshot failure');
      },
    });
    const result = await compileRustDataFile('entry.proto.ts', {
      ...options,
      sourceSnapshot: { entry: 'entry.proto.ts', files },
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'PUI1999',
          category: 'compiler-defect',
          message: expect.stringContaining('snapshot failure'),
        },
      ],
    });
  });

  it('writes a complete hash inventory and compares retained bytes without replacing them', async () => {
    const root = await temporary();
    const result = compiled(
      compileRustDataPrototype(source('./helper'), {
        ...options,
        fileName: 'entry.proto.ts',
        files: { 'helper.ts': helper(2) },
      })
    );
    const output = path.join(root, 'generated');
    const written = await writeRustDataCompilation(result, output);
    expect(written.ok).toBe(true);
    const inventory = receipt(result);
    expect(inventory).toMatchObject({
      format: 'proto-ui-rust-data',
      version: 1,
      backend: 'rust-data-v1',
      profile: 'rust-data-v1',
      dependencies: [],
    });
    expect(inventory.methods[0]).toMatchObject({ name: 'offset', returnType: 'number' });
    for (const file of inventory.artifacts) {
      expect(
        createHash('sha256')
          .update(await readFile(path.join(output, file.path)))
          .digest('hex')
      ).toBe(file.sha256);
    }
    const equal = await diffRustDataCompilation(result, output);
    expect(equal.ok && equal.value.changes.every(({ status }) => status === 'unchanged')).toBe(
      true
    );

    expect(await readFile(path.join(output, 'lib.rs'), 'utf8')).toMatch(
      /^#!\[allow\([^\]]*\bunused_parens\b/m
    );
    const authored = 'consumer-owned extra file\n';
    await writeFile(path.join(output, 'notes.txt'), authored);
    const originalSource = await readFile(path.join(output, 'lib.rs'), 'utf8');
    await writeFile(path.join(output, 'lib.rs'), originalSource + '\n// consumer edit\n');
    expect(await writeRustDataCompilation(result, output)).toMatchObject({ ok: false });
    const changed = await diffRustDataCompilation(result, output);
    expect(changed.ok && changed.value.changes.find(({ path }) => path === 'lib.rs')).toMatchObject(
      { status: 'modified', consumerModified: true }
    );
    expect(await readFile(path.join(output, 'notes.txt'), 'utf8')).toBe(authored);
    expect(await readFile(path.join(output, 'lib.rs'), 'utf8')).toBe(
      originalSource + '\n// consumer edit\n'
    );
  });

  nativeTest(
    'executes an imported helper mutation in fresh headless Cargo consumers',
    async () => {
      const root = await temporary();
      await writeFile(path.join(root, 'entry.proto.ts'), source('./helper'));
      const invoke = (args: string[]) => {
        const result = spawnSync(cargo, args, { encoding: 'utf8', timeout: 60_000 });
        if (result.error) throw result.error;
        expect(result.status, result.stdout + result.stderr).toBe(0);
        return result.stdout;
      };
      for (const amount of [2, 7]) {
        await writeFile(path.join(root, 'helper.ts'), helper(amount));
        const candidate = compiled(
          await compileRustDataFile('entry.proto.ts', { ...options, root })
        );
        const output = path.join(root, `consumer-${amount}`);
        expect((await writeRustDataCompilation(candidate, output)).ok).toBe(true);
        await mkdir(path.join(output, 'tests'));
        await writeFile(
          path.join(output, 'tests/decision.rs'),
          `#[test]\nfn imported_source_decides() { assert_eq!(headless_decisions::offset(10.0).unwrap(), ${10 + amount}.0); }\n`
        );
        const manifest = path.join(output, 'Cargo.toml');
        invoke(['generate-lockfile', '--offline', '--manifest-path', manifest]);
        invoke(['test', '--offline', '--locked', '--manifest-path', manifest]);
        const metadata = JSON.parse(
          invoke([
            'metadata',
            '--offline',
            '--locked',
            '--format-version',
            '1',
            '--manifest-path',
            manifest,
          ])
        );
        expect(metadata.packages.map(({ name }: { name: string }) => name)).toEqual([
          'headless-decisions',
        ]);
        expect(metadata.resolve.nodes).toHaveLength(1);
        expect(metadata.resolve.nodes[0].dependencies).toEqual([]);
      }
    },
    120_000
  );
});

describe('Rust data source-license artifact provenance', () => {
  it('forwards file options and binds license-only changes into the artifact inventory', async () => {
    const root = await temporary();
    await writeFile(path.join(root, 'entry.proto.ts'), source('./helper'));
    await writeFile(path.join(root, 'helper.ts'), helper(2));
    const first = compiled(
      await compileRustDataFile('entry.proto.ts', {
        ...options,
        root,
        sourceLicense: 'AGPL-3.0-or-later',
      })
    );
    const second = compiled(
      await compileRustDataFile('entry.proto.ts', { ...options, root, sourceLicense: 'MIT' })
    );
    expect(first.ir).toEqual(second.ir);
    expect(first.output.code).toBe(second.output.code);
    expect(receipt(first).sourceLicense).toBe('AGPL-3.0-or-later');
    expect(receipt(second).sourceLicense).toBe('MIT');
    expect(receipt(first).sourceFiles).toEqual(receipt(second).sourceFiles);
    const firstArtifacts = rustDataCompilationArtifacts(first);
    const secondArtifacts = rustDataCompilationArtifacts(second);
    expect(
      firstArtifacts
        .filter(
          (file) =>
            secondArtifacts.find(({ path }) => path === file.path)?.contents !== file.contents
        )
        .map(({ path }) => path)
        .sort()
    ).toEqual(['Cargo.toml', 'provenance.json']);
    for (const candidate of [first, second]) {
      for (const file of receipt(candidate).artifacts) {
        const artifact = rustDataCompilationArtifacts(candidate).find(
          ({ path }) => path === file.path
        )!;
        expect(createHash('sha256').update(artifact.contents).digest('hex')).toBe(file.sha256);
      }
    }
    const output = path.join(root, 'retained');
    expect((await writeRustDataCompilation(first, output)).ok).toBe(true);
    const diff = await diffRustDataCompilation(second, output);
    expect(diff.ok).toBe(true);
    if (!diff.ok) throw new Error(JSON.stringify(diff.diagnostics));
    expect(
      diff.value.changes
        .filter(({ status }) => status !== 'unchanged')
        .map(({ path }) => path)
        .sort()
    ).toEqual(['Cargo.toml', 'provenance.json']);
    expect(await readFile(path.join(output, 'Cargo.toml'), 'utf8')).toBe(
      firstArtifacts.find(({ path }) => path === 'Cargo.toml')!.contents
    );
  });

  nativeTest(
    'exposes selected or absent source-license metadata through the real Cargo manifest parser',
    async () => {
      const root = await temporary();
      await writeFile(path.join(root, 'entry.proto.ts'), source('./helper'));
      await writeFile(path.join(root, 'helper.ts'), helper(2));
      const selected = ['AGPL-3.0-or-later', 'Apache-2.0 OR MIT', undefined];
      for (let index = 0; index < selected.length; index++) {
        const sourceLicense = selected[index];
        const candidate = compiled(
          await compileRustDataFile('entry.proto.ts', { ...options, root, sourceLicense })
        );
        const output = path.join(root, 'metadata-' + index);
        expect((await writeRustDataCompilation(candidate, output)).ok).toBe(true);
        const manifest = path.join(output, 'Cargo.toml');
        const invoke = (args: string[]) => {
          const result = spawnSync(cargo, args, { encoding: 'utf8', timeout: 60_000 });
          if (result.error) throw result.error;
          expect(result.status, result.stdout + result.stderr).toBe(0);
          return result.stdout;
        };
        invoke(['generate-lockfile', '--offline', '--manifest-path', manifest]);
        const metadata = JSON.parse(
          invoke([
            'metadata',
            '--offline',
            '--locked',
            '--format-version',
            '1',
            '--manifest-path',
            manifest,
          ])
        );
        expect(metadata.packages).toHaveLength(1);
        expect(metadata.packages[0]).toMatchObject({
          name: 'headless-decisions',
          license: sourceLicense ?? null,
          publish: [],
        });
        expect(metadata.resolve.nodes).toHaveLength(1);
        expect(metadata.resolve.nodes[0].dependencies).toEqual([]);
      }
    },
    60_000
  );
});
