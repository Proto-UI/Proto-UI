import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { buildReleaseWebsiteInventory } from '../release-website-inventory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { COMPONENT_REGISTRY } = await tsImport(
  '../../../packages/cli/src/registry/components.ts',
  import.meta.url
);

test('current public CLI registry targets are not described as absent in bilingual release guides', async () => {
  const inventory = await buildReleaseWebsiteInventory({ root });
  assert.deepEqual(inventory.errors, []);
  const stale = [];
  for (const row of inventory.rows) {
    // Read the actual public registry: workspace-source-only entries are not
    // add targets, even when getComponentEntry can find their source metadata.
    const targets = row.exports
      .map((entry) => `${row.library}-${entry.slice(2)}`)
      .filter((id) => COMPONENT_REGISTRY[id] && !COMPONENT_REGISTRY[id].sourceOnly);
    if (!targets.length) continue;
    const source = await readFile(path.join(root, row.source), 'utf8');
    const absent = /There is no public `proto-ui add` target\.|没有公开的 `proto-ui add` 目标/.exec(
      source
    );
    if (absent)
      stale.push({
        file: row.source,
        line: source.slice(0, absent.index).split('\n').length,
        targets,
      });
  }
  assert.equal(
    stale.length,
    0,
    `${stale.length} guide claims contradict the current public CLI registry; first rows: ${JSON.stringify(stale.slice(0, 8))}`
  );
});
