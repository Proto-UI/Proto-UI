// @vitest-environment node
import { access, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileProject } from './project';
import {
  artifactDigest,
  compilerLibraryArtifacts,
  prepareCompilerLibrary,
  readCompilerLibrary,
  writeCompilerLibrary,
  type CompilerLibrary,
  type CompilerLibraryOptions,
} from './artifact-library';
import { linkCompilerLibraries, writeLinkedCompilerLibraries } from './artifact-linking';

const temporary: string[] = [];
afterEach(async () => {
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function library(
  id: string,
  options: Partial<CompilerLibraryOptions> = {},
  schema = '{value:number}',
  profile = 'react-dom-source-v1'
) {
  const root = await mkdtemp(path.join(tmpdir(), 'compiler-library-'));
  temporary.push(root);
  await writeFile(
    path.join(root, 'keys.ts'),
    `import {createContextKey} from '@proto.ui/core';
    export const KEY=createContextKey<${schema}>('equal-debug-name');`
  );
  await writeFile(path.join(root, 'bridge.ts'), `export {KEY as RENAMED} from './keys';`);
  await writeFile(
    path.join(root, 'entry.proto.ts'),
    `import {definePrototype} from '@proto.ui/core';
    import {RENAMED as LOCAL} from './bridge';
    export default definePrototype({name:'entry',setup(def){def.context.trySubscribe(LOCAL);return r=>r.slot();}});`
  );
  const generation = await compileProject({ root, entries: ['entry.proto.ts'], profile });
  if (!generation.ok) throw new Error(JSON.stringify(generation.diagnostics));
  const extension =
    profile === 'react-dom-source-v1' ? '.tsx' : profile === 'vue2-source-v1' ? '.js' : '.ts';
  const prepared = prepareCompilerLibrary(generation.value, {
    id,
    sourcePaths: { 'entry.proto.ts': `Entry${extension}` },
    ...options,
  });
  if (!prepared.ok) throw new Error(JSON.stringify(prepared.diagnostics));
  return { root, library: prepared.value, generation: generation.value };
}

function source(library: CompilerLibrary, filename: string) {
  return library.artifacts.find((artifact) => artifact.path === filename)!;
}

describe('explicit separately compiled library linking', () => {
  it.each(['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1', 'web-component-source-v1'])(
    'links %s source aliases through explicit declaration exports',
    async (profile) => {
      const owner = await library(
        'owner',
        { exports: { PublicKey: 'keys.ts#KEY' } },
        undefined,
        profile
      );
      const importer = await library(
        'importer',
        {
          imports: { 'keys.ts#KEY': { library: 'owner', export: 'PublicKey' } },
        },
        undefined,
        profile
      );
      const result = linkCompilerLibraries([importer.library, owner.library], {
        directories: { owner: 'owner', importer: 'importer' },
      });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(result.value.declarations.find((item) => item.library === 'importer')).toMatchObject({
        ownerLibrary: 'owner',
        ownerDeclaration: 'keys.ts#KEY',
      });
      const declaration = importer.library.manifest.declarations[0];
      expect(
        result.value.artifacts.find((artifact) => artifact.path === `importer/${declaration.path}`)
          ?.contents
      ).toContain('export { key as key } from');
      expect(
        result.value.artifacts.filter(
          (artifact) =>
            artifact.path.endsWith('/scope-v1.ts') &&
            artifact.contents.includes('export function createContextScope')
        )
      ).toHaveLength(1);
      expect(
        result.value.artifacts.find(
          (artifact) => artifact.path === `owner/${owner.library.manifest.entries[0].sourcePath}`
        )?.contents
      ).toBe(source(owner.library, owner.library.manifest.entries[0].sourcePath).contents);
    }
  );

  it('round-trips independent artifacts, follows public re-exports and preserves linked provenance', async () => {
    const owner = await library('owner', { exports: { Key: 'keys.ts#KEY' } });
    const bridge = await library('bridge', {
      imports: { 'keys.ts#KEY': { library: 'owner', export: 'Key' } },
      exports: { PublicKey: 'keys.ts#KEY' },
    });
    const consumer = await library('consumer', {
      imports: { 'keys.ts#KEY': { library: 'bridge', export: 'PublicKey' } },
    });
    const decoded: CompilerLibrary[] = [];
    for (const current of [owner, bridge, consumer]) {
      const directory = path.join(current.root, 'published');
      expect((await writeCompilerLibrary(current.library, directory)).ok).toBe(true);
      const read = await readCompilerLibrary(directory);
      if (!read.ok) throw new Error(JSON.stringify(read.diagnostics));
      expect(read.value).toEqual(current.library);
      decoded.push(read.value);
    }
    const options = { directories: { owner: 'owner', bridge: 'bridge', consumer: 'consumer' } };
    const first = linkCompilerLibraries(decoded, options);
    const reversed = linkCompilerLibraries([...decoded].reverse(), options);
    expect(reversed).toEqual(first);
    if (!first.ok) throw new Error(JSON.stringify(first.diagnostics));
    expect(
      first.value.declarations.every((declaration) => declaration.ownerLibrary === 'owner')
    ).toBe(true);
    const output = path.join(owner.root, 'linked');
    const written = await writeLinkedCompilerLibraries(decoded, output, options);
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    expect(written.value.entries.consumer['entry.proto.ts']).toBe('consumer/Entry.tsx');
    const provenance = JSON.parse(
      await readFile(path.join(output, 'consumer/Entry.tsx.provenance.json'), 'utf8')
    );
    expect(provenance.linkage.library).toBe('consumer');
    const keyPath = consumer.library.manifest.declarations[0].path;
    const keyContents = await readFile(path.join(output, 'consumer', keyPath), 'utf8');
    expect(
      provenance.artifacts.find((artifact: { path: string }) => artifact.path === keyPath).sha256
    ).toBe(artifactDigest(keyContents));
    expect(
      provenance.originArtifacts.find((artifact: { path: string }) => artifact.path === keyPath)
        .sha256
    ).not.toBe(artifactDigest(keyContents));
    expect((await writeLinkedCompilerLibraries(decoded, output, options)).ok).toBe(false);
    expect(await readFile(path.join(output, 'consumer', keyPath), 'utf8')).toBe(keyContents);
  });

  it('keeps unmarked equal-name equal-source declarations private', async () => {
    const first = await library('first');
    const second = await library('second');
    const linked = linkCompilerLibraries([first.library, second.library]);
    if (!linked.ok) throw new Error(JSON.stringify(linked.diagnostics));
    expect(linked.value.declarations.map((declaration) => declaration.ownerLibrary)).toEqual([
      'first',
      'second',
    ]);
    expect(
      new Set(linked.value.declarations.map((declaration) => declaration.ownerPath)).size
    ).toBe(2);
    const keyFiles = linked.value.artifacts.filter((artifact) =>
      /context\/key-/.test(artifact.path)
    );
    expect(keyFiles).toHaveLength(2);
    expect(keyFiles.every((artifact) => artifact.contents.includes('Object.freeze'))).toBe(true);
  });

  it('compares Context contracts structurally rather than by source text or debug name', async () => {
    const owner = await library(
      'owner',
      { exports: { Key: 'keys.ts#KEY' } },
      '{a:number;b?:string|null}'
    );
    const compatible = await library(
      'compatible',
      {
        imports: { 'keys.ts#KEY': { library: 'owner', export: 'Key' } },
      },
      '{b?:null|string;a:number}'
    );
    expect(linkCompilerLibraries([owner.library, compatible.library]).ok).toBe(true);
    const mismatch = await library(
      'mismatch',
      {
        imports: { 'keys.ts#KEY': { library: 'owner', export: 'Key' } },
      },
      '{a:string;b?:string|null}'
    );
    const result = linkCompilerLibraries([owner.library, mismatch.library]);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4204' }] });
  });

  it('rejects missing exports and cycles before any output is created', async () => {
    const first = await library('first', {
      exports: { Key: 'keys.ts#KEY' },
      imports: { 'keys.ts#KEY': { library: 'second', export: 'Key' } },
    });
    const second = await library('second', {
      exports: { Key: 'keys.ts#KEY' },
      imports: { 'keys.ts#KEY': { library: 'first', export: 'Key' } },
    });
    expect(linkCompilerLibraries([first.library])).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4202' }],
    });
    const destination = path.join(first.root, 'invalid');
    expect(
      await writeLinkedCompilerLibraries([first.library, second.library], destination)
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4202', message: expect.stringContaining('cycle') }],
    });
    await expect(access(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a different shared support implementation even when each library has valid hashes', async () => {
    const first = await library('first');
    const second = await library('second');
    const modified = JSON.parse(JSON.stringify(second.library)) as CompilerLibrary;
    const filename = '.proto-ui/context/scope-v1.ts';
    const artifact = source(modified, filename);
    artifact.contents += '\n// Independently changed support implementation.\n';
    const hash = artifactDigest(artifact.contents);
    const replacement = {
      ...modified,
      manifest: {
        ...modified.manifest,
        artifacts: modified.manifest.artifacts.map((record) =>
          record.path === filename ? { ...record, sha256: hash } : record
        ),
        support: modified.manifest.support.map((record) =>
          record.path === filename ? { ...record, sha256: hash } : record
        ),
      },
    };
    expect(compilerLibraryArtifacts(replacement).ok).toBe(true);
    expect(linkCompilerLibraries([first.library, replacement])).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4203', message: expect.stringContaining('fingerprint') }],
    });
    const wrongVersion = {
      ...second.library,
      manifest: {
        ...second.library.manifest,
        support: second.library.manifest.support.map((support) => ({
          ...support,
          version: support.version + 1,
        })),
      },
    };
    expect(linkCompilerLibraries([first.library, wrongVersion])).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4203' }],
    });
  });

  it('rejects tampered files, symlinks and unsafe manifest paths', async () => {
    const current = await library('owner');
    const destination = path.join(current.root, 'published');
    expect((await writeCompilerLibrary(current.library, destination)).ok).toBe(true);
    await writeFile(path.join(destination, 'Entry.tsx'), '// consumer modified');
    expect(await readCompilerLibrary(destination)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4201' }],
    });
    await rm(path.join(destination, 'Entry.tsx'));
    await symlink(path.join(current.root, 'entry.proto.ts'), path.join(destination, 'Entry.tsx'));
    expect(await readCompilerLibrary(destination)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4201' }],
    });
    const manifestPath = path.join(destination, 'compiler-library.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.artifacts[0].path = '../outside.ts';
    await writeFile(manifestPath, JSON.stringify(manifest));
    expect(await readCompilerLibrary(destination)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4201' }],
    });
  });

  it('rejects undeclared exports, ambiguous library IDs, invalid layouts and unsupported targets', async () => {
    const current = await library('owner');
    expect(
      prepareCompilerLibrary(current.generation, {
        id: 'owner',
        sourcePaths: { 'entry.proto.ts': 'Entry.tsx' },
        exports: { Key: 'bridge.ts#RENAMED' },
      })
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4201' }] });
    expect(linkCompilerLibraries([current.library, current.library])).toMatchObject({ ok: false });
    expect(
      linkCompilerLibraries([null as unknown as CompilerLibrary, current.library])
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI4201' }] });
    for (const directory of ['../outside', '.proto-ui/inside', 'CON', ''])
      expect(
        linkCompilerLibraries([current.library], { directories: { owner: directory } })
      ).toMatchObject({ ok: false });
    const unsupported = {
      ...current.generation,
      entries: current.generation.entries.map((entry) => ({
        ...entry,
        compilation: {
          ...entry.compilation,
          output: { ...entry.compilation.output, profile: 'react-runtime-v1' as const },
        },
      })),
    };
    expect(
      prepareCompilerLibrary(unsupported, {
        id: 'owner',
        sourcePaths: { 'entry.proto.ts': 'Entry.tsx' },
      })
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI4201', category: 'unsupported-input' }],
    });
  });
});
