// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createFixtureBinding,
  verifyFixtureBinding,
  readBoundFixtureFile,
  FIXTURE_ASSETS,
  FIXTURE_GENERATORS,
  sha256,
} from '../../../../experiments/material-initial-paint/artifact-binding.mjs';
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'pui-seed-binding-'));
  directories.push(directory);
  const repository = join(directory, 'repository'),
    bundle = join(directory, 'bundle');
  await mkdir(repository);
  await mkdir(bundle);
  for (const file of FIXTURE_GENERATORS) {
    const path = join(repository, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `fixture:${file}\n`);
  }
  for (const file of FIXTURE_ASSETS) await writeFile(join(bundle, file), `synthetic ${file}\n`);
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: repository,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init');
  git('add', '.');
  git(
    '-c',
    'user.name=Protocol fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'Initialize local protocol fixture'
  );
  const binding = await createFixtureBinding(repository, bundle, []);
  return { repository, bundle, binding, git };
}
describe('native fixture executed-byte binding (local synthetic files only)', () => {
  it('binds the actual repository identity, all executed assets and server generator sources', async () => {
    const f = await fixture(),
      files = await verifyFixtureBinding(f.binding, f.repository, f.bundle);
    expect(files.size).toBe(4);
    for (const file of FIXTURE_ASSETS)
      expect(sha256(await readBoundFixtureFile(f.bundle, file, files))).toBe(files.get(file));
  });
  it.each(FIXTURE_ASSETS)(
    'refuses changed %s even when metadata still says clean',
    async (file) => {
      const f = await fixture();
      await writeFile(join(f.bundle, file), 'substituted asset');
      await expect(verifyFixtureBinding(f.binding, f.repository, f.bundle)).rejects.toThrow(
        'bytes-mismatch'
      );
    }
  );
  it('checks each served response again after the initial verification', async () => {
    const f = await fixture(),
      files = await verifyFixtureBinding(f.binding, f.repository, f.bundle);
    await writeFile(join(f.bundle, 'app.js'), 'late mutation');
    await expect(readBoundFixtureFile(f.bundle, 'app.js', files)).rejects.toThrow('served-bytes');
    await expect(readBoundFixtureFile(f.bundle, 'unbound.js', files)).rejects.toThrow(
      'unbound-request'
    );
  });
  it('refuses changed HTML generator bytes after a source metadata head update', async () => {
    const f = await fixture(),
      file = 'experiments/material-initial-paint/render-page.mjs';
    await writeFile(join(f.repository, file), 'new generator');
    f.git('add', '.');
    f.git(
      '-c',
      'user.name=Protocol fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-m',
      'Change local fixture'
    );
    const forged = {
      ...f.binding,
      sourceSha: f.git('rev-parse', 'HEAD'),
      tree: f.git('rev-parse', 'HEAD^{tree}'),
    };
    await expect(verifyFixtureBinding(forged, f.repository, f.bundle)).rejects.toThrow(
      'bytes-mismatch'
    );
  });
  it('refuses removed generator, duplicate asset, uncommitted source and escaped paths', async () => {
    const f = await fixture();
    await expect(
      verifyFixtureBinding({ ...f.binding, sources: [] }, f.repository, f.bundle)
    ).rejects.toThrow('incomplete');
    await expect(
      verifyFixtureBinding(
        { ...f.binding, assets: [...f.binding.assets, f.binding.assets[0]] },
        f.repository,
        f.bundle
      )
    ).rejects.toThrow('incomplete');
    await expect(
      verifyFixtureBinding(
        {
          ...f.binding,
          sources: [...f.binding.sources, { file: '../escape', sha256: '0'.repeat(64) }],
        },
        f.repository,
        f.bundle
      )
    ).rejects.toThrow('path-invalid');
    await writeFile(join(f.repository, 'untracked.txt'), 'changed');
    await expect(verifyFixtureBinding(f.binding, f.repository, f.bundle)).rejects.toThrow(
      'current-source'
    );
  });
});
