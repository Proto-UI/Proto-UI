// @vitest-environment node
import { lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeArtifactSet, type OutputArtifact } from './artifact-output';

const temporary: string[] = [];
const artifacts: OutputArtifact[] = [
  { path: 'source/component.ts', kind: 'source', contents: 'export const label = "雪";\r\n' },
  { path: 'style/component.css', kind: 'style', contents: '.component::before { content: "é"; }\n' },
  { path: 'types/component.d.ts', kind: 'declaration', contents: 'export declare const label: string;\n' },
  { path: 'maps/component.js.map', kind: 'source-map', contents: '{"version":3,"mappings":"AAAA"}\n' },
  { path: 'build.json', kind: 'manifest', contents: '{"artifacts":["source/component.ts"]}\n' },
];

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'proto-artifact-output-'));
  temporary.push(root);
  return { root, directory: path.join(root, 'fresh') };
}

function injectedFailure() {
  return Object.assign(new Error('Injected partial write: no space'), { code: 'ENOSPC' });
}

afterEach(async () => {
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('create-only artifact set publication', () => {
  it('publishes every artifact kind byte-exactly with a deterministic absolute file list', async () => {
    const { directory } = await fixture();
    const result = await writeArtifactSet(artifacts, directory);
    expect(result).toEqual({
      ok: true,
      value: {
        directory,
        files: ['build.json', 'maps/component.js.map', 'source/component.ts', 'style/component.css', 'types/component.d.ts']
          .map((filename) => path.join(directory, filename)),
      },
    });
    for (const artifact of artifacts)
      expect(await readFile(path.join(directory, artifact.path))).toEqual(Buffer.from(artifact.contents, 'utf8'));
  });

  it('reserves the destination exclusively across competing complete publications', async () => {
    const { directory } = await fixture();
    const makeSet = (value: string): OutputArtifact[] => [
      { path: 'a.ts', kind: 'source', contents: value },
      { path: 'nested/b.css', kind: 'style', contents: value },
    ];
    const results = await Promise.all([
      writeArtifactSet(makeSet('first'), directory),
      writeArtifactSet(makeSet('second'), directory),
    ]);
    const winner = results.findIndex((result) => result.ok);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results[1 - winner]).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'output-conflict', code: 'PUI3002' }],
    });
    const expected = winner === 0 ? 'first' : 'second';
    expect(await readFile(path.join(directory, 'a.ts'), 'utf8')).toBe(expected);
    expect(await readFile(path.join(directory, 'nested/b.css'), 'utf8')).toBe(expected);
  });

  it('leaves an existing consumer destination and its edited manifest untouched', async () => {
    const { directory } = await fixture();
    await mkdir(directory);
    await writeFile(path.join(directory, 'build.json'), 'consumer-owned manifest');
    const result = await writeArtifactSet(artifacts, directory);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ category: 'output-conflict' }] });
    expect(await readFile(path.join(directory, 'build.json'), 'utf8')).toBe('consumer-owned manifest');
    expect(await readdir(directory)).toEqual(['build.json']);
  });

  it('does not follow a pre-existing destination symlink', async () => {
    const { root, directory } = await fixture();
    const consumer = path.join(root, 'consumer');
    await mkdir(consumer);
    await writeFile(path.join(consumer, 'build.json'), 'consumer bytes');
    await symlink(consumer, directory, 'dir');
    expect(await writeArtifactSet(artifacts, directory)).toMatchObject({
      ok: false, diagnostics: [{ category: 'output-conflict' }],
    });
    expect((await lstat(directory)).isSymbolicLink()).toBe(true);
    expect(await readdir(consumer)).toEqual(['build.json']);
    expect(await readFile(path.join(consumer, 'build.json'), 'utf8')).toBe('consumer bytes');
  });

  it('rolls back both completed files and nested partial bytes, permitting a clean retry', async () => {
    const { directory } = await fixture();
    const result = await writeArtifactSet(artifacts, directory, async (filename) => {
      const handle = await open(filename, 'wx');
      return {
        stat: () => handle.stat(),
        async writeFile(contents) {
          if (filename.endsWith('component.js.map')) {
            await handle.writeFile(contents.slice(0, 8));
            throw injectedFailure();
          }
          await handle.writeFile(contents);
        },
        close: () => handle.close(),
      };
    });
    expect(result).toMatchObject({
      ok: false, diagnostics: [{ category: 'output-write', code: 'PUI3003' }],
    });
    if (!result.ok)
      expect(result.diagnostics[0].span.file).toBe(path.join(directory, 'maps/component.js.map'));
    await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await writeArtifactSet(artifacts, directory)).toMatchObject({ ok: true });
    for (const artifact of artifacts)
      expect(await readFile(path.join(directory, artifact.path), 'utf8')).toBe(artifact.contents);
  });

  it('treats a close failure as publication failure and rolls back written bytes', async () => {
    const { directory } = await fixture();
    const result = await writeArtifactSet([artifacts[4]], directory, async (filename) => {
      const handle = await open(filename, 'wx');
      return {
        stat: () => handle.stat(),
        writeFile: (contents) => handle.writeFile(contents),
        async close() {
          await handle.close();
          throw Object.assign(new Error('Injected close failure'), { code: 'EIO' });
        },
      };
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ category: 'output-write' }] });
    await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('preserves a foreign file when its exclusive open fails after reservation', async () => {
    const { directory } = await fixture();
    const result = await writeArtifactSet(artifacts, directory, async (filename) => {
      await writeFile(filename, 'foreign collision', { flag: 'wx' });
      return open(filename, 'wx');
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ category: 'output-conflict' }] });
    expect(await readdir(directory)).toEqual(['build.json']);
    expect(await readFile(path.join(directory, 'build.json'), 'utf8')).toBe('foreign collision');
    if (!result.ok) expect(result.diagnostics[0].message).toContain(directory);
  });

  it('preserves concurrent foreign nested files and accurately reports unresolved owned directories', async () => {
    const { directory } = await fixture();
    const set: OutputArtifact[] = [
      { path: 'a.ts', kind: 'source', contents: 'complete source' },
      { path: 'nested/b.css', kind: 'style', contents: 'partial style' },
    ];
    const result = await writeArtifactSet(set, directory, async (filename) => {
      const handle = await open(filename, 'wx');
      return {
        stat: () => handle.stat(),
        async writeFile(contents) {
          await handle.writeFile(contents);
          if (path.basename(filename) === 'b.css') {
            await writeFile(path.join(directory, 'nested/consumer.css'), 'foreign style');
            throw injectedFailure();
          }
        },
        close: () => handle.close(),
      };
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ category: 'output-write' }] });
    expect(await readdir(directory)).toEqual(['nested']);
    expect(await readdir(path.join(directory, 'nested'))).toEqual(['consumer.css']);
    expect(await readFile(path.join(directory, 'nested/consumer.css'), 'utf8')).toBe('foreign style');
    if (!result.ok) {
      expect(result.diagnostics[0].message).toContain(path.join(directory, 'nested'));
      expect(result.diagnostics[0].message).not.toContain(path.join(directory, 'a.ts'));
    }
  });

  it('does not unlink a foreign replacement of an earlier owned file during rollback', async () => {
    const { root, directory } = await fixture();
    const set: OutputArtifact[] = [
      { path: 'a.ts', kind: 'source', contents: 'generated source' },
      { path: 'b.css', kind: 'style', contents: 'generated style' },
    ];
    const result = await writeArtifactSet(set, directory, async (filename) => {
      const handle = await open(filename, 'wx');
      return {
        stat: () => handle.stat(),
        async writeFile(contents) {
          await handle.writeFile(contents);
          if (path.basename(filename) === 'b.css') {
            const replacement = path.join(root, 'replacement');
            await writeFile(replacement, 'consumer replacement');
            await rename(replacement, path.join(directory, 'a.ts'));
            throw injectedFailure();
          }
        },
        close: () => handle.close(),
      };
    });
    expect(result.ok).toBe(false);
    expect(await readdir(directory)).toEqual(['a.ts']);
    expect(await readFile(path.join(directory, 'a.ts'), 'utf8')).toBe('consumer replacement');
    if (!result.ok) expect(result.diagnostics[0].message).toContain(path.join(directory, 'a.ts'));
  });

  it('uses the opened descriptor when a path is replaced before exclusive open returns', async () => {
    const { root, directory } = await fixture();
    const relocated = path.join(root, 'relocated-file');
    const result = await writeArtifactSet([
      { path: 'a.ts', kind: 'source', contents: 'generated source' },
    ], directory, async (filename) => {
      const handle = await open(filename, 'wx');
      await rename(filename, relocated);
      await writeFile(filename, 'foreign replacement', { flag: 'wx' });
      return handle;
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ category: 'output-conflict' }] });
    expect(await readFile(path.join(directory, 'a.ts'), 'utf8')).toBe('foreign replacement');
    expect(await readFile(relocated, 'utf8')).toBe('');
    if (!result.ok) expect(result.diagnostics[0].message).toContain(path.join(directory, 'a.ts'));
  });

  it('does not traverse a replaced output directory when rolling back', async () => {
    const { root, directory } = await fixture();
    const consumer = path.join(root, 'consumer');
    const relocated = path.join(root, 'relocated-output');
    await mkdir(consumer);
    await writeFile(path.join(consumer, 'a.ts'), 'consumer source');
    const result = await writeArtifactSet([
      { path: 'a.ts', kind: 'source', contents: 'generated source' },
    ], directory, async (filename) => {
      const handle = await open(filename, 'wx');
      return {
        stat: () => handle.stat(),
        async writeFile(contents) {
          await handle.writeFile(contents.slice(0, 4));
          await rename(directory, relocated);
          await symlink(consumer, directory, 'dir');
          throw injectedFailure();
        },
        close: () => handle.close(),
      };
    });
    expect(result.ok).toBe(false);
    expect((await lstat(directory)).isSymbolicLink()).toBe(true);
    expect(await readFile(path.join(consumer, 'a.ts'), 'utf8')).toBe('consumer source');
    expect(await readFile(path.join(relocated, 'a.ts'), 'utf8')).toBe('gene');
    if (!result.ok) expect(result.diagnostics[0].message).toContain(path.join(directory, 'a.ts'));
  });

  it('rejects portable path hazards before reserving any destination', async () => {
    const { root } = await fixture();
    const hazards = [
      '', '../escape.ts', 'nested/../../escape.ts', '/absolute.ts', 'C:/drive.ts',
      '\\\\server\\share\\file.ts', 'nested\\file.ts', './file.ts', 'nested//file.ts',
      'trailing/', 'file.ts:stream', 'file.ts\0', 'CON.txt', 'nested/LPT1.css', 'file. ', 'file.',
    ];
    for (const filename of hazards) {
      const directory = path.join(root, 'output');
      expect(await writeArtifactSet([{ path: filename, kind: 'source', contents: 'unsafe' }], directory))
        .toMatchObject({ ok: false, diagnostics: [{ category: 'invalid-input' }] });
      await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
    }
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects duplicate, prefix, case and Unicode aliases before writing', async () => {
    const { root } = await fixture();
    const collisions = [
      ['a.ts', 'a.ts'],
      ['A.ts', 'a.ts'],
      ['asset', 'asset/component.css'],
      ['asset/component.css', 'asset'],
      ['Styles/a.css', 'styles/b.css'],
      ['café/a.ts', 'cafe\u0301/b.ts'],
    ];
    for (const filenames of collisions) {
      const directory = path.join(root, 'output');
      const set: OutputArtifact[] = filenames.map((filename) => ({
        path: filename, kind: 'source', contents: 'colliding',
      }));
      expect(await writeArtifactSet(set, directory))
        .toMatchObject({ ok: false, diagnostics: [{ category: 'invalid-input' }] });
      await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
    }
    expect(await readdir(root)).toEqual([]);
  });
});
