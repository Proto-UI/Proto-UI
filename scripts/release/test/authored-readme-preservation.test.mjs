import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packages = [
  ['cli', '## Authored hook state selectors'],
  ['runtime', '## Captured setup feedback'],
  ['modules/boundary', '## Current focus observation'],
  ['modules/context', '## Optional ancestor reads'],
  ['modules/feedback', '## Draft resident style motion'],
  ['modules/overlay', '## Focus-outside policy'],
];

test('release metadata keeps authored semantic sections byte-for-byte across repeated sync', () => {
  const root = mkdtempSync(join(tmpdir(), 'proto-authored-readme-'));
  const copy = (file) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(ROOT, file), join(root, file));
  };
  try {
    for (const file of ['sync-metadata.mjs', 'readme-metadata.mjs', 'lib.mjs', 'governance.mjs'])
      copy(`scripts/release/${file}`);
    copy('package.json');
    copy('VERSION');
    cpSync(join(ROOT, 'spec/versions'), join(root, 'spec/versions'), { recursive: true });
    symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
    for (const [directory, heading] of packages) {
      copy(`packages/${directory}/package.json`);
      copy(`packages/${directory}/README.md`);
      assert.ok(
        readFileSync(join(root, `packages/${directory}/README.md`), 'utf8').includes(heading)
      );
    }
    for (let pass = 0; pass < 2; pass++) {
      const result = spawnSync(process.execPath, ['scripts/release/sync-metadata.mjs'], {
        cwd: root,
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      for (const [directory] of packages)
        assert.deepEqual(
          readFileSync(join(root, `packages/${directory}/README.md`)),
          readFileSync(join(ROOT, `packages/${directory}/README.md`)),
          directory
        );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
