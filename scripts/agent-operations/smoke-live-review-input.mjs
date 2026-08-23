import process from 'node:process';
import { collectLiveReviewInput, summarizeLiveChecks } from './collect-live-review-input.mjs';

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
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        repositoryId,
        pullRequest,
        baseSha: live.input.baseSha,
        headSha: live.input.headSha,
        commits: live.input.commits.length,
        replies: live.input.replies.length,
        threads: live.input.threads.length,
        checks: live.input.checks.length,
        ciConclusion: summarizeLiveChecks(live.input.checks),
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
