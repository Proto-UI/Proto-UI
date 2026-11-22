// Read-only preparation. Does not call apply, create a permission receipt or mutate GitHub.
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertTarget, sourceIdentity, workflowContext, newDirectory, save,
  readViewer, readGitHub, targetEndpoint, runCaptured, requireSuccessful,
  ghEnvironment, readJson, WRITE_PERMISSIONS,
} from './common.mjs';

const [rootArg, outputArg, sourceSha, kind, numberArg, expectedDispatchActor] = process.argv.slice(2);
const root = resolve(rootArg);
const output = resolve(outputArg);
const number = Number(numberArg);
assertTarget(kind, number);
newDirectory(output);
let source = null;
let context = null;
let viewer = null;
try {
  source = sourceIdentity(root, sourceSha);
  context = workflowContext(expectedDispatchActor);
  save(resolve(output, 'invocation.json'), { source, context, target: { kind, number }, readOnly: true });
  viewer = readViewer(root, output);
  save(resolve(output, 'observed-viewer.json'), viewer);
  // Collect the actual target even if the observed actor lacks write permission.
  const target = readGitHub(root, output, 'target-http', targetEndpoint(kind, number));
  assert.equal(target.number, number);
  if (kind === 'pull-request') assert.equal(target.head?.sha, sourceSha, 'Live PR head differs from candidate');
  const helper = resolve(dirname(fileURLToPath(import.meta.url)), 'helpers/collect-readonly.mjs');
  const collected = runCaptured(process.execPath,
    [helper, root, kind, String(number), resolve(output, 'snapshot')],
    { root, directory: output, label: 'canonical-collector', env: ghEnvironment() });
  requireSuccessful(collected, 'Original read-only collector');
  const snapshot = readJson(resolve(output, 'snapshot/snapshot.json'));
  assert.equal(snapshot.viewer.data.viewer.login, viewer.actor);
  assert.equal(snapshot.viewer.data.repository.viewerPermission, viewer.permission);
  const result = {
    kind: 'sprint1.collaboration-carrier-preflight', source, context, viewer,
    target: { kind, number, updatedAt: snapshot.target.updated_at },
    canonicalReviewInputDigest: snapshot.reviewInputDigest,
    originalCollectorComplete: true,
    ordinaryWritePermissionObserved: WRITE_PERMISSIONS.includes(viewer.permission),
    mutationAttempted: false,
    boundary: 'Collection is not semantic acceptance, root approval, an independent review, or a successful permission test for a future mutation.',
  };
  save(resolve(output, 'preflight.json'), result);
  assert(result.ordinaryWritePermissionObserved,
    'The existing ordinary collaboration gate requires WRITE/MAINTAIN/ADMIN; actual lower permission retained without upgrade');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  save(resolve(output, 'collector-error.json'), {
    kind: 'sprint1.collaboration-carrier-collection-error',
    source, context, viewer, target: { kind, number }, mutationAttempted: false,
    error: { name: error.name, message: error.message },
    boundary: 'This is an execution/collection error, not a fabricated ordinary CLI receipt. No fallback or retry.',
  });
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
}
