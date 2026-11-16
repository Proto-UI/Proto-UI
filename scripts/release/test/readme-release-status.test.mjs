import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const marker = '<!-- proto-ui-release-status:start -->';
const oldStatus =
  '`0.2.0-rc.7` is published for reproducible prerelease trials. The stable `0.2.0` package is under review and is not installable until publication completes.';
const currentStatus =
  'Stable `0.2.0` publication is recorded in [V-PROTO-UI-0008](../../../spec/versions/V-PROTO-UI-0008.yaml). The example below follows the current workspace release train.';
const withoutNotice = (contents) =>
  contents.replace(
    /<!-- proto-ui-release-status:start -->\n[\s\S]*?<!-- proto-ui-release-status:end -->\n\n/g,
    ''
  );

test('metadata sync projects draft installation examples, retains authored prose and removes only its notice after activation', () => {
  const root = mkdtempSync(join(tmpdir(), 'proto-readme-release-status-'));
  const copy = (file) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(ROOT, file), join(root, file));
  };
  const run = () => {
    const result = spawnSync(process.execPath, ['scripts/release/sync-metadata.mjs'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    for (const file of ['sync-metadata.mjs', 'readme-metadata.mjs', 'lib.mjs', 'governance.mjs'])
      copy(`scripts/release/${file}`);
    copy('scripts/build/proto-source.mjs');
    copy('package.json');
    copy('VERSION');
    symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
    const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();
    const entityPath = join(root, 'spec/versions/V-FIXTURE.yaml');
    mkdirSync(dirname(entityPath), { recursive: true });
    const writeStatus = (status) =>
      writeFileSync(
        entityPath,
        JSON.stringify({
          type: 'version',
          status,
          release: { version },
        })
      );
    writeStatus('draft');
    for (const directory of ['core', 'modules/text-control']) {
      copy(`packages/${directory}/package.json`);
      copy(`packages/${directory}/README.md`);
    }
    const authoredPath = join(root, 'packages/modules/text-control/README.md');
    const authored = withoutNotice(readFileSync(authoredPath, 'utf8')).replace(
      currentStatus,
      oldStatus
    );
    assert.ok(authored.includes(oldStatus));
    writeFileSync(authoredPath, authored);
    const paths = [join(root, 'packages/core/README.md'), authoredPath];

    run();
    const first = paths.map((path) => readFileSync(path, 'utf8'));
    for (const contents of first) {
      assert.equal(contents.split(marker).length - 1, 1);
      assert.ok(contents.includes(`\`${version}\` has not been published`));
      assert.ok(contents.includes('example for use after publication'));
      assert.ok(contents.includes(`@${version}`));
    }
    assert.equal(withoutNotice(first[1]), authored.replace(oldStatus, currentStatus));
    run();
    assert.deepEqual(
      paths.map((path) => readFileSync(path, 'utf8')),
      first
    );

    // This fixture exercises the projection of an already-recorded status;
    // metadata synchronization itself never activates or publishes a release.
    writeStatus('active');
    run();
    assert.deepEqual(
      paths.map((path) => readFileSync(path, 'utf8')),
      first.map(withoutNotice)
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
