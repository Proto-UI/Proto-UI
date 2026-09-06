import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const contract = JSON.parse(
  await readFile(new URL('../contracts/dcbot-preview-handler-v1.json', import.meta.url), 'utf8')
);

test('pins the reviewed real dcbot preview handler contract', () => {
  assert.equal(contract.repository, 'Proto-UI/dcbot');
  assert.equal(contract.revision, '3f60a2b41832a0b02e64a0f4b8bf237355b59806');
  assert.deepEqual(contract.endpoint, {
    method: 'POST',
    path: '/api/preview/deployments',
    artifactContentType: 'application/gzip',
  });
  assert.deepEqual(contract.limits, {
    compressedBytes: 50 * 1024 * 1024,
    expandedBytes: 100 * 1024 * 1024,
    fileBytes: 25 * 1024 * 1024,
    files: 20_000,
  });
  assert.equal(contract.ready.requiresNonemptyDeploymentId, true);
  assert.deepEqual(contract.artifactHeaders, [
    'X-Poppy-Signature-256',
    'X-Poppy-Preview-PR',
    'X-Poppy-Preview-Head-SHA',
    'X-Poppy-Preview-Run-ID',
    'X-Poppy-Preview-Run-Attempt',
  ]);
});

test('matches the pinned dcbot source used by the real-handler CI test', async (t) => {
  const root = process.env.DCBOT_CONTRACT_ROOT;
  if (!root) {
    t.skip('DCBOT_CONTRACT_ROOT is provided by the preview security workflow');
    return;
  }
  for (const [relative, expected] of Object.entries(contract.sourceDigests)) {
    const bytes = await readFile(path.join(root, relative));
    assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, expected, relative);
  }

  const server = await readFile(path.join(root, 'internal/preview/server.go'), 'utf8');
  const store = await readFile(path.join(root, 'internal/preview/artifact_store.go'), 'utf8');
  assert.match(
    server,
    /mux\.HandleFunc\("POST \/api\/preview\/deployments", s\.ingestDeployment\)/
  );
  assert.match(server, /deployment\.Status == "ready" && deployment\.DeploymentID == ""/);
  assert.match(server, /deployment\.RunID != upload\.RunID/);
  assert.match(server, /validDigest\(mac\.Sum\(nil\), r\.Header\.Get\(IngestSignatureHeader\)\)/);
  assert.match(store, /maxArtifactCompressed = 50 << 20/);
  assert.match(store, /maxArtifactExpanded\s+= 100 << 20/);
  assert.match(store, /maxArtifactFile\s+= 25 << 20/);
  assert.match(store, /maxArtifactFiles\s+= 20_000/);
  assert.match(store, /preview artifact contains a link or special file/);
  assert.match(store, /preview artifact contains a reserved platform file/);
});
