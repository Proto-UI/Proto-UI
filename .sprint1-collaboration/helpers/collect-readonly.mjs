// Run only in the already authorized gh environment. All GitHub calls are reads.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [rootArg, kind, numberArg, outputArg] = process.argv.slice(2);
assert(rootArg && outputArg && ['pull-request', 'issue'].includes(kind),
  'Usage: node collect-readonly.mjs <repo-root> <pull-request|issue> <number> <new-output-dir>');
const root = resolve(rootArg);
const output = resolve(outputArg);
const number = Number(numberArg);
assert(Number.isSafeInteger(number) && number > 0);
const repositoryId = 'github.com:Proto-UI/Proto-UI';
const repo = 'Proto-UI/Proto-UI';
const gh = (...args) => JSON.parse(execFileSync('gh', args,
  { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const save = (name, value) => writeFileSync(resolve(output, name),
  JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
mkdirSync(output, { recursive: true });
const startedAt = new Date().toISOString();
let live = null;
let reviewInputDigest = null;
if (kind === 'pull-request') {
  const { collectLiveReviewInput } = await import(pathToFileURL(resolve(root,
    'scripts/agent-operations/collect-live-review-input.mjs')));
  const { computeReviewInputDigest } = await import(pathToFileURL(resolve(root,
    'scripts/agent-operations/review-runtime.mjs')));
  // Uses the repository's complete two-scan collector, never a made-up input.
  live = collectLiveReviewInput(repositoryId, number);
  reviewInputDigest = computeReviewInputDigest(live.input);
  save('review-input.json', live.input);
  save('review-input-digest.json', { reviewInputDigest });
}
const targetPath = `repos/${repo}/${kind === 'pull-request' ? 'pulls' : 'issues'}/${number}`;
const target = gh('api', targetPath);
const viewer = gh('api', 'graphql', '-f',
  'query=query { viewer { login } repository(owner:"Proto-UI",name:"Proto-UI") { viewerPermission } }');
assert(!viewer.errors?.length, 'viewer GraphQL errors');
const commentsPages = gh('api', '--paginate', '--slurp',
  `repos/${repo}/issues/${number}/comments?per_page=100`);
assert(Array.isArray(commentsPages) && commentsPages.every(Array.isArray),
  'comments pagination must return every page');
const lastTarget = gh('api', targetPath);
assert.deepEqual(lastTarget, target, 'target changed during collection; preserve output and recollect');
assert.equal(target.number, number);
assert.equal(target.html_url,
  `https://github.com/${repo}/${kind === 'pull-request' ? 'pull' : 'issues'}/${number}`);
if (kind === 'pull-request') {
  assert.equal(target.head.sha, live.input.headSha, 'head changed after canonical input');
  assert.equal(target.body ?? '', live.input.pullRequestBody, 'body changed after canonical input');
  assert.equal(target.draft, live.input.isDraft, 'draft state changed after canonical input');
  assert.equal(viewer.data.viewer.login, live.viewerLogin, 'viewer changed');
  assert.equal(viewer.data.repository.viewerPermission, live.viewerPermission, 'permission changed');
} else assert(!target.pull_request, 'Issue endpoint actually names a pull request');
save('snapshot.json', {
  kind: 'sprint1.collaboration-readonly-snapshot', repositoryId, startedAt,
  observedAt: new Date().toISOString(), targetKind: kind, number, target, viewer,
  commentsPages, reviewInputDigest,
  limits: ['Collected comments have not been semantically inspected by this helper.',
    'Stability reads are not an atomic snapshot or approval.'],
});
process.stdout.write(JSON.stringify({ output, targetKind: kind, number,
  headSha: target.head?.sha ?? null, updatedAt: target.updated_at, reviewInputDigest }) + '\n');
