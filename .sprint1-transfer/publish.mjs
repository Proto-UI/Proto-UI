// One exact-ref source transfer. No package installation or candidate code
// executes with this job's write token. Original Git objects stay unchanged.
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  TOOL_ROOT, REMOTE, decodeBundle, exactLeasePushArguments, git, loadManifest,
  permittedRemoteState, runtimeOrigin, sha256, verifyCarrier, writeJson,
} from './common.mjs';

const output = path.join(process.env.RUNNER_TEMP, 'sprint1-transfer-publication');
mkdirSync(output, { recursive: true });
const receiptFile = path.join(output, 'publication.json');
const logFile = path.join(output, 'git.log');
const receipt = { schemaVersion: 1, startedAt: new Date().toISOString(), mutationAttempted: false,
  published: false, stages: [], authority: 'Current-user Sprint1 source transfer only; no merge or metadata writes.' };
let secret = process.env.GH_TOKEN ?? '';
const encodedSecret = Buffer.from(`x-access-token:${secret}`).toString('base64');
const clean = (value) => {
  let text = String(value);
  for (const token of [secret, encodedSecret]) if (token) text = text.replaceAll(token, '[REDACTED]');
  return text;
};
const record = () => writeJson(receiptFile, receipt);
const stage = (name) => { receipt.stages.push({ name, at: new Date().toISOString() }); record(); };
try {
  const manifest = loadManifest();
  receipt.origin = runtimeOrigin(manifest);
  receipt.expected = { publicHead: manifest.expectedPublicHead, target: manifest.target,
    targetRef: manifest.targetRef, bundle: manifest.bundle };
  const carrier = path.resolve(TOOL_ROOT, '..');
  verifyCarrier(carrier, manifest, receipt.origin);
  assert.ok(secret.length > 0, 'Missing existing GITHUB_TOKEN');
  const authEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0', GIT_TRACE: '0', GIT_TRACE_PACKET: '0',
    GIT_TRACE_CURL: '0', GIT_CURL_VERBOSE: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${encodedSecret}`,
  };
  const runGit = (args, network = false) => {
    appendFileSync(logFile, `git ${args.join(' ')}\n`);
    try {
      const value = git(carrier, args, network ? { env: authEnv } : {});
      if (value) appendFileSync(logFile, clean(value) + '\n');
      return value;
    } catch (error) {
      const detail = clean(`${error.message}\n${error.stderr ?? ''}\n${error.stdout ?? ''}`);
      appendFileSync(logFile, detail + '\n');
      throw new Error(detail);
    }
  };
  stage('verify-bundle');
  const bundle = decodeBundle(readFileSync(path.join(TOOL_ROOT, manifest.bundle.file), 'utf8'), manifest.bundle);
  const bundleFile = path.join(output, 'candidate.bundle');
  writeFileSync(bundleFile, bundle, { flag: 'wx' });
  writeJson(path.join(output, 'manifest.json'), manifest);
  const heads = runGit(['bundle', 'list-heads', bundleFile]);
  assert.equal(heads, `${manifest.target.sha} HEAD`);
  runGit(['bundle', 'verify', bundleFile]);
  runGit(['fetch', '--no-tags', '--no-write-fetch-head', bundleFile, 'HEAD:refs/sprint1-transfer/candidate']);
  assert.equal(runGit(['rev-parse', 'refs/sprint1-transfer/candidate']), manifest.target.sha);
  assert.equal(runGit(['rev-parse', `${manifest.target.sha}^{tree}`]), manifest.target.tree);
  const listing = git(carrier, ['ls-tree', '-rz', '--full-tree', manifest.target.sha], { encoding: null });
  assert.equal(sha256(listing), manifest.target.treeListingSha256);
  runGit(['merge-base', '--is-ancestor', manifest.expectedPublicHead, manifest.target.sha]);
  const commits = runGit(['rev-list', '--reverse', `${manifest.expectedPublicHead}..${manifest.target.sha}`]).split('\n');
  assert.deepEqual(commits, manifest.commits.map((entry) => entry.sha));
  for (const entry of manifest.commits) {
    const object = git(carrier, ['cat-file', 'commit', entry.sha], { encoding: null });
    assert.equal(sha256(object), entry.rawSha256, `Original commit object mismatch: ${entry.sha}`);
  }
  runGit(['fsck', '--strict', '--no-dangling', manifest.target.sha]);
  receipt.objectsVerified = true;
  const remoteHead = () => {
    const response = runGit(['ls-remote', '--refs', REMOTE, manifest.targetRef], true);
    const parts = response.split(/\s+/);
    assert.equal(parts.length, 2, 'Exactly one existing public branch is required');
    assert.equal(parts[1], manifest.targetRef);
    assert.match(parts[0], /^[a-f0-9]{40}$/);
    return parts[0];
  };
  stage('read-public-head');
  receipt.remoteBefore = remoteHead();
  receipt.remoteState = permittedRemoteState(receipt.remoteBefore, manifest);
  if (receipt.remoteState === 'expected-base') {
    stage('fast-forward-with-exact-lease');
    receipt.mutationAttempted = true;
    record();
    try {
      runGit(exactLeasePushArguments(manifest), true);
    } catch (error) {
      receipt.pushError = clean(error.message);
      // Reconcile once, without retrying the write or changing credentials.
      try { receipt.remoteAfterRejectedOrUnknownWrite = remoteHead(); }
      catch (readError) { receipt.readbackError = clean(readError.message); }
      record();
      throw error;
    }
  }
  stage('readback');
  receipt.remoteAfter = remoteHead();
  assert.equal(receipt.remoteAfter, manifest.target.sha, 'Publication readback mismatch');
  receipt.published = true;
  receipt.outcome = receipt.mutationAttempted ? 'published-original-objects-fast-forward' : 'already-target-readback';
  receipt.finishedAt = new Date().toISOString();
  record();
  appendFileSync(process.env.GITHUB_OUTPUT, `published-sha=${manifest.target.sha}\n`);
  console.log(JSON.stringify({ published: true, target: manifest.target.sha, ref: manifest.targetRef,
    workflowHead: receipt.origin.workflowHead, outcome: receipt.outcome }));
} catch (error) {
  receipt.finishedAt = new Date().toISOString();
  receipt.error = clean(error.stack ?? error);
  record();
  console.error(clean(error.message ?? error));
  process.exitCode = 1;
} finally {
  secret = '';
}
