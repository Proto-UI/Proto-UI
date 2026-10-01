import { execFileSync } from 'node:child_process';

const repositoryId = 'github.com:Proto-UI/Proto-UI';
const repositoryName = 'Proto-UI/Proto-UI';
const baseRef = 'main';
const SHA = /^[a-f0-9]{40}$/;

function requireFact(condition, message) {
  if (!condition) throw new Error(message);
}

// Current GitHub facts can prove the PR actually merged into governed history.
// They cannot distinguish every single-parent rebase from a squash, or attest
// which caller produced a copied receipt. No method/producer credit is returned.
export function verifyLiveIntegrationFacts(receipt, baseline, { runner = execFileSync } = {}) {
  requireFact(receipt?.repositoryId === repositoryId, 'integration repository is not governed');
  requireFact(
    Number.isInteger(receipt.pullRequest) && receipt.pullRequest > 0,
    'invalid pull request'
  );
  for (const value of [baseline, receipt.headSha, receipt.liveHeadSha, receipt.mergeCommitSha]) {
    requireFact(SHA.test(value ?? ''), 'invalid integration commit identity');
  }
  requireFact(receipt.headSha === receipt.liveHeadSha, 'receipt head identities differ');
  const api = (suffix) => {
    const output = runner('gh', ['api', `repos/${repositoryName}/${suffix}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
    const value = JSON.parse(output);
    requireFact(
      value && typeof value === 'object' && !Array.isArray(value),
      'malformed GitHub response'
    );
    return value;
  };
  const pull = api(`pulls/${receipt.pullRequest}`);
  requireFact(
    pull.number === receipt.pullRequest &&
      pull.base?.repo?.full_name === repositoryName &&
      pull.base?.ref === baseRef,
    'live pull request repository, number or governed base differs'
  );
  requireFact(pull.merged === true && pull.state === 'closed', 'live pull request is not merged');
  requireFact(pull.head?.sha === receipt.headSha, 'live merged pull request head differs');
  requireFact(pull.merge_commit_sha === receipt.mergeCommitSha, 'live merge commit differs');
  requireFact(
    typeof pull.merged_at === 'string' &&
      Number.isFinite(Date.parse(pull.merged_at)) &&
      pull.merged_at === receipt.mergedAt,
    'live GitHub merge time differs or is unavailable'
  );
  const canonicalTime = new Date(pull.merged_at).toISOString();
  requireFact(
    pull.merged_at === canonicalTime || pull.merged_at === canonicalTime.replace('.000Z', 'Z'),
    'live GitHub merge time is not canonical UTC'
  );
  const commit = api(`git/commits/${receipt.mergeCommitSha}`);
  requireFact(commit.sha === receipt.mergeCommitSha, 'live commit identity differs');
  requireFact(
    Array.isArray(commit.parents) &&
      commit.parents.length === 1 &&
      SHA.test(commit.parents[0]?.sha ?? ''),
    'live merge result must have exactly one parent'
  );
  const parentSha = commit.parents[0].sha;
  const ref = api(`git/ref/heads/${baseRef}`);
  requireFact(
    ref.ref === `refs/heads/${baseRef}` &&
      ref.object?.type === 'commit' &&
      SHA.test(ref.object?.sha ?? ''),
    'live governed base reference is malformed'
  );
  const baseHeadSha = ref.object.sha;
  const requireAncestor = (ancestor, descendant, label) => {
    const compare = api(`compare/${ancestor}...${descendant}?per_page=1`);
    requireFact(
      ['ahead', 'identical'].includes(compare.status) &&
        compare.base_commit?.sha === ancestor &&
        compare.merge_base_commit?.sha === ancestor,
      `${label} is not confirmed by live governed history`
    );
  };
  requireAncestor(baseline, parentSha, 'reviewed baseline ancestry');
  requireAncestor(receipt.mergeCommitSha, baseHeadSha, 'merge commit ancestry on main');
  return {
    repositoryId,
    pullRequest: receipt.pullRequest,
    headSha: pull.head.sha,
    mergeCommitSha: commit.sha,
    mergedAt: pull.merged_at,
    baseRef,
    baseHeadSha,
    parentSha,
    actualMergeVerified: true,
    historicalMergeMethodVerified: false,
    receiptProducerVerified: false,
  };
}
