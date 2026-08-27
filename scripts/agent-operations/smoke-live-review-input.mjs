import process from 'node:process';
import { loadCapabilityPolicy } from './assessment-runtime.mjs';
import { collectLiveReviewInput, summarizeLiveChecks } from './collect-live-review-input.mjs';
import { reviewChangesSpecEntities } from './review-runtime.mjs';

function usage() {
  return 'Usage: node scripts/agent-operations/smoke-live-review-input.mjs -- <repositoryId> <pullRequest>';
}

try {
  const argv = process.argv.slice(2);
  if (argv[0] === '--') argv.shift();
  if (argv.length !== 2) throw new Error(usage());
  const [repositoryId, pullRequestRaw] = argv;
  const pullRequest = Number(pullRequestRaw);
  if (!Number.isInteger(pullRequest) || pullRequest < 1) throw new Error(usage());

  const live = collectLiveReviewInput(repositoryId, pullRequest);
  const policy = loadCapabilityPolicy(
    new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        repositoryId,
        pullRequest,
        schemaVersion: live.input.schemaVersion,
        pullRequestState: live.input.pullRequestState,
        isDraft: live.input.isDraft,
        baseRefName: live.input.baseRefName,
        baseSha: live.input.baseSha,
        headSha: live.input.headSha,
        mergeable: live.mergeable,
        mergeStateStatus: live.mergeStateStatus,
        changedFiles: live.input.changedFiles.length,
        changesSpecEntities: reviewChangesSpecEntities(live.input),
        commits: live.input.commits.length,
        reviews: live.input.reviews.length,
        comments: live.input.comments.length,
        replies: live.input.replies.length,
        threads: live.input.threads.length,
        checks: live.input.checks.length,
        ciConclusion: summarizeLiveChecks(live.input.checks, {
          repositoryId,
          trustedRepositoryId: policy.trustedCiEvidence?.repositoryId,
          trustedSource: policy.trustedCiEvidence?.source,
          trustedCheckNames: policy.trustedCiEvidence?.checkNames,
          trustedWorkflowNames: policy.trustedCiEvidence?.workflowNames,
          trustedWorkflowPaths: policy.trustedCiEvidence?.workflowPaths,
        }),
        viewerLogin: live.viewerLogin,
        viewerPermission: live.viewerPermission,
        authorLogin: live.authorLogin,
      },
      null,
      2
    )}\n`
  );
} catch (error) {
  process.stderr.write(`[agent:review:smoke] ${error.message}\n`);
  process.exitCode = 1;
}
