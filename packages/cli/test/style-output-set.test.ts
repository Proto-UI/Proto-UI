// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { validateStyleOutputPaths, writeStyleOutputSet } from '../src/services/style-output-set';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});
async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pui-output-set-'));
  directories.push(dir);
  const files = ['tokens.css', 'shadow.js', 'shadow.d.ts', 'theme.css', 'entry.css'].map((name) =>
    path.join(dir, name)
  );
  for (const file of [files[0], ...files.slice(2)])
    await fs.writeFile(file, `old:${path.basename(file)}`);
  return {
    dir,
    files,
    outputs: files.map((file) => ({ path: file, content: `new:${path.basename(file)}` })),
  };
}
async function expectRestored(files: string[], dir: string) {
  await expect(fs.stat(files[1])).rejects.toMatchObject({ code: 'ENOENT' });
  for (const file of [files[0], ...files.slice(2)]) {
    await expect(fs.readFile(file, 'utf8')).resolves.toBe(`old:${path.basename(file)}`);
  }
  expect((await fs.readdir(dir)).filter((name) => name.startsWith('.pui-style-'))).toEqual([]);
}

describe('style output set preflight and caught-failure recovery', () => {
  it('replaces the full set, preserves permissions and regenerates without staging residue', async () => {
    const { dir, files, outputs } = await fixture();
    await fs.chmod(files[0], 0o640);
    const initialMode = (await fs.stat(files[0])).mode & 0o777;
    if (process.platform !== 'win32') expect(initialMode).toBe(0o640);
    for (let replacement = 0; replacement < 2; replacement++) {
      await writeStyleOutputSet(outputs);
      for (const output of outputs)
        await expect(fs.readFile(output.path, 'utf8')).resolves.toBe(output.content);
      const mode = (await fs.stat(files[0])).mode & 0o777;
      expect(mode).toBe(initialMode);
      if (process.platform !== 'win32') expect(mode).toBe(0o640);
      expect((await fs.readdir(dir)).sort()).toEqual(
        files.map((file) => path.basename(file)).sort()
      );
    }
  });

  it.each(['mkdir', 'mkdtemp', 'copyFile', 'writeFile', 'chmod', 'rename'] as const)(
    'recovers an injected late %s failure',
    async (operation) => {
      const { dir, files, outputs } = await fixture();
      let calls = 0;
      const io = {
        ...fs,
        [operation]: async (...args: unknown[]) => {
          if (++calls === 3) throw new Error(`injected ${operation}`);
          return (fs[operation] as (...args: unknown[]) => Promise<unknown>)(...args);
        },
      } as typeof fs;
      await expect(writeStyleOutputSet(outputs, io)).rejects.toThrow(`injected ${operation}`);
      await expectRestored(files, dir);
    }
  );

  it('restores theme CSS too when the final entry replacement fails', async () => {
    const { dir, files, outputs } = await fixture();
    let calls = 0;
    const io = {
      ...fs,
      rename: async (...args: Parameters<typeof fs.rename>) => {
        if (++calls === outputs.length) throw new Error('final replacement');
        return fs.rename(...args);
      },
    };
    await expect(writeStyleOutputSet(outputs, io)).rejects.toThrow('final replacement');
    await expectRestored(files, dir);
  });

  it('reports an unrecoverable new output while still restoring old outputs', async () => {
    const { dir, files, outputs } = await fixture();
    let calls = 0;
    const io = {
      ...fs,
      rename: async (...args: Parameters<typeof fs.rename>) => {
        if (++calls === 3) throw new Error('replacement failed');
        return fs.rename(...args);
      },
      unlink: async () => {
        throw new Error('unlink denied');
      },
    };
    await expect(writeStyleOutputSet(outputs, io)).rejects.toThrow(/recovery incomplete/);
    await expect(fs.readFile(files[0], 'utf8')).resolves.toBe('old:tokens.css');
    await expect(fs.readFile(files[1], 'utf8')).resolves.toBe('new:shadow.js');
    expect((await fs.readdir(dir)).some((name) => name.startsWith('.pui-style-'))).toBe(true);
  });

  it('retains old bytes and reports backup paths when rollback itself fails, while recovering other targets', async () => {
    const { dir, files, outputs } = await fixture();
    let calls = 0;
    const io = {
      ...fs,
      rename: async (
        from: Parameters<typeof fs.rename>[0],
        to: Parameters<typeof fs.rename>[1]
      ) => {
        calls++;
        if (calls === 3 || String(from).endsWith('previous')) throw new Error('rename unavailable');
        return fs.rename(from, to);
      },
    };
    await expect(writeStyleOutputSet(outputs, io)).rejects.toThrow(
      /recovery incomplete.*pui-style-/
    );
    await expect(fs.stat(files[1])).rejects.toMatchObject({ code: 'ENOENT' });
    const staging = (await fs.readdir(dir)).filter((name) => name.startsWith('.pui-style-'));
    const backups = await Promise.all(
      staging.map((name) => fs.readFile(path.join(dir, name, 'previous'), 'utf8').catch(() => ''))
    );
    expect(backups).toContain('old:tokens.css');
  });

  it('rejects normalized, case-folded, ancestor, symlink-directory alias and hard-link collisions before writes', async () => {
    const { dir, files } = await fixture();
    const nested = path.join(dir, 'new');
    await fs.symlink(dir, path.join(dir, 'alias'), 'dir');
    await fs.link(files[0], path.join(dir, 'hard.css'));
    for (const pair of [
      [files[0], path.join(dir, '.', 'tokens.css')],
      [files[0], path.join(dir, 'TOKENS.CSS')],
      [nested, path.join(nested, 'child.js')],
      [files[0], path.join(dir, 'alias', 'tokens.css')],
      [files[0], path.join(dir, 'hard.css')],
    ])
      await expect(validateStyleOutputPaths(pair)).rejects.toThrow(/Conflicting/);
    await expect(fs.stat(nested)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.readFile(files[0], 'utf8')).resolves.toBe('old:tokens.css');
  });

  it('rejects directories and file symlinks, including dangling links', async () => {
    const { dir, files } = await fixture();
    const links = [path.join(dir, 'linked.js'), path.join(dir, 'dangling.js')];
    await fs.symlink(files[0], links[0]);
    await fs.symlink(path.join(dir, 'absent'), links[1]);
    for (const file of [dir, ...links])
      await expect(validateStyleOutputPaths([file])).rejects.toThrow(/regular file/);
  });
});
