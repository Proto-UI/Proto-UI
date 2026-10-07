// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCompilerCli } from '../src/cli';

const temporary: string[] = [];
const source = `import { definePrototype } from '@proto.ui/core';
export default definePrototype({ name: 'cli-fixture', setup(def) {
  const enabled = def.state.bool('enabled', false);
  def.expose.state('enabled', enabled);
} });`;

async function fixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'proto-compiler-cli-'));
  temporary.push(cwd);
  await writeFile(path.join(cwd, 'entry.proto.ts'), source);
  return cwd;
}

async function invoke(cwd: string, args: string[]) {
  let stdout = '';
  let stderr = '';
  const code = await runCompilerCli(args, {
    cwd,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}

interface WatchEvent {
  ok: boolean;
  revision: number;
  result?: { directory: string; files: string[] };
  lastSuccessful?: { revision: number; directory: string; files: string[] } | null;
  diagnostics: { category: string }[];
}

function watchInvocation(
  cwd: string,
  args = ['watch', 'entry.proto.ts', '--output', 'versions', '--json']
) {
  const cancellation = new AbortController();
  const events: WatchEvent[] = [];
  const finished = runCompilerCli(args, {
    cwd,
    signal: cancellation.signal,
    stdout: (text) => {
      events.push(JSON.parse(text));
    },
    stderr: () => {
      throw new Error('JSON watch unexpectedly wrote stderr');
    },
  });
  return { cancellation, events, finished };
}

afterEach(async () => {
  for (const directory of temporary.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('private compiler CLI', () => {
  it('compiles a real source to a fresh consumer-owned destination and refuses a second delivery', async () => {
    const cwd = await fixture();
    const args = ['compile', 'entry.proto.ts', '--output', 'generated', '--json'];
    const first = await invoke(cwd, args);
    expect(first.code).toBe(0);
    expect(first.stderr).toBe('');
    const delivered = JSON.parse(first.stdout);
    expect(delivered).toMatchObject({
      ok: true,
      command: 'compile',
      result: { directory: path.join(cwd, 'generated') },
    });
    const manifest = JSON.parse(
      await readFile(path.join(cwd, 'generated', 'provenance.json'), 'utf8')
    );
    expect(manifest).toMatchObject({
      profile: 'react-runtime-v1',
      source: { file: 'entry.proto.ts', exportName: 'default' },
    });
    await writeFile(path.join(cwd, 'generated', 'Component.tsx'), 'consumer edits');
    const repeated = await invoke(cwd, args);
    expect(repeated.code).toBe(1);
    expect(JSON.parse(repeated.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'output-conflict' }],
    });
    expect(await readFile(path.join(cwd, 'generated', 'Component.tsx'), 'utf8')).toBe(
      'consumer edits'
    );
  });

  it('checks, inspects and explains the real entry without reserving any output', async () => {
    const cwd = await fixture();
    const checked = await invoke(cwd, ['check', 'entry.proto.ts', '--json']);
    expect(checked.code).toBe(0);
    expect(JSON.parse(checked.stdout)).toMatchObject({
      ok: true,
      command: 'check',
      result: { name: 'cli-fixture', profile: 'react-runtime-v1' },
    });
    const inspected = await invoke(cwd, ['inspect', 'entry.proto.ts', '--json']);
    expect(inspected.code).toBe(0);
    expect(JSON.parse(inspected.stdout)).toMatchObject({
      ok: true,
      result: {
        name: 'cli-fixture',
        exposes: [{ name: 'enabled', kind: 'state', type: 'boolean' }],
      },
    });
    const explained = await invoke(cwd, ['explain', 'entry.proto.ts', '--json']);
    expect(explained.code).toBe(0);
    const details = JSON.parse(explained.stdout).result;
    expect(details.profile).toBe('react-runtime-v1');
    expect(details.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'react', role: 'target' }),
        expect.objectContaining({ name: '@proto.ui/adapter-react', role: 'host-bridge' }),
      ])
    );
    expect(await readdir(cwd)).toEqual(['entry.proto.ts']);
  });

  it('reports located compiler rejection in JSON and does not deliver a partial output', async () => {
    const cwd = await fixture();
    await writeFile(
      path.join(cwd, 'entry.proto.ts'),
      source.replace('const enabled =', "fetch('https://example.invalid'); const enabled =")
    );
    const result = await invoke(cwd, [
      'compile',
      'entry.proto.ts',
      '--output',
      'generated',
      '--json',
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'unsupported-input', span: { file: 'entry.proto.ts', line: 3 } }],
    });
    expect(await readdir(cwd)).toEqual(['entry.proto.ts']);
  });

  it('reports source read errors as checked failures rather than succeeding or writing', async () => {
    const cwd = await fixture();
    const result = await invoke(cwd, ['check', 'missing.proto.ts', '--json']);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'invalid-input' }],
    });
  });

  it('uses explicit configuration paths relative to the config, with CLI entry/export/output overrides relative to cwd', async () => {
    const cwd = await fixture();
    await mkdir(path.join(cwd, 'project'));
    await writeFile(
      path.join(cwd, 'project', 'configured.proto.ts'),
      source.replace('cli-fixture', 'configured')
    );
    await writeFile(
      path.join(cwd, 'selected.proto.ts'),
      source.replace('export default', 'export const selected =').replace('cli-fixture', 'selected')
    );
    await writeFile(
      path.join(cwd, 'project', 'compiler.json'),
      JSON.stringify({
        root: '..',
        entry: 'configured.proto.ts',
        output: 'generated',
        json: true,
      })
    );
    const configured = await invoke(cwd, ['inspect', '--config', 'project/compiler.json']);
    expect(configured.code).toBe(0);
    expect(JSON.parse(configured.stdout).result.name).toBe('configured');
    const overridden = await invoke(cwd, [
      'compile',
      '--config=project/compiler.json',
      '--entry=selected.proto.ts',
      '--export=selected',
      '--output=delivery',
    ]);
    expect(overridden.code).toBe(0);
    expect(JSON.parse(overridden.stdout).result.directory).toBe(path.join(cwd, 'delivery'));
    const manifest = JSON.parse(
      await readFile(path.join(cwd, 'delivery', 'provenance.json'), 'utf8')
    );
    expect(manifest.source).toMatchObject({ file: 'selected.proto.ts', exportName: 'selected' });
    expect(await readdir(path.join(cwd, 'project'))).toEqual([
      'compiler.json',
      'configured.proto.ts',
    ]);
  });

  it.each([
    ['check', 'entry.proto.ts', '--root', '.', '--root', '.'],
    ['check', 'entry.proto.ts', '--entry', 'entry.proto.ts'],
    ['check', 'entry.proto.ts', '--force'],
    ['check', 'entry.proto.ts', '--root'],
    ['check', 'entry.proto.ts', '--output', 'generated'],
    ['compile', 'entry.proto.ts'],
    ['watch', 'entry.proto.ts'],
    ['diff', 'entry.proto.ts'],
    ['watch', 'entry.proto.ts', '--output', 'versions', '--debounce', '1'],
    ['diff', 'entry.proto.ts', '--output', 'generated', '--force'],
  ])('rejects ambiguous or unsupported invocation %j before writing', async (...args) => {
    const cwd = await fixture();
    const result = await invoke(cwd, [...args, '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'invalid-input' }],
    });
    expect(await readdir(cwd)).toEqual(['entry.proto.ts']);
  });

  it.each([
    '{',
    '[]',
    '{"entry":"entry.proto.ts","unknown":true}',
    '{"entry":"entry.proto.ts","json":"yes"}',
    '{"entry":null}',
  ])('rejects malformed explicit configuration %s', async (contents) => {
    const cwd = await fixture();
    await writeFile(path.join(cwd, 'compiler.json'), contents);
    const result = await invoke(cwd, ['check', '--config', 'compiler.json', '--json']);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ span: { file: 'compiler.json' } }],
    });
  });

  it('does not silently select a fallback for an unsupported target profile', async () => {
    const cwd = await fixture();
    const result = await invoke(cwd, [
      'compile',
      'entry.proto.ts',
      '--output',
      'generated',
      '--profile',
      'flutter',
      '--json',
    ]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ category: 'unsupported-input' }],
    });
    expect(await readdir(cwd)).toEqual(['entry.proto.ts']);
  });

  it('delivers the explicitly selected source profile instead of the default runtime-backed output', async () => {
    const cwd = await fixture();
    const result = await invoke(cwd, [
      'compile',
      'entry.proto.ts',
      '--output',
      'native',
      '--profile',
      'react-dom-source-v1',
      '--json',
    ]);
    expect(result.code).toBe(0);
    const manifest = JSON.parse(
      await readFile(path.join(cwd, 'native', 'provenance.json'), 'utf8')
    );
    expect(manifest.profile).toBe('react-dom-source-v1');
    expect(manifest.dependencies).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'react', role: 'target' })])
    );
    expect(
      manifest.dependencies.some(
        (dependency: { role: string }) =>
          dependency.role === 'semantic-runtime' || dependency.role === 'host-bridge'
      )
    ).toBe(false);
  });

  it('keeps text diagnostics on stderr and structured inspect data on stdout', async () => {
    const cwd = await fixture();
    const failed = await invoke(cwd, ['check', 'missing.proto.ts']);
    expect(failed.code).toBe(1);
    expect(failed.stdout).toBe('');
    expect(failed.stderr).toContain('invalid-input');
    const inspected = await invoke(cwd, ['inspect', 'entry.proto.ts']);
    expect(inspected.code).toBe(0);
    expect(inspected.stderr).toBe('');
    expect(JSON.parse(inspected.stdout)).toMatchObject({ name: 'cli-fixture' });
  });

  it('diffs consumer-modified owned artifacts without replacing them or writing proposed output', async () => {
    const cwd = await fixture();
    expect(
      (await invoke(cwd, ['compile', 'entry.proto.ts', '--output', 'generated', '--json'])).code
    ).toBe(0);
    const identical = await invoke(cwd, [
      'diff',
      'entry.proto.ts',
      '--output',
      'generated',
      '--json',
    ]);
    expect(identical.code).toBe(0);
    await writeFile(path.join(cwd, 'generated', 'Component.tsx'), 'consumer edits');
    await writeFile(
      path.join(cwd, 'entry.proto.ts'),
      source.replace('cli-fixture', 'next-fixture')
    );
    const changed = await invoke(cwd, [
      'diff',
      'entry.proto.ts',
      '--output',
      'generated',
      '--json',
    ]);
    expect(changed.code).toBe(1);
    expect(JSON.parse(changed.stdout)).toMatchObject({
      ok: true,
      command: 'diff',
      result: {
        changes: expect.arrayContaining([
          {
            path: 'Component.tsx',
            status: 'modified',
            consumerModified: true,
            currentSha256: expect.any(String),
            generatedSha256: expect.any(String),
            recordedSha256: expect.any(String),
          },
        ]),
      },
    });
    expect(await readFile(path.join(cwd, 'generated', 'Component.tsx'), 'utf8')).toBe(
      'consumer edits'
    );
    expect(await readdir(cwd)).toEqual(['entry.proto.ts', 'generated']);
  });

  it('refuses to diff an unowned destination and preserves its files', async () => {
    const cwd = await fixture();
    await mkdir(path.join(cwd, 'consumer'));
    await writeFile(path.join(cwd, 'consumer', 'Component.tsx'), 'owned by consumer');
    const result = await invoke(cwd, ['diff', 'entry.proto.ts', '--output', 'consumer', '--json']);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout).ok).toBe(false);
    expect(await readdir(path.join(cwd, 'consumer'))).toEqual(['Component.tsx']);
    expect(await readFile(path.join(cwd, 'consumer', 'Component.tsx'), 'utf8')).toBe(
      'owned by consumer'
    );
  });

  it('retains immutable output across entry deletion, recovers, and settles on cancellation', async () => {
    const cwd = await fixture();
    const watching = watchInvocation(cwd);
    try {
      await expect.poll(() => watching.events.find((event) => event.ok)?.result).toBeDefined();
      const initial = watching.events.find((event) => event.ok)!;
      const bytes = await readFile(path.join(initial.result!.directory, 'Component.tsx'), 'utf8');
      await rm(path.join(cwd, 'entry.proto.ts'));
      await expect
        .poll(() => watching.events.find((event) => !event.ok && event.lastSuccessful))
        .toMatchObject({
          lastSuccessful: { revision: initial.revision, directory: initial.result!.directory },
        });
      await writeFile(path.join(cwd, 'entry.proto.ts'), source.replace('cli-fixture', 'recovered'));
      await expect.poll(() => watching.events.filter((event) => event.ok).length).toBe(2);
      const recovered = watching.events.filter((event) => event.ok)[1];
      expect(recovered.result!.directory).not.toBe(initial.result!.directory);
      expect(await readFile(path.join(initial.result!.directory, 'Component.tsx'), 'utf8')).toBe(
        bytes
      );
      const manifest = JSON.parse(
        await readFile(path.join(recovered.result!.directory, 'provenance.json'), 'utf8')
      );
      expect(manifest.source).toMatchObject({ file: 'entry.proto.ts' });
    } finally {
      watching.cancellation.abort();
      expect(await watching.finished).toBe(0);
    }
  });

  it('propagates config rename/parse failures and reloads the selected entry before a new success', async () => {
    const cwd = await fixture();
    await writeFile(path.join(cwd, 'selected.proto.ts'), source.replace('cli-fixture', 'selected'));
    const config = path.join(cwd, 'compiler.json');
    await writeFile(
      config,
      JSON.stringify({ entry: 'entry.proto.ts', output: 'versions', json: true })
    );
    const watching = watchInvocation(cwd, ['watch', '--config', 'compiler.json']);
    try {
      await expect.poll(() => watching.events.find((event) => event.ok)).toBeDefined();
      const initial = watching.events.find((event) => event.ok)!;
      await rename(config, path.join(cwd, 'saved.json'));
      await expect
        .poll(() => watching.events.find((event) => !event.ok))
        .toMatchObject({
          lastSuccessful: { directory: initial.result!.directory },
          diagnostics: [{ category: 'invalid-input' }],
        });
      await writeFile(config, '{');
      await expect
        .poll(() => watching.events.filter((event) => !event.ok).length)
        .toBeGreaterThanOrEqual(2);
      expect(watching.events.filter((event) => event.ok)).toHaveLength(1);
      await writeFile(
        config,
        JSON.stringify({ entry: 'selected.proto.ts', output: 'versions', json: true })
      );
      await expect.poll(() => watching.events.filter((event) => event.ok).length).toBe(2);
      const delivered = watching.events.filter((event) => event.ok)[1];
      const manifest = JSON.parse(
        await readFile(path.join(delivered.result!.directory, 'provenance.json'), 'utf8')
      );
      expect(manifest.source.file).toBe('selected.proto.ts');
    } finally {
      watching.cancellation.abort();
      expect(await watching.finished).toBe(0);
    }
  });

  it('terminates watch on publication conflict without replacing consumer-owned paths', async () => {
    const cwd = await fixture();
    await writeFile(path.join(cwd, 'versions'), 'consumer file');
    const watching = watchInvocation(cwd);
    try {
      await expect.poll(() => watching.events.find((event) => !event.ok)).toBeDefined();
      expect(await watching.finished).toBe(1);
      expect(await readFile(path.join(cwd, 'versions'), 'utf8')).toBe('consumer file');
      expect(watching.events.some((event) => event.ok)).toBe(false);
    } finally {
      watching.cancellation.abort();
      await watching.finished;
    }
  });
});
