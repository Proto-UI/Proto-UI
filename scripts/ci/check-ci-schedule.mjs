// Workflow event and schedule inventory audit.
//
// Enforces the regression scheduling policy in source:
//   - no workflow may declare a `push` trigger;
//   - `.github/workflows/ci.yml` is the single regression-cycle owner, with
//     exactly the three daily slots 0:00/8:00/16:00 UTC;
//   - no other workflow may carry a regression-cycle schedule; existing
//     non-regression schedules are allowlisted;
//   - every workflow that can run without a pull-request event must not read
//     pull_request context without a fallback on the same expression;
//   - reusable/dispatchable lanes keep their declared triggers and
//     permissions.
//
// Run as `node scripts/ci/check-ci-schedule.mjs`. Exits non-zero on any
// violation; prints each violation with its file and detail. Pure config
// parse: it performs no network or runner work.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
export const WORKFLOW_DIR = '.github/workflows';
export const REGRESSION_OWNER = '.github/workflows/ci.yml';
export const REGRESSION_CRONS = Object.freeze(['0 0 * * *', '0 8 * * *', '0 16 * * *']);
// Scheduled lanes that existed before this policy and serve non-regression
// duties; a regression-cycle schedule must never be added to them.
export const LEGACY_SCHEDULE_OWNERS = Object.freeze({
  '.github/workflows/agent-operations-shadow.yml': 'hourly intake/reconciliation lane',
  '.github/workflows/release-cadence.yml': 'weekly release reminder lane',
});
// The only workflows allowed to trigger automatically on pull_request. They
// are genuinely lightweight platform checks: no browser, no docs/packages
// build, no full workspace install — bounded node runs plus at most a
// lockfile install for metadata assertions. Every heavier evidence lane
// either runs inside ci.yml's shared suite or stays manual/callable.
export const PR_ALLOWED = Object.freeze(
  new Set([
    'ci.yml',
    'compiler-isolated-static-smoke.yml',
    'compiler-wc-runner-preflight.yml',
    'effect-graph-model.yml',
    'intranet-preview-checks.yml',
    'shadcn-style-source.yml',
  ])
);
// Workflows whose main-head lane was removed from push and that stay callable
// for exact-ref orchestration or manual diagnosis.
export const REUSABLE_LANES = Object.freeze([
  '.github/workflows/effect-graph-model.yml',
  '.github/workflows/intranet-preview-checks.yml',
  '.github/workflows/material-source-specializer.yml',
  '.github/workflows/shadcn-style-source.yml',
]);
// The trusted CI evidence contract in
// internal/agent-operations/capability-policy.yaml binds these job names.
export const TRUSTED_CI_JOBS = Object.freeze([
  'lockstep-check',
  'public_package_plan',
  'type-check',
  'test',
  'release-scan',
]);
export const FORBIDDEN_TRIGGERS = Object.freeze(['push', 'merge_group', 'pull_request_target']);

export function collectViolations(dir = path.join(repoRoot, WORKFLOW_DIR)) {
  const violations = [];
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  for (const name of entries) {
    const file = path.join(WORKFLOW_DIR, name);
    const text = readFileSync(path.join(dir, name), 'utf8');
    const doc = parse(text);
    const on = doc?.on ?? {};
    const triggers = typeof on === 'object' && on !== null ? Object.keys(on) : [];

    for (const trigger of FORBIDDEN_TRIGGERS) {
      if (triggers.includes(trigger)) {
        violations.push({
          file,
          rule: 'forbidden-trigger',
          detail: `workflow declares banned '${trigger}' trigger`,
        });
      }
    }

    const crons = (on.schedule ?? [])
      .map((entry) => entry?.cron)
      .filter((cron) => typeof cron === 'string');
    if (file !== REGRESSION_OWNER && crons.length > 0 && !(file in LEGACY_SCHEDULE_OWNERS)) {
      violations.push({
        file,
        rule: 'duplicate-schedule',
        detail: `non-owner workflow declares schedule crons ${JSON.stringify(crons)}`,
      });
    }

    // Event-context safety: any workflow that can run without a pull_request
    // event must not read pull_request fields unguarded.
    const runsWithoutPr = triggers.some(
      (trigger) => trigger !== 'pull_request' && trigger !== 'issue_comment'
    );
    if (runsWithoutPr) {
      for (const [index, line] of text.split('\n').entries()) {
        if (!line.includes('github.event.pull_request.')) continue;
        const guarded =
          line.includes('||') || line.includes('&&') || line.includes('github.event_name');
        if (!guarded) {
          violations.push({
            file,
            rule: 'unguarded-pr-context',
            detail: `line ${index + 1}: ${line.trim()}`,
          });
        }
      }
    }

    // ci.yml intentionally keeps the default token scope at workflow level:
    // the token-escalation guard asserts its jobs carry no elevated grants.
    // Every other workflow must state explicit permissions.
    if (doc?.permissions === undefined && file !== REGRESSION_OWNER) {
      violations.push({
        file,
        rule: 'missing-permissions',
        detail: 'workflow does not declare explicit permissions',
      });
    }

    if ('pull_request' in on && !PR_ALLOWED.has(name)) {
      violations.push({
        file,
        rule: 'pull-request-not-allowed',
        detail:
          'automatic pull_request trigger is restricted to the lightweight platform-check allowlist; heavier lanes run inside ci.yml or stay manual/callable',
      });
    }
  }

  // The regression owner contract.
  const ownerText = readFileSync(path.join(dir, 'ci.yml'), 'utf8');
  const ownerDoc = parse(ownerText);
  const ownerOn = ownerDoc?.on ?? {};
  if (ownerDoc?.permissions !== undefined) {
    violations.push({
      file: REGRESSION_OWNER,
      rule: 'token-escalation',
      detail: 'ci.yml must not declare workflow-level permissions; scope grants stay per-job',
    });
  }
  if (
    ownerDoc?.jobs?.['cycle-report']?.permissions?.actions !== 'read' ||
    ownerDoc?.jobs?.['cycle-report']?.permissions?.contents !== 'read'
  ) {
    violations.push({
      file: REGRESSION_OWNER,
      rule: 'cycle-report-permissions',
      detail: 'cycle-report must declare job-level { contents: read, actions: read }',
    });
  }
  const ownerCrons = (ownerOn.schedule ?? []).map((entry) => entry?.cron);
  if (JSON.stringify(ownerCrons) !== JSON.stringify([...REGRESSION_CRONS])) {
    violations.push({
      file: REGRESSION_OWNER,
      rule: 'regression-slots',
      detail: `ci.yml schedule must be exactly ${REGRESSION_CRONS.join(', ')}, got ${JSON.stringify(ownerCrons)}`,
    });
  }
  if (!('workflow_dispatch' in ownerOn) || !('pull_request' in ownerOn)) {
    violations.push({
      file: REGRESSION_OWNER,
      rule: 'regression-owner-triggers',
      detail: 'ci.yml must keep pull_request and workflow_dispatch triggers',
    });
  }
  const metadataJobs = new Set([
    'ci-config-audit',
    'lockstep-check',
    'public_package_plan',
    'test-plan',
  ]);
  const cycleOnly = "github.event_name != 'pull_request'";
  for (const [job, config] of Object.entries(ownerDoc.jobs ?? {})) {
    if (metadataJobs.has(job)) continue;
    const condition = String(config.if ?? '')
      .replace(/^\$\{\{\s*|\s*\}\}$/g, '')
      .trim();
    if (
      ![
        cycleOnly,
        `always() && ${cycleOnly}`,
        `${cycleOnly} && needs.public_package_plan.outputs.affected_count != '0'`,
      ].includes(condition)
    ) {
      violations.push({
        file: REGRESSION_OWNER,
        rule: 'heavy-pr-fanout',
        detail: `job '${job}' must run only on scheduled or explicitly dispatched cycles`,
      });
    }
  }
  for (const job of TRUSTED_CI_JOBS) {
    if (!(ownerDoc?.jobs && Object.hasOwn(ownerDoc.jobs, job))) {
      violations.push({
        file: REGRESSION_OWNER,
        rule: 'trusted-check-missing',
        detail: `trusted CI job '${job}' is missing`,
      });
    }
  }
  if (!ownerText.includes('cancel-in-progress:')) {
    violations.push({
      file: REGRESSION_OWNER,
      rule: 'owned-cancellation',
      detail: 'ci.yml must declare an owned cancellation policy',
    });
  }

  for (const file of REUSABLE_LANES) {
    if (!entries.includes(path.basename(file))) continue;
    const doc = parse(readFileSync(path.join(dir, path.basename(file)), 'utf8'));
    const on = doc?.on ?? {};
    if (!('workflow_call' in on) || !('workflow_dispatch' in on)) {
      violations.push({
        file,
        rule: 'reusable-lane',
        detail: 'former push lane must stay reusable via workflow_call and workflow_dispatch',
      });
    }
  }

  return violations;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = collectViolations();
  if (violations.length > 0) {
    console.error('[ci-schedule] workflow scheduling policy violations:');
    for (const violation of violations) {
      console.error(`  ${violation.file} [${violation.rule}] ${violation.detail}`);
    }
    process.exit(1);
  }
  console.log(
    '[ci-schedule] OK: no push triggers, single 3-slot regression owner, guarded event contexts'
  );
}
