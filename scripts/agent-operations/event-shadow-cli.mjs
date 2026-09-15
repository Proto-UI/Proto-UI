import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  EVENT_SHADOW_VERSION,
  evaluateEventShadow,
  normalizeGithubWebhook,
  validateEventShadowBinding,
} from './event-shadow.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const policyFile = path.join(root, 'internal/agent-operations/event-shadow.yaml');

function parseArgs(argv) {
  if (argv[0] !== 'replay') {
    throw new Error(
      'usage: agent:event-shadow replay --delivery <json> --trust <json> [--state <json>] [--secret-env <name>]'
    );
  }
  const args = {
    secretEnv: 'GITHUB_WEBHOOK_SECRET',
  };
  for (let index = 1; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${option} requires a value`);
    if (option === '--delivery') args.delivery = value;
    else if (option === '--trust') args.trust = value;
    else if (option === '--state') args.state = value;
    else if (option === '--secret-env') args.secretEnv = value;
    else throw new Error(`unknown option: ${option}`);
    index += 1;
  }
  if (!args.delivery) throw new Error('--delivery is required');
  if (!args.trust) throw new Error('--trust is required');
  if (!/^[A-Z][A-Z0-9_]*$/.test(args.secretEnv)) throw new Error('--secret-env is invalid');
  return args;
}

function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(path.resolve(file), 'utf8'));
  } catch (error) {
    throw new Error(`${label} is invalid: ${error.message}`);
  }
}

function readPolicy(file) {
  try {
    return parseYaml(readFileSync(path.resolve(file), 'utf8'));
  } catch (error) {
    throw new Error(`event shadow policy is invalid: ${error.message}`);
  }
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has unknown or missing fields`);
  }
}

function normalizeDelivery(value) {
  exactKeys(
    value,
    ['schemaVersion', 'kind', 'observedAt', 'headers', 'bodyBase64'],
    'delivery bundle'
  );
  if (value.schemaVersion !== 1 || value.kind !== 'proto-ui.github-webhook-delivery') {
    throw new Error('delivery bundle identity is invalid');
  }
  if (Number.isNaN(Date.parse(value.observedAt))) throw new Error('delivery observedAt is invalid');
  if (value.headers === null || typeof value.headers !== 'object' || Array.isArray(value.headers)) {
    throw new Error('delivery headers are invalid');
  }
  if (typeof value.bodyBase64 !== 'string' || value.bodyBase64.length < 4) {
    throw new Error('delivery bodyBase64 is invalid');
  }
  const rawBody = Buffer.from(value.bodyBase64, 'base64');
  if (rawBody.length === 0 || rawBody.toString('base64') !== value.bodyBase64) {
    throw new Error('delivery bodyBase64 is not canonical base64');
  }
  return { rawBody, headers: value.headers, observedAt: value.observedAt };
}

function normalizeTrust(value) {
  exactKeys(
    value,
    [
      'schemaVersion',
      'kind',
      'repositoryId',
      'repositoryFullName',
      'hookIds',
      'installationIds',
      'selfActorIds',
    ],
    'trust anchors'
  );
  if (value.schemaVersion !== 1 || value.kind !== 'proto-ui.event-shadow-trust') {
    throw new Error('trust anchor identity is invalid');
  }
  if (
    !Array.isArray(value.selfActorIds) ||
    value.selfActorIds.length === 0 ||
    value.selfActorIds.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    new Set(value.selfActorIds).size !== value.selfActorIds.length
  ) {
    throw new Error('trust anchor selfActorIds are invalid');
  }
  return value;
}

function emptyState() {
  return {
    schemaVersion: 1,
    kind: 'proto-ui.event-shadow-state',
    seenDeliveryKeys: [],
    objectCursors: {},
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const secret = process.env[args.secretEnv];
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error(`${args.secretEnv} must contain a webhook secret of at least 32 characters`);
  }
  const delivery = normalizeDelivery(readJson(args.delivery, 'delivery bundle'));
  const trust = normalizeTrust(readJson(args.trust, 'trust anchors'));
  const sourcePolicy = readPolicy(policyFile);
  if (
    sourcePolicy.schemaVersion !== 1 ||
    sourcePolicy.policyVersion !== EVENT_SHADOW_VERSION ||
    sourcePolicy.status !== 'contract-only-not-deployed'
  ) {
    throw new Error('event shadow policy identity is invalid');
  }
  const envelope = normalizeGithubWebhook({ ...delivery, secret, trust });
  const state = args.state ? readJson(args.state, 'event shadow state') : emptyState();
  const result = evaluateEventShadow({
    envelope,
    state,
    policy: {
      policyVersion: sourcePolicy.policyVersion,
      allowlist: sourcePolicy.allowlist,
      selfActorIds: trust.selfActorIds,
    },
  });
  const bindingIssues = validateEventShadowBinding(envelope, result.receipt);
  if (bindingIssues.length) {
    throw new Error(bindingIssues.join('; '));
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        kind: 'proto-ui.event-shadow-replay',
        envelope,
        receipt: result.receipt,
        nextState: result.nextState,
        mutationAuthorized: false,
        writeOperationsPerformed: 0,
      },
      null,
      2
    )}\n`
  );
} catch (error) {
  process.stderr.write(`[agent:event-shadow] ${error.message}\n`);
  process.exitCode = 1;
}
