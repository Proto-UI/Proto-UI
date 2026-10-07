// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import { renderShadowStyleDelivery } from '../src/services/shadow-style-delivery';
import { SHADCN_STYLE_TOKENS } from '../src/generated/shadcn-style-tokens';
import { BRUTALIST_STYLE_TOKENS } from '../src/generated/brutalist-style-tokens';

const cliDir = fileURLToPath(new URL('..', import.meta.url));
const bin = path.join(cliDir, 'bin/proto-ui.js');
const directories: string[] = [];
beforeAll(() => {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: cliDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
}, 120_000);
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});
async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pui-shadow-command-'));
  directories.push(dir);
  await fs.writeFile(path.join(dir, 'package.json'), '{"type":"module","private":true}');
  await fs.mkdir(path.join(dir, 'input'));
  await fs.writeFile(
    path.join(dir, 'input/example.ts'),
    `const styles = tw('inline-flex p-2 bg-primary');`
  );
  return dir;
}
function run(dir: string, args: string[]) {
  return spawnSync(process.execPath, [bin, ...args], { cwd: dir, encoding: 'utf8' });
}
function snapshotKey(
  dir: string,
  file: string,
  paths: Pick<typeof path, 'relative' | 'sep'> = path
) {
  return paths.relative(dir, file).split(paths.sep).join('/');
}
async function snapshot(dir: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(root: string) {
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      const file = path.join(root, entry.name);
      if (entry.isDirectory()) await visit(file);
      else result[snapshotKey(dir, file)] = await fs.readFile(file, 'utf8');
    }
  }
  await visit(dir);
  return result;
}

describe('F1 public CLI companion delivery', () => {
  it.each([
    ['POSIX', path.posix, '/fixture'],
    ['Windows', path.win32, 'C:\\fixture'],
  ] as const)('uses slash-delimited snapshot keys for %s paths', (_name, paths, dir) => {
    for (const key of ['styles/custom.css', 'companions/shadow.js', 'src/styles/entry.css']) {
      expect(snapshotKey(dir, paths.join(dir, ...key.split('/')), paths)).toBe(key);
    }
  });

  it.each([
    ['shadcn', SHADCN_STYLE_TOKENS],
    ['brutalist', BRUTALIST_STYLE_TOKENS],
  ] as const)(
    'delivers and regenerates the complete %s preset, preserving omitted CSS',
    async (preset, tokens) => {
      const dir = await fixture();
      const args = [
        preset,
        '--styles-dir',
        'styles',
        '--tokens-file',
        'custom.css',
        '--theme-file',
        'theme.css',
        '--style-file',
        'entry.css',
      ];
      expect(run(dir, args).status).toBe(0);
      const omitted = await snapshot(dir);
      expect(Object.keys(omitted).filter((file) => file.startsWith('styles/'))).toHaveLength(3);
      const opted = run(dir, [...args, '--shadow-out', 'companions/shadow.js']);
      expect(opted.stderr).toBe('');
      expect(opted.status).toBe(0);
      const after = await snapshot(dir);
      for (const [file, bytes] of Object.entries(omitted)) expect(after[file]).toBe(bytes);
      const expected = renderShadowStyleDelivery(tokens, 'protoShadowStyleArtifact');
      expect(after['styles/custom.css']).toBe(expected.documentCss);
      expect(after['companions/shadow.js']).toBe(expected.shadowModule);
      expect(after['companions/shadow.d.ts']).toBe(expected.shadowDeclaration);
      const probe = `import * as output from ${JSON.stringify(pathToFileURL(path.join(dir, 'companions/shadow.js')).href)}; if (Object.keys(output).join() !== 'protoShadowStyleArtifact' || !Object.isFrozen(output.protoShadowStyleArtifact)) throw Error('ABI'); console.log(output.protoShadowStyleArtifact.version);`;
      expect(
        execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
          encoding: 'utf8',
        }).trim()
      ).toBe('1');
      for (const file of ['styles/custom.css', 'companions/shadow.js', 'companions/shadow.d.ts'])
        await fs.writeFile(path.join(dir, file), 'stale');
      expect(run(dir, [...args, '--shadow-out=companions/shadow.js']).status).toBe(0);
      expect(await snapshot(dir)).toEqual(after);
    }
  );

  it('scans once for paired outputs and updates both when source tokens change', async () => {
    const dir = await fixture();
    const args = ['tokens', '--input', 'input', '--out', 'tokens.css', '--shadow-out', 'shadow.js'];
    expect(run(dir, args).status).toBe(0);
    const first = await snapshot(dir);
    await fs.writeFile(
      path.join(dir, 'input/example.ts'),
      `const styles = tw('p-4 dark:bg-primary');`
    );
    expect(run(dir, args).status).toBe(0);
    const after = await snapshot(dir);
    const sourceTokens = ['dark:bg-primary', 'p-4'];
    const expected = renderShadowStyleDelivery(sourceTokens, 'protoShadowStyleArtifact', {
      rootTokens: sourceTokens,
      templateTokens: sourceTokens,
    });
    expect(after['tokens.css']).toBe(expected.documentCss);
    expect(after['shadow.js']).toBe(expected.shadowModule);
    expect(after['tokens.css']).not.toBe(first['tokens.css']);
    expect(after['shadow.js']).not.toBe(first['shadow.js']);
    expect(run(dir, args).status).toBe(0);
    expect(await snapshot(dir)).toEqual(after);
  });

  it.each([
    ['--shadow-out'],
    ['--shadow-out='],
    ['--shadow-out', '--input', 'input'],
    ['--shadow-out', ''],
    ['--shadow-out', 'artifact.mjs'],
    ['--shadow-out', '.js'],
    ['--shadow-out', 'a.js', '--shadow-out', 'b.js'],
    ['--shadow-out', 'tokens.css'],
    ['--shadow-out', 'shadow.js', '--out', 'shadow.js'],
    ['--shadow-out', 'shadow.js', '--out', 'shadow.d.ts'],
  ])('rejects invalid output options without altering existing files: %j', async (...flags) => {
    const dir = await fixture();
    await fs.writeFile(path.join(dir, 'tokens.css'), 'old css');
    const before = await snapshot(dir);
    const result = run(dir, ['tokens', '--input', 'input', '--out', 'tokens.css', ...flags]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/shadow-out|Conflicting/);
    expect(await snapshot(dir)).toEqual(before);
  });

  it.each(['--tokens-file', '--theme-file', '--style-file'])(
    'checks preset %s collisions before writing any file',
    async (option) => {
      const dir = await fixture();
      expect(run(dir, ['shadcn', '--styles-dir', 'styles']).status).toBe(0);
      const before = await snapshot(dir);
      const result = run(dir, [
        'shadcn',
        '--styles-dir',
        'styles',
        option,
        'shadow.js',
        '--shadow-out',
        'styles/shadow.js',
      ]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Conflicting');
      expect(await snapshot(dir)).toEqual(before);
    }
  );

  it('keeps a previous generation intact when the next source cannot generate a verified recipe', async () => {
    const dir = await fixture();
    const args = ['tokens', '--input', 'input', '--out', 'tokens.css', '--shadow-out', 'shadow.js'];
    expect(run(dir, args).status).toBe(0);
    await fs.writeFile(path.join(dir, 'input/example.ts'), `const styles = tw('p-[10%]');`);
    const before = await snapshot(dir);
    const result = run(dir, args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('verified length recipe');
    expect(await snapshot(dir)).toEqual(before);
  });

  it('does not implicitly generate companions from init/add, and rejects unsupported explicit use', async () => {
    const dir = await fixture();
    expect(run(dir, ['init', '--no-interactive']).status).toBe(0);
    expect(run(dir, ['add', 'wc', 'shadcn-button', '--no-install']).status).toBe(0);
    const before = await snapshot(dir);
    expect(Object.keys(before).filter((file) => file.startsWith('src/styles/'))).toHaveLength(3);
    expect(before['proto-ui/components/wc/index.ts']).not.toContain('shadow:');
    for (const command of ['init', 'add', 'theme', 'style']) {
      const result = run(dir, [command, '--shadow-out', 'shadow.js', '--no-interactive']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('supported only');
    }
    expect(await snapshot(dir)).toEqual(before);
  });
});
