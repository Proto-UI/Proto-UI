import { createHash } from 'node:crypto';

export const POLICY_VERSION = '2026-08-20.phase-a';
export const ROUTES = [
  'needs-author',
  'needs-maintainer',
  'agent-eligible',
  'blocked',
  'observing',
  'no-action',
];
export const HUMAN_GATES = [
  'finding-disposition',
  'semantic',
  'integration',
  'scope',
  'contributor-rights',
  'security',
  'none',
];
export const PROPOSAL_ACTIONS = ['status-comment', 'state-label', 'maintainer-inbox'];

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const HTML_COMMENTS = /<!--[\s\S]*?-->/g;

export function sanitizeUntrustedText(value, maxCharacters = 4000) {
  const source = typeof value === 'string' ? value : '';
  const withoutComments = source.replace(HTML_COMMENTS, '[html-comment-removed]');
  const withoutControls = withoutComments.replace(CONTROL_CHARACTERS, '');
  const normalized = withoutControls.normalize('NFKC').trim();
  if (normalized.length <= maxCharacters) {
    return { text: normalized, truncated: false, originalCharacters: source.length };
  }
  return {
    text: `${normalized.slice(0, maxCharacters)}\n[truncated-by-agent-operations]`,
    truncated: true,
    originalCharacters: source.length,
  };
}

function strings(values) {
  return [...new Set((values ?? []).filter((value) => typeof value === 'string' && value))].sort();
}

function identity(login) {
  return typeof login === 'string' && login ? login : null;
}

export function normalizeIssue(issue, maxBodyCharacters = 4000) {
  const body = sanitizeUntrustedText(issue.body, maxBodyCharacters);
  return {
    kind: 'issue',
    number: issue.number,
    title: sanitizeUntrustedText(issue.title, 300).text,
    bodyExcerpt: body.text,
    bodyTruncated: body.truncated,
    originalBodyCharacters: body.originalCharacters,
    url: issue.html_url,
    author: identity(issue.user?.login),
    labels: strings(
      (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name))
    ),
    assignees: strings((issue.assignees ?? []).map((assignee) => assignee.login)),
    milestone: issue.milestone?.title ?? null,
    comments: Number.isInteger(issue.comments) ? issue.comments : 0,
    locked: issue.locked === true,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  };
}

export function normalizePullRequest(pullRequest, maxBodyCharacters = 4000) {
  const body = sanitizeUntrustedText(pullRequest.body, maxBodyCharacters);
  return {
    kind: 'pull-request',
    number: pullRequest.number,
    title: sanitizeUntrustedText(pullRequest.title, 300).text,
    bodyExcerpt: body.text,
    bodyTruncated: body.truncated,
    originalBodyCharacters: body.originalCharacters,
    url: pullRequest.html_url,
    author: identity(pullRequest.user?.login),
    labels: strings((pullRequest.labels ?? []).map((label) => label.name)),
    assignees: strings((pullRequest.assignees ?? []).map((assignee) => assignee.login)),
    requestedReviewers: strings(
      (pullRequest.requested_reviewers ?? []).map((reviewer) => reviewer.login)
    ),
    draft: pullRequest.draft === true,
    headSha: pullRequest.head?.sha ?? null,
    baseSha: pullRequest.base?.sha ?? null,
    createdAt: pullRequest.created_at,
    updatedAt: pullRequest.updated_at,
  };
}

export function buildSnapshot({
  repository,
  kind = 'both',
  limit = 50,
  issues = [],
  pullRequests = [],
  generatedAt = new Date().toISOString(),
  maxBodyCharacters = 4000,
}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) {
    throw new Error(`Invalid repository: ${repository}`);
  }
  if (!['issues', 'prs', 'both'].includes(kind)) {
    throw new Error(`Invalid kind: ${kind}`);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }

  const normalized = [];
  if (kind === 'issues' || kind === 'both') {
    normalized.push(
      ...issues
        .filter((issue) => !issue.pull_request)
        .map((issue) => normalizeIssue(issue, maxBodyCharacters))
    );
  }
  if (kind === 'prs' || kind === 'both') {
    normalized.push(
      ...pullRequests.map((pullRequest) => normalizePullRequest(pullRequest, maxBodyCharacters))
    );
  }

  const items = normalized
    .sort((left, right) => {
      const byUpdated = String(right.updatedAt).localeCompare(String(left.updatedAt));
      if (byUpdated !== 0) return byUpdated;
      const byKind = left.kind.localeCompare(right.kind);
      return byKind !== 0 ? byKind : right.number - left.number;
    })
    .slice(0, limit);
  const digest = createHash('sha256').update(JSON.stringify(items)).digest('hex');

  return {
    schemaVersion: 1,
    generatedAt,
    repository,
    source: 'github-rest',
    kind,
    limit,
    digest,
    itemCount: items.length,
    items,
  };
}

export function expectedRunId(snapshot) {
  const timestamp = String(snapshot.generatedAt)
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `AO-SHADOW-${timestamp}-${String(snapshot.digest).slice(0, 8)}`;
}

function add(errors, condition, path, message) {
  if (!condition) errors.push(`${path}: ${message}`);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(errors, value, path, allowed) {
  if (!object(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}: unexpected property ${key}`);
  }
}

function nonEmptyString(value, max = Infinity) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function validateStringArray(
  errors,
  value,
  path,
  { min = 0, max = Infinity, maxLength = 500 } = {}
) {
  add(errors, Array.isArray(value), path, 'must be an array');
  if (!Array.isArray(value)) return;
  add(errors, value.length >= min && value.length <= max, path, `must contain ${min}-${max} items`);
  value.forEach((item, index) =>
    add(
      errors,
      nonEmptyString(item, maxLength),
      `${path}[${index}]`,
      'must be a bounded non-empty string'
    )
  );
}

function validateDecisionPacket(errors, packet, path) {
  const keys = [
    'observedFact',
    'recommendation',
    'authorizationScope',
    'exclusions',
    'residualRisks',
    'nextAutomatedStage',
    'separatelyGatedActions',
  ];
  add(errors, object(packet), path, 'must be an object');
  if (!object(packet)) return;
  onlyKeys(errors, packet, path, keys);
  for (const key of ['observedFact', 'recommendation', 'authorizationScope']) {
    add(
      errors,
      nonEmptyString(packet[key], 1000),
      `${path}.${key}`,
      'must be a bounded non-empty string'
    );
  }
  add(
    errors,
    nonEmptyString(packet.nextAutomatedStage, 500),
    `${path}.nextAutomatedStage`,
    'must be a bounded non-empty string'
  );
  validateStringArray(errors, packet.exclusions, `${path}.exclusions`, { min: 1, max: 8 });
  validateStringArray(errors, packet.residualRisks, `${path}.residualRisks`, {
    min: 1,
    max: 8,
  });
  validateStringArray(errors, packet.separatelyGatedActions, `${path}.separatelyGatedActions`, {
    min: 1,
    max: 10,
  });
}

export function validateShadowReport(report, snapshot = null) {
  const errors = [];
  const rootKeys = [
    'schemaVersion',
    'policyVersion',
    'mode',
    'runId',
    'generatedAt',
    'snapshot',
    'summary',
    'items',
    'warnings',
    'writeOperationsPerformed',
  ];
  add(errors, object(report), '$', 'must be an object');
  if (!object(report)) return errors;
  onlyKeys(errors, report, '$', rootKeys);
  add(errors, report.schemaVersion === 1, '$.schemaVersion', 'must be 1');
  add(
    errors,
    report.policyVersion === POLICY_VERSION,
    '$.policyVersion',
    `must be ${POLICY_VERSION}`
  );
  add(errors, report.mode === 'shadow', '$.mode', 'must be shadow');
  add(
    errors,
    /^AO-SHADOW-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$/.test(report.runId ?? ''),
    '$.runId',
    'has an invalid format'
  );
  add(
    errors,
    !Number.isNaN(Date.parse(report.generatedAt)),
    '$.generatedAt',
    'must be an ISO date-time'
  );
  add(errors, report.writeOperationsPerformed === 0, '$.writeOperationsPerformed', 'must be zero');
  validateStringArray(errors, report.warnings, '$.warnings', { min: 0, max: 20 });

  add(errors, object(report.snapshot), '$.snapshot', 'must be an object');
  if (object(report.snapshot)) {
    onlyKeys(errors, report.snapshot, '$.snapshot', ['repository', 'digest', 'itemCount']);
    add(
      errors,
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(report.snapshot.repository ?? ''),
      '$.snapshot.repository',
      'is invalid'
    );
    add(
      errors,
      /^[0-9a-f]{64}$/.test(report.snapshot.digest ?? ''),
      '$.snapshot.digest',
      'is invalid'
    );
    add(
      errors,
      Number.isInteger(report.snapshot.itemCount) && report.snapshot.itemCount >= 0,
      '$.snapshot.itemCount',
      'must be a non-negative integer'
    );
  }

  add(errors, Array.isArray(report.items), '$.items', 'must be an array');
  const items = Array.isArray(report.items) ? report.items : [];
  add(errors, items.length <= 100, '$.items', 'must not exceed 100 items');
  const identities = new Set();
  const routeCounts = Object.fromEntries(ROUTES.map((route) => [route, 0]));
  let decisionsRequired = 0;

  items.forEach((item, index) => {
    const path = `$.items[${index}]`;
    const keys = [
      'kind',
      'number',
      'title',
      'recommendedRoute',
      'confidence',
      'rationale',
      'evidence',
      'humanGate',
      'decisionPacket',
      'proposedActions',
    ];
    add(errors, object(item), path, 'must be an object');
    if (!object(item)) return;
    onlyKeys(errors, item, path, keys);
    add(errors, ['issue', 'pull-request'].includes(item.kind), `${path}.kind`, 'is invalid');
    add(
      errors,
      Number.isInteger(item.number) && item.number > 0,
      `${path}.number`,
      'must be positive'
    );
    add(
      errors,
      nonEmptyString(item.title, 300),
      `${path}.title`,
      'must be a bounded non-empty string'
    );
    add(errors, ROUTES.includes(item.recommendedRoute), `${path}.recommendedRoute`, 'is invalid');
    if (ROUTES.includes(item.recommendedRoute)) routeCounts[item.recommendedRoute] += 1;
    add(
      errors,
      typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1,
      `${path}.confidence`,
      'must be between zero and one'
    );
    add(errors, nonEmptyString(item.rationale, 1000), `${path}.rationale`, 'must be bounded');
    validateStringArray(errors, item.evidence, `${path}.evidence`, { min: 1, max: 8 });
    add(errors, HUMAN_GATES.includes(item.humanGate), `${path}.humanGate`, 'is invalid');

    if (item.humanGate === 'none') {
      add(
        errors,
        item.decisionPacket === null,
        `${path}.decisionPacket`,
        'must be null without a gate'
      );
    } else if (HUMAN_GATES.includes(item.humanGate)) {
      decisionsRequired += 1;
      validateDecisionPacket(errors, item.decisionPacket, `${path}.decisionPacket`);
    }

    add(errors, Array.isArray(item.proposedActions), `${path}.proposedActions`, 'must be an array');
    if (Array.isArray(item.proposedActions)) {
      add(
        errors,
        item.proposedActions.length <= 5,
        `${path}.proposedActions`,
        'must not exceed five'
      );
      item.proposedActions.forEach((action, actionIndex) => {
        const actionPath = `${path}.proposedActions[${actionIndex}]`;
        add(errors, object(action), actionPath, 'must be an object');
        if (!object(action)) return;
        onlyKeys(errors, action, actionPath, ['type', 'value', 'rationale', 'execution']);
        add(errors, PROPOSAL_ACTIONS.includes(action.type), `${actionPath}.type`, 'is invalid');
        add(errors, nonEmptyString(action.value, 500), `${actionPath}.value`, 'must be bounded');
        add(
          errors,
          nonEmptyString(action.rationale, 500),
          `${actionPath}.rationale`,
          'must be bounded'
        );
        add(
          errors,
          action.execution === 'blocked-by-shadow-policy',
          `${actionPath}.execution`,
          'must remain blocked by shadow policy'
        );
      });
    }

    const key = `${item.kind}:${item.number}`;
    add(errors, !identities.has(key), path, `duplicates ${key}`);
    identities.add(key);
  });

  add(errors, object(report.summary), '$.summary', 'must be an object');
  if (object(report.summary)) {
    onlyKeys(errors, report.summary, '$.summary', [
      'analyzedCount',
      'decisionsRequired',
      'routeCounts',
    ]);
    add(
      errors,
      report.summary.analyzedCount === items.length,
      '$.summary.analyzedCount',
      'does not match items'
    );
    add(
      errors,
      report.summary.decisionsRequired === decisionsRequired,
      '$.summary.decisionsRequired',
      'does not match gated items'
    );
    add(errors, object(report.summary.routeCounts), '$.summary.routeCounts', 'must be an object');
    if (object(report.summary.routeCounts)) {
      onlyKeys(errors, report.summary.routeCounts, '$.summary.routeCounts', ROUTES);
      for (const route of ROUTES) {
        add(
          errors,
          report.summary.routeCounts[route] === routeCounts[route],
          `$.summary.routeCounts.${route}`,
          'does not match items'
        );
      }
    }
  }

  if (object(report.snapshot)) {
    add(
      errors,
      report.snapshot.itemCount === items.length,
      '$.snapshot.itemCount',
      'does not match items'
    );
  }

  if (snapshot) {
    add(
      errors,
      report.snapshot?.repository === snapshot.repository,
      '$.snapshot.repository',
      'does not match input'
    );
    add(
      errors,
      report.snapshot?.digest === snapshot.digest,
      '$.snapshot.digest',
      'does not match input'
    );
    add(
      errors,
      report.snapshot?.itemCount === snapshot.itemCount,
      '$.snapshot.itemCount',
      'does not match input'
    );
    add(
      errors,
      report.runId === expectedRunId(snapshot),
      '$.runId',
      'does not match input snapshot'
    );
    const source = new Map(snapshot.items.map((item) => [`${item.kind}:${item.number}`, item]));
    for (const item of items) {
      const original = source.get(`${item.kind}:${item.number}`);
      add(
        errors,
        Boolean(original),
        `$.items.${item.kind}:${item.number}`,
        'is absent from input snapshot'
      );
      if (original) {
        add(
          errors,
          item.title === original.title,
          `$.items.${item.kind}:${item.number}.title`,
          'does not match input'
        );
      }
    }
  }

  return errors;
}
