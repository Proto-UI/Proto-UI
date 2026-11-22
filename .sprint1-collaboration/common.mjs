// Scratch-only launcher support. This module has no GitHub mutation primitive.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const REPOSITORY = 'Proto-UI/Proto-UI';
export const ISSUE_NUMBERS = Object.freeze([
  1178, 848, 1488, 1098, 1453, 1156, 1457, 1673, 1100, 1093, 1092, 1090, 1088,
]);
export const WRITE_PERMISSIONS = Object.freeze(['WRITE', 'MAINTAIN', 'ADMIN']);
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function save(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
export function newDirectory(directory) {
  // An existing output is evidence, not a scratch area to overwrite.
  mkdirSync(directory, { recursive: false });
}
export function assertTarget(kind, number) {
  assert(Number.isSafeInteger(number), 'Target number must be an integer');
  assert(kind === 'pull-request' ? number === 1711 : kind === 'issue' && ISSUE_NUMBERS.includes(number),
    'Target is outside PR1711 and the thirteen original Sprint1 Issues');
}
export function targetEndpoint(kind, number) {
  assertTarget(kind, number);
  return `repos/${REPOSITORY}/${kind === 'pull-request' ? 'pulls' : 'issues'}/${number}`;
}
export function sourceIdentity(root, expectedHead) {
  assert(/^[a-f0-9]{40}$/.test(expectedHead), 'A full reviewed candidate SHA is required');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const head = git('rev-parse', 'HEAD');
  assert.equal(head, expectedHead, 'Checkout differs from the root-reviewed source');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Tracked source is dirty');
  return { headSha: head, treeSha: git('rev-parse', 'HEAD^{tree}'), trackedSourceClean: true };
}
export function workflowContext(expectedDispatchActor, { apply = false } = {}) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'This carrier is for the separately reviewed Actions job');
  assert.equal(process.env.GITHUB_REPOSITORY, REPOSITORY);
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Only an explicit manual dispatch is admitted');
  assert(process.env.PROTO_S1_CARRIER_REF?.startsWith('refs/heads/'), 'Bind the exact independently reviewed carrier ref');
  assert.equal(process.env.GITHUB_REF, process.env.PROTO_S1_CARRIER_REF, 'Actual carrier ref differs from the fixed launcher ref');
  if (process.env.GITHUB_WORKFLOW_SHA)
    assert.equal(process.env.GITHUB_WORKFLOW_SHA, process.env.GITHUB_SHA,
      'Workflow source SHA differs from the actual carrier SHA');
  assert(expectedDispatchActor && !expectedDispatchActor.includes('__FILL_'), 'Bind the actual dispatch account');
  assert.equal(process.env.GITHUB_ACTOR, expectedDispatchActor, 'Dispatch actor differs from operator binding');
  assert.equal(process.env.GITHUB_TRIGGERING_ACTOR, expectedDispatchActor, 'Triggering actor differs from operator binding');
  if (apply) assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Do not rerun a possibly attempted mutation');
  const event = readJson(process.env.GITHUB_EVENT_PATH);
  assert.equal(event.sender?.login, expectedDispatchActor, 'Event sender differs from operator binding');
  return {
    eventName: process.env.GITHUB_EVENT_NAME,
    githubActor: process.env.GITHUB_ACTOR,
    githubTriggeringActor: process.env.GITHUB_TRIGGERING_ACTOR,
    eventSenderLogin: event.sender.login,
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
    carrierRef: process.env.GITHUB_REF,
    expectedCarrierRef: process.env.PROTO_S1_CARRIER_REF,
    carrierSha: process.env.GITHUB_SHA,
    workflowSha: process.env.GITHUB_WORKFLOW_SHA ?? null,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    runUrl: `https://github.com/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    boundary: 'Dispatch metadata identifies the triggering account, not the API viewer or an independent reviewer.',
  };
}
export function ghEnvironment() {
  assert(process.env.GH_TOKEN, 'The job must provide only its existing GITHUB_TOKEN as GH_TOKEN');
  const env = { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' };
  // Do not record authenticated request headers or tokens via CLI debug output.
  delete env.GH_DEBUG;
  delete env.GH_ENTERPRISE_TOKEN;
  delete env.GITHUB_ENTERPRISE_TOKEN;
  return env;
}
export function runCaptured(command, args, { root, directory, label, env = process.env }) {
  const result = spawnSync(command, args, {
    cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  writeFileSync(resolve(directory, `${label}.stdout`), result.stdout ?? '', { flag: 'wx' });
  writeFileSync(resolve(directory, `${label}.stderr`), result.stderr ?? '', { flag: 'wx' });
  save(resolve(directory, `${label}.exit.json`), {
    command, args, status: result.status, signal: result.signal,
    error: result.error ? { name: result.error.name, message: result.error.message } : null,
  });
  return result;
}
export function requireSuccessful(result, label) {
  assert(result.status === 0 && result.signal === null && !result.error,
    `${label} failed; original stdout/stderr/exit retained; no fallback or retry`);
}
export function readGitHub(root, directory, label, endpoint, query = null) {
  assert(query === null || /^query\b/.test(query), 'Only literal read-only GraphQL queries are allowed here');
  assert(query ? endpoint === 'graphql' : endpoint.startsWith(`repos/${REPOSITORY}/`));
  const args = ['api', '--hostname', 'github.com', '--include'];
  if (query) args.push('graphql', '-f', `query=${query}`);
  else args.push('--method', 'GET', endpoint);
  const result = runCaptured('gh', args, { root, directory, label, env: ghEnvironment() });
  requireSuccessful(result, label);
  // Keep the exact response bytes above; parse without fabricating missing headers.
  const raw = result.stdout;
  const match = /^HTTP\/[\d.]+ ([1-5]\d\d)[^\r\n]*\r?\n/.exec(raw);
  assert(match, `${label}: original HTTP response status is unavailable`);
  const separator = /\r?\n\r?\n/.exec(raw);
  assert(separator, `${label}: original HTTP header/body separator is unavailable`);
  const status = Number(match[1]);
  assert(status >= 200 && status < 300, `${label}: HTTP${status}`);
  const value = JSON.parse(raw.slice(separator.index + separator[0].length));
  if (query && value.errors !== undefined)
    assert(Array.isArray(value.errors) && value.errors.length === 0, `${label}: GraphQL errors; raw response preserved`);
  return value;
}
export function readViewer(root, directory) {
  const raw = readGitHub(root, directory, 'viewer-http', 'graphql',
    'query Sprint1CarrierViewer { viewer { login id } repository(owner:"Proto-UI",name:"Proto-UI") { nameWithOwner viewerPermission } }');
  assert.equal(raw.data?.repository?.nameWithOwner, REPOSITORY, 'Repository identity unavailable');
  const actor = raw.data?.viewer?.login;
  const permission = raw.data?.repository?.viewerPermission;
  assert(typeof actor === 'string' && actor.length > 0, 'Actual authenticated API viewer unavailable');
  assert(typeof permission === 'string', 'Actual repository viewerPermission unavailable');
  return { actor, permission, viewerNodeId: raw.data.viewer.id,
    boundary: 'Raw live viewer is retained, including github-actions[bot] if returned. It is not replaced with a dispatch account.' };
}
