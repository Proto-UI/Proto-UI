// @vitest-environment node
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileProject, type SuccessfulProjectGeneration } from './project';
import {
  diffProjectCompilation,
  projectCompilationArtifacts,
  writeProjectCompilation,
} from './project-output';

const temporary: string[] = [];
const paths = { 'provider.proto.ts': 'Provider.tsx', 'consumer.proto.ts': 'Consumer.tsx' };
afterEach(async () => {
  for (const root of temporary.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture(profile = 'react-dom-source-v1') {
  const root = await mkdtemp(path.join(tmpdir(), 'proto-project-output-'));
  temporary.push(root);
  await writeFile(
    path.join(root, 'keys.ts'),
    `import {createContextKey} from '@proto.ui/core';
    export const KEY=createContextKey<{value:number}>('shared');`
  );
  await writeFile(
    path.join(root, 'provider.proto.ts'),
    `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
    export default definePrototype({name:'provider',setup(def){def.context.provide(KEY,{value:1});return r=>r.el('section',r.slot());}});`
  );
  await writeFile(
    path.join(root, 'consumer.proto.ts'),
    `import {definePrototype} from '@proto.ui/core';import {KEY} from './keys';
    export default definePrototype({name:'consumer',setup(def){def.context.subscribe(KEY);return r=>r.el('output',r.read.context.read(KEY).value);}});`
  );
  const options = { root, entries: Object.keys(paths), profile };
  const result = await compileProject(options);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return { root, options, generation: result.value };
}

describe('project artifact publication', () => {
  it.each([
    ['react-dom-source-v1', '.tsx'],
    ['vue-source-v1', '.ts'],
    ['vue2-source-v1', '.js'],
    ['web-component-source-v1', '.ts'],
  ])(
    'coalesces the %s declaration graph without losing per-entry provenance',
    async (profile, extension) => {
      const { generation } = await fixture(profile);
      const result = projectCompilationArtifacts(generation, {
        sourcePaths: {
          'provider.proto.ts': `Provider${extension}`,
          'consumer.proto.ts': `Consumer${extension}`,
        },
      });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      const files = result.value;
      expect(new Set(files.map((file) => file.path)).size).toBe(files.length);
      expect(files.filter((file) => /context\/key-/.test(file.path))).toHaveLength(1);
      expect(files.filter((file) => file.path === '.proto-ui/context/scope-v1.ts')).toHaveLength(1);
      const manifest = JSON.parse(files.find((file) => file.path === 'provenance.json')!.contents);
      expect(manifest.entries).toHaveLength(2);
      expect(manifest.artifacts).toHaveLength(files.length - 1);
      for (const record of manifest.artifacts) {
        const artifact = files.find((file) => file.path === record.path)!;
        expect(record.sha256).toBe(createHash('sha256').update(artifact.contents).digest('hex'));
      }
      for (const record of manifest.entries) {
        const source = files.find((file) => file.path === record.sourcePath)!;
        const map = JSON.parse(
          files.find((file) => file.path === `${record.sourcePath}.map`)!.contents
        );
        const entryManifest = JSON.parse(
          files.find((file) => file.path === record.manifestPath)!.contents
        );
        expect(source.contents).toContain(`//# sourceMappingURL=${record.sourcePath}.map`);
        expect(map.file).toBe(record.sourcePath);
        expect(map.sources).toContain(record.entry);
        expect(entryManifest.generatedSha256).toBe(
          createHash('sha256').update(source.contents).digest('hex')
        );
      }
    }
  );

  it('publishes deterministic fresh generations and reports consumer edits without overwriting them', async () => {
    const { root, options, generation } = await fixture();
    const cached = await compileProject(options, generation.project);
    if (!cached.ok) throw new Error(JSON.stringify(cached.diagnostics));
    expect(projectCompilationArtifacts(cached.value, { sourcePaths: paths })).toEqual(
      projectCompilationArtifacts(generation, { sourcePaths: paths })
    );
    const output = path.join(root, 'output');
    expect((await writeProjectCompilation(generation, output, { sourcePaths: paths })).ok).toBe(
      true
    );
    const unchanged = await diffProjectCompilation(generation, output, { sourcePaths: paths });
    if (!unchanged.ok) throw new Error(JSON.stringify(unchanged.diagnostics));
    expect(unchanged.value.changes.every((change) => change.status === 'unchanged')).toBe(true);
    const filename = path.join(output, 'Consumer.tsx');
    const edited = (await readFile(filename, 'utf8')) + '\n// Consumer-owned change.\n';
    await writeFile(filename, edited);
    const diff = await diffProjectCompilation(generation, output, { sourcePaths: paths });
    if (!diff.ok) throw new Error(JSON.stringify(diff.diagnostics));
    expect(diff.value.changes.find((change) => change.path === 'Consumer.tsx')).toMatchObject({
      status: 'modified',
      consumerModified: true,
    });
    expect((await writeProjectCompilation(generation, output, { sourcePaths: paths })).ok).toBe(
      false
    );
    expect(await readFile(filename, 'utf8')).toBe(edited);
  });

  it('rejects incomplete, ambiguous, nested and unsafe entry mappings before creating output', async () => {
    const { root, generation } = await fixture();
    const candidates = [
      { 'provider.proto.ts': 'Provider.tsx' },
      { ...paths, 'unknown.proto.ts': 'Unknown.tsx' },
      { ...paths, 'consumer.proto.ts': 'Provider.tsx' },
      { ...paths, 'consumer.proto.ts': 'provider.tsx' },
      { ...paths, 'consumer.proto.ts': '../Consumer.tsx' },
      { ...paths, 'consumer.proto.ts': 'nested/Consumer.tsx' },
      { ...paths, 'consumer.proto.ts': 'Consumer.js' },
    ];
    for (let index = 0; index < candidates.length; index++) {
      const output = path.join(root, `invalid-${index}`);
      const result = await writeProjectCompilation(generation, output, {
        sourcePaths: candidates[index],
      });
      expect(result.ok).toBe(false);
      await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('rejects conflicting shared bytes or kinds without silently choosing one entry', async () => {
    const { root, generation } = await fixture();
    for (const replacement of [
      { contents: '// conflicting helper' },
      { kind: 'declaration' as const },
    ]) {
      const entries = generation.entries.map((entry, index) =>
        index !== 1
          ? entry
          : {
              ...entry,
              compilation: {
                ...entry.compilation,
                output: {
                  ...entry.compilation.output,
                  supportingFiles: entry.compilation.output.supportingFiles!.map((file) =>
                    file.path.endsWith('/scope-v1.ts') ? { ...file, ...replacement } : file
                  ),
                },
              },
            }
      );
      const output = path.join(root, `conflict-${Object.keys(replacement)[0]}`);
      const result = await writeProjectCompilation({ ...generation, entries }, output, {
        sourcePaths: paths,
      });
      if (result.ok) throw new Error('Conflicting helper must reject the whole publication.');
      expect(result.diagnostics[0]).toMatchObject({
        category: 'output-conflict',
        span: { file: '.proto-ui/context/scope-v1.ts' },
      });
      await expect(access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('keeps source generations and profile identities consistent', async () => {
    const { generation } = await fixture();
    const change = (
      replace: (generation: SuccessfulProjectGeneration) => SuccessfulProjectGeneration
    ) => projectCompilationArtifacts(replace(generation), { sourcePaths: paths });
    expect(change((value) => ({ ...value, entries: [] })).ok).toBe(false);
    expect(
      change((value) => ({
        ...value,
        entries: value.entries.map((entry, index) =>
          index !== 1
            ? entry
            : {
                ...entry,
                compilation: {
                  ...entry.compilation,
                  output: { ...entry.compilation.output, profile: 'vue-source-v1' },
                },
              }
        ),
      })).ok
    ).toBe(false);
    expect(
      change((value) => ({
        ...value,
        entries: value.entries.map((entry, index) =>
          index !== 1
            ? entry
            : {
                ...entry,
                compilation: {
                  ...entry.compilation,
                  ir: {
                    ...entry.compilation.ir,
                    sourceFiles: entry.compilation.ir.sourceFiles.map((file) =>
                      file.file === 'keys.ts' ? { ...file, sha256: 'different' } : file
                    ),
                  },
                },
              }
        ),
      })).ok
    ).toBe(false);
  });
});
