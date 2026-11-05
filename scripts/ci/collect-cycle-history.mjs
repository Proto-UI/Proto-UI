// Scheduled regression-cycle history collector.
//
// The cycle-report receipt needs the COMPLETE scheduled history of the current
// branch since the policy activation instant. Reading the workflow's most
// recent runs without an event filter mixes pull-request and manual runs into
// the same window, so a hundred of them evict the scheduled runs that carry
// the green baseline. This collector therefore asks for the scheduled runs of
// the current branch alone and pages until the whole post-activation window is
// proven complete; a truncated, repeated or over-budget traversal fails
// closed instead of publishing a partial baseline.
//
// Output is the native API shape the cycle report already consumes:
//   { "workflow_runs": [ ...raw native run rows... ] }
// Every row is passed through unchanged, including its native run title.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HISTORY_EVENT = 'schedule';
export const DEFAULT_LIMITS = Object.freeze({
  perPage: 100,
  // One API request per page, so this bounds the request count too.
  maxRequests: 50,
  maxPages: 50,
  maxBytes: 32 * 1024 * 1024,
});

// Lazily acquires pages of scheduled history. Breaking out of the consumer
// closes this generator, so a page that is not needed is never requested.
function* historyPages({ fetchPage, branch, createdAfter, limits }) {
  let bytes = 0;
  let requests = 0;
  for (let page = 1; page <= limits.maxPages; page += 1) {
    requests += 1;
    if (requests > limits.maxRequests) {
      throw new Error(`scheduled history exceeded the ${limits.maxRequests} request budget`);
    }
    const body = fetchPage({
      page,
      perPage: limits.perPage,
      branch,
      createdAfter,
      event: HISTORY_EVENT,
    });
    bytes += Buffer.byteLength(body, 'utf8');
    if (bytes > limits.maxBytes) {
      throw new Error(`scheduled history exceeded the ${limits.maxBytes} byte budget`);
    }
    yield { page, body };
  }
}

function parsePage(body, page) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (cause) {
    throw new Error(`scheduled history page ${page} is not valid JSON`, { cause });
  }
  const total = parsed?.total_count;
  if (!Number.isInteger(total) || total < 0) {
    throw new Error(`scheduled history page ${page} has no usable total_count`);
  }
  const runs = parsed?.workflow_runs;
  if (!Array.isArray(runs)) {
    throw new Error(`scheduled history page ${page} has no workflow_runs array`);
  }
  return { total_count: total, workflow_runs: runs };
}

// Collects the complete post-activation scheduled history of one branch.
// `fetchPage` receives the native query fields and returns the raw response
// body, so byte accounting and pagination decisions stay in one place.
export function collectScheduledHistory({
  fetchPage,
  activationIso,
  branch,
  limits = DEFAULT_LIMITS,
}) {
  const activationMs = Date.parse(activationIso);
  if (!Number.isFinite(activationMs)) {
    throw new Error('a valid policy activation instant is required');
  }
  if (typeof branch !== 'string' || branch.length === 0) {
    throw new Error('a current-run branch is required');
  }
  // The source bound is the activation second, so the fetched window is never
  // narrower than the receipt's own `created_at >= activation` window; the
  // exact instant is applied again below.
  const createdAfter = new Date(Math.floor(activationMs / 1000) * 1000).toISOString();
  const rows = [];
  const seen = new Set();
  let expected = null;
  let complete = false;

  for (const { page, body } of historyPages({
    fetchPage,
    branch,
    createdAfter,
    limits,
  })) {
    const parsed = parsePage(body, page);
    if (expected === null) expected = parsed.total_count;
    else if (parsed.total_count !== expected) {
      throw new Error(
        `scheduled history total_count changed between pages (${expected} then ${parsed.total_count})`
      );
    }
    for (const row of parsed.workflow_runs) {
      if (typeof row?.id !== 'number') {
        throw new Error(`scheduled history page ${page} contains a run without an id`);
      }
      if (seen.has(row.id)) {
        throw new Error(`scheduled history page ${page} repeats run ${row.id}`);
      }
      if (row.event !== HISTORY_EVENT) {
        throw new Error(`scheduled history page ${page} contains a ${row.event} run`);
      }
      if (row.head_branch !== branch) {
        throw new Error(`scheduled history page ${page} contains a run from ${row.head_branch}`);
      }
      const createdMs = Date.parse(row.created_at ?? '');
      if (!Number.isFinite(createdMs)) {
        throw new Error(
          `scheduled history page ${page} contains a run without a usable created_at`
        );
      }
      seen.add(row.id);
      rows.push({ row, createdMs });
    }
    if (rows.length > expected) {
      throw new Error(
        `scheduled history count ${rows.length} exceeds native total_count ${expected}`
      );
    }
    // The window is complete: stop here and never request another page.
    if (rows.length === expected) {
      complete = true;
      break;
    }
    if (parsed.workflow_runs.length < limits.perPage) {
      throw new Error(`scheduled history ended after ${rows.length} of ${expected} runs`);
    }
  }
  if (!complete) {
    throw new Error('scheduled history exhausted its page budget before completing');
  }
  return {
    workflow_runs: rows
      .filter((entry) => entry.createdMs >= activationMs)
      .map((entry) => entry.row),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const currentRun = JSON.parse(readFileSync(args['current-run'], 'utf8'));
  const repo = args.repo;
  const workflow = args.workflow ?? 'ci.yml';
  const limits = { ...DEFAULT_LIMITS };
  const result = collectScheduledHistory({
    activationIso: args['policy-activated-at'],
    branch: currentRun.head_branch,
    limits,
    fetchPage: ({ page, perPage, branch, createdAfter, event }) => {
      const query = `event=${event}&branch=${encodeURIComponent(branch)}&created=%3E%3D${createdAfter}&per_page=${perPage}&page=${page}`;
      return execFileSync(
        'gh',
        ['api', `repos/${repo}/actions/workflows/${workflow}/runs?${query}`],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: limits.maxBytes,
        }
      );
    },
  });
  writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`);
}
