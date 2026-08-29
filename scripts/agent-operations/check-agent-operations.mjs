import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';
import {
  HUMAN_GATES,
  POLICY_VERSION,
  PROPOSAL_ACTIONS,
  ROUTES,
  validateShadowReport,
} from './lib.mjs';
import {
  EVENT_SHADOW_VERSION,
  MAX_EVENT_PAYLOAD_BYTES,
  MAX_EVENT_STATE_ENTRIES,
} from './event-shadow.mjs';

const root = process.cwd();
const operationsDirectory = path.join(root, 'internal/agent-operations');
const policyFile = path.join(operationsDirectory, 'policy.yaml');
const registryFile = path.join(operationsDirectory, 'workflows.yaml');
const schemaFile = path.join(operationsDirectory, 'schemas/shadow-report.schema.json');
const validFixtureFile = path.join(operationsDirectory, 'fixtures/shadow-report.valid.json');
const invalidFixtureFile = path.join(
  operationsDirectory,
  'fixtures/shadow-report.invalid-write.json'
);
const promptFile = path.join(root, '.github/codex/prompts/agent-operations-shadow.md');
const workflowFile = path.join(root, '.github/workflows/agent-operations-shadow.yml');
const repoStewardWorkflowFile = path.join(
  root,
  '.github/workflows/reposteward-portfolio-shadow.yml'
);
const repoStewardSchemaFile = path.join(
  operationsDirectory,
  'schemas/reposteward-portfolio-envelope.schema.json'
);
const eventShadowPolicyFile = path.join(operationsDirectory, 'event-shadow.yaml');
const eventShadowSchemaFiles = [
  'event-envelope.schema.json',
  'event-shadow-receipt.schema.json',
  'event-shadow-state.schema.json',
  'event-shadow-delivery.schema.json',
  'event-shadow-trust.schema.json',
].map((name) => path.join(operationsDirectory, 'schemas', name));
const eventShadowCliFile = path.join(root, 'scripts/agent-operations/event-shadow-cli.mjs');
const collaborationRequestSchemaFile = path.join(
  operationsDirectory,
  'schemas/collaboration-request.schema.json'
);
const collaborationReceiptSchemaFile = path.join(
  operationsDirectory,
  'schemas/collaboration-receipt.schema.json'
);
const collaborationRuntimeFile = path.join(
  root,
  'scripts/agent-operations/collaboration-runtime.mjs'
);
const collaborationCollectorFile = path.join(
  root,
  'scripts/agent-operations/collect-live-collaboration-state.mjs'
);
const collaborationCliFile = path.join(root, 'scripts/agent-operations/collaboration-packet.mjs');
const capabilityPolicyFile = path.join(operationsDirectory, 'capability-policy.yaml');
const autonomousTasksFile = path.join(operationsDirectory, 'autonomous-tasks.yaml');
const packageFile = path.join(root, 'package.json');
const REPOSTEWARD_COMMIT = 'e5db7d3496ef15072135533c5b9f4da91084b553';
const errors = [];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--report') args.report = argv[++index];
    else if (arg === '--snapshot') args.snapshot = argv[++index];
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (args.snapshot && !args.report) throw new Error('--snapshot requires --report');
  return args;
}

function fail(file, message) {
  errors.push(`${path.relative(root, file)}: ${message}`);
}

function read(file, parser, label) {
  if (!fs.existsSync(file)) {
    fail(file, 'file does not exist');
    return null;
  }
  try {
    return parser(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(file, `invalid ${label}: ${error.message}`);
    return null;
  }
}

function readYaml(file) {
  return read(file, YAML.parse, 'YAML');
}

function readJson(file) {
  return read(file, JSON.parse, 'JSON');
}

function sameMembers(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function isSingleValueEnum(schema, expected) {
  return Array.isArray(schema?.enum) && schema.enum.length === 1 && schema.enum[0] === expected;
}

function repositoryPath(file, value, label) {
  if (typeof value !== 'string' || !value) {
    fail(file, `${label} must be a non-empty repository-relative path`);
    return null;
  }
  if (path.isAbsolute(value) || value.split('/').includes('..')) {
    fail(file, `${label} must stay within the repository: ${value}`);
    return null;
  }
  const resolved = path.resolve(root, value);
  if (!resolved.startsWith(`${root}${path.sep}`) || !fs.existsSync(resolved)) {
    fail(file, `${label} does not resolve to an existing repository path: ${value}`);
    return null;
  }
  return resolved;
}

function validatePolicy() {
  const policy = readYaml(policyFile);
  if (!policy) return;
  if (policy.schemaVersion !== 1) fail(policyFile, 'schemaVersion must be 1');
  if (policy.policyVersion !== POLICY_VERSION) {
    fail(policyFile, `policyVersion must be ${POLICY_VERSION}`);
  }
  if (policy.mode !== 'shadow') fail(policyFile, 'mode must be shadow');
  if (!sameMembers(policy.routes, ROUTES))
    fail(policyFile, 'routes do not match the report contract');
  if (!sameMembers(policy.humanGates, HUMAN_GATES)) {
    fail(policyFile, 'humanGates do not match the report contract');
  }
  if (!sameMembers(policy.proposalActions, PROPOSAL_ACTIONS)) {
    fail(policyFile, 'proposalActions do not match the report contract');
  }
  if (!Array.isArray(policy.permissions?.github?.write) || policy.permissions.github.write.length) {
    fail(policyFile, 'permissions.github.write must be an empty array in the shadow intake lane');
  }
  if (policy.permissions?.repository?.trackedMutation !== 'forbidden') {
    fail(policyFile, 'tracked repository mutation must be forbidden');
  }
  if (policy.permissions?.agent?.permissionProfile !== ':read-only') {
    fail(policyFile, 'Agent permission profile must be :read-only');
  }
  if (policy.permissions?.agent?.network !== 'forbidden') {
    fail(policyFile, 'Agent network must be forbidden');
  }
  if (policy.graduation?.unauthorizedMutationCount !== 0) {
    fail(policyFile, 'graduation.unauthorizedMutationCount must be zero');
  }
  if (policy.graduation?.duplicateMutationCount !== 0) {
    fail(policyFile, 'graduation.duplicateMutationCount must be zero');
  }
  if (policy.graduation?.activationMode !== 'evidence-backed-policy-change') {
    fail(policyFile, 'graduation must use an evidence-backed policy change');
  }
}

function validateRegistry() {
  const registry = readYaml(registryFile);
  if (!registry) return;
  if (registry.schemaVersion !== 1) fail(registryFile, 'schemaVersion must be 1');
  if (!Array.isArray(registry.workflows)) {
    fail(registryFile, 'workflows must be an array');
    return;
  }
  const expected = new Set([
    'issue-steward',
    'pr-steward',
    'reposteward-pr-portfolio',
    'autonomous-maintenance',
  ]);
  const seen = new Set();
  for (const [index, workflow] of registry.workflows.entries()) {
    const label = `workflows[${index}]`;
    if (!expected.has(workflow?.id)) fail(registryFile, `${label}.id is invalid: ${workflow?.id}`);
    if (seen.has(workflow?.id)) fail(registryFile, `${label}.id is duplicated: ${workflow?.id}`);
    seen.add(workflow?.id);
    repositoryPath(registryFile, workflow?.implementationPath, `${label}.implementationPath`);
    repositoryPath(registryFile, workflow?.outputSchemaPath, `${label}.outputSchemaPath`);
    if (!Array.isArray(workflow?.humanGates) || workflow.humanGates.length === 0) {
      fail(registryFile, `${label}.humanGates must not be empty`);
    } else {
      for (const gate of workflow.humanGates) {
        if (!HUMAN_GATES.includes(gate)) fail(registryFile, `${label} has invalid gate: ${gate}`);
      }
    }
    if (['issue-steward', 'pr-steward'].includes(workflow?.id)) {
      if (workflow.status !== 'shadow') fail(registryFile, `${label}.status must be shadow`);
      if (workflow.mutationPolicy !== 'proposal-only') {
        fail(registryFile, `${label}.mutationPolicy must be proposal-only`);
      }
    }
    if (workflow?.id === 'reposteward-pr-portfolio') {
      if (workflow.status !== 'manual-shadow-trial') {
        fail(registryFile, `${label}.status must be manual-shadow-trial`);
      }
      if (!sameMembers(workflow.triggerClasses, ['manual-dispatch'])) {
        fail(registryFile, `${label}.triggerClasses must contain only manual-dispatch`);
      }
      if (workflow.mutationPolicy !== 'read-only-artifact') {
        fail(registryFile, `${label}.mutationPolicy must be read-only-artifact`);
      }
      if (workflow.externalEngine?.repository !== 'tiammomo/RepoSteward') {
        fail(registryFile, `${label}.externalEngine.repository is invalid`);
      }
      if (workflow.externalEngine?.commit !== REPOSTEWARD_COMMIT) {
        fail(registryFile, `${label}.externalEngine.commit must match the reviewed pin`);
      }
      if (workflow.externalEngine?.command !== 'portfolio inspect') {
        fail(registryFile, `${label}.externalEngine.command must be portfolio inspect`);
      }
    }
  }
  for (const id of expected) {
    if (!seen.has(id)) fail(registryFile, `missing workflow: ${id}`);
  }
}

function validateSchema() {
  const schema = readJson(schemaFile);
  if (!schema) return;
  if (!isSingleValueEnum(schema.properties?.schemaVersion, 1)) {
    fail(schemaFile, 'schemaVersion must be the single enum value 1');
  }
  if (!isSingleValueEnum(schema.properties?.policyVersion, POLICY_VERSION)) {
    fail(schemaFile, `policyVersion must be the single enum value ${POLICY_VERSION}`);
  }
  if (!isSingleValueEnum(schema.properties?.mode, 'shadow')) {
    fail(schemaFile, 'mode must be the single enum value shadow');
  }
  if (!isSingleValueEnum(schema.properties?.writeOperationsPerformed, 0)) {
    fail(schemaFile, 'writeOperationsPerformed must be the single enum value zero');
  }
  const routeEnum = schema.$defs?.item?.properties?.recommendedRoute?.enum;
  if (!sameMembers(routeEnum, ROUTES)) fail(schemaFile, 'route enum does not match policy');
  const gateEnum = schema.$defs?.item?.properties?.humanGate?.enum;
  if (!sameMembers(gateEnum, HUMAN_GATES)) fail(schemaFile, 'humanGate enum does not match policy');
  const actionEnum = schema.$defs?.proposedAction?.properties?.type?.enum;
  if (!sameMembers(actionEnum, PROPOSAL_ACTIONS)) {
    fail(schemaFile, 'proposed action enum does not match policy');
  }
  if (
    !isSingleValueEnum(
      schema.$defs?.proposedAction?.properties?.execution,
      'blocked-by-shadow-policy'
    )
  ) {
    fail(schemaFile, 'proposed actions must be blocked by shadow policy');
  }
}

function validateRepoStewardTrial() {
  const schema = readJson(repoStewardSchemaFile);
  if (schema) {
    if (schema.properties?.schemaVersion?.const !== 1) {
      fail(repoStewardSchemaFile, 'schemaVersion must be const 1');
    }
    if (schema.properties?.trialVersion?.const !== '2026-08-22.manual-shadow') {
      fail(repoStewardSchemaFile, 'trialVersion must remain fixed for this trial');
    }
    if (schema.properties?.mode?.const !== 'manual-shadow') {
      fail(repoStewardSchemaFile, 'mode must be manual-shadow');
    }
    if (schema.properties?.engine?.properties?.commit?.const !== REPOSTEWARD_COMMIT) {
      fail(repoStewardSchemaFile, 'engine commit must match the reviewed pin');
    }
    if (schema.properties?.writeOperationsPerformed?.const !== 0) {
      fail(repoStewardSchemaFile, 'writeOperationsPerformed must be const zero');
    }
  }

  const workflow = readYaml(repoStewardWorkflowFile);
  if (!workflow) return;
  const permissions = workflow.permissions;
  for (const permission of ['contents', 'pull-requests', 'checks', 'statuses']) {
    if (permissions?.[permission] !== 'read') {
      fail(repoStewardWorkflowFile, `${permission} permission must be read`);
    }
  }
  const source = fs.readFileSync(repoStewardWorkflowFile, 'utf8');
  for (const forbidden of [
    'contents: write',
    'issues: write',
    'pull-requests: write',
    'checks: write',
    'statuses: write',
    'pull_request_target',
    'reposteward prepare',
    'reposteward repair',
    'reposteward submit',
    'reposteward merge',
  ]) {
    if (source.includes(forbidden)) {
      fail(repoStewardWorkflowFile, `forbidden manual shadow capability: ${forbidden}`);
    }
  }
  if (Object.hasOwn(workflow.on ?? {}, 'schedule')) {
    fail(repoStewardWorkflowFile, 'RepoSteward trial must not be scheduled before graduation');
  }
  if (!Object.hasOwn(workflow.on ?? {}, 'workflow_dispatch')) {
    fail(repoStewardWorkflowFile, 'RepoSteward trial must use workflow_dispatch');
  }
  if (!source.includes(`REPOSTEWARD_COMMIT: ${REPOSTEWARD_COMMIT}`)) {
    fail(repoStewardWorkflowFile, 'RepoSteward commit env must match the reviewed pin');
  }
  if (
    !source.includes(
      'git -C "${REPOSTEWARD_SOURCE}" fetch --depth 1 origin "${REPOSTEWARD_COMMIT}"'
    )
  ) {
    fail(repoStewardWorkflowFile, 'RepoSteward source fetch must use the commit pin');
  }
  if (
    !source.includes(
      'test "$(git -C "${REPOSTEWARD_SOURCE}" rev-parse HEAD)" = "${REPOSTEWARD_COMMIT}"'
    )
  ) {
    fail(repoStewardWorkflowFile, 'RepoSteward checkout must verify the exact source commit');
  }
  if (!source.includes('uv sync --project "${REPOSTEWARD_SOURCE}" --frozen --no-dev')) {
    fail(repoStewardWorkflowFile, 'RepoSteward dependencies must use the reviewed lockfile');
  }
  if (!source.includes('persist-credentials: false')) {
    fail(repoStewardWorkflowFile, 'checkout must not persist Git credentials');
  }
  if (!source.includes('portfolio inspect Proto-UI/Proto-UI')) {
    fail(repoStewardWorkflowFile, 'workflow must run only the registered portfolio target');
  }
  if (!source.includes('scripts/agent-operations/reposteward-portfolio.mjs')) {
    fail(repoStewardWorkflowFile, 'workflow must validate the raw snapshot before upload');
  }
}

function validateEventShadowContract() {
  const policy = readYaml(eventShadowPolicyFile);
  if (policy) {
    if (policy.schemaVersion !== 1) fail(eventShadowPolicyFile, 'schemaVersion must be 1');
    if (policy.policyVersion !== EVENT_SHADOW_VERSION) {
      fail(eventShadowPolicyFile, `policyVersion must be ${EVENT_SHADOW_VERSION}`);
    }
    if (policy.status !== 'contract-only-not-deployed') {
      fail(eventShadowPolicyFile, 'status must remain contract-only-not-deployed');
    }
    if (policy.architecture?.durableControllerEvidence !== 'absent') {
      fail(eventShadowPolicyFile, 'durable controller evidence must remain absent');
    }
    if (policy.authenticity?.algorithm !== 'hmac-sha256') {
      fail(eventShadowPolicyFile, 'authenticity algorithm must be hmac-sha256');
    }
    if (policy.authenticity?.rawBodyRequired !== true) {
      fail(eventShadowPolicyFile, 'raw webhook bytes must be required');
    }
    if (policy.authenticity?.transportHeadersAuthenticated !== false) {
      fail(eventShadowPolicyFile, 'GitHub raw-body HMAC must not claim to authenticate headers');
    }
    if (policy.payload?.maximumBytes !== MAX_EVENT_PAYLOAD_BYTES) {
      fail(eventShadowPolicyFile, `payload maximum must be ${MAX_EVENT_PAYLOAD_BYTES}`);
    }
    if (policy.deduplication?.maximumStateEntries !== MAX_EVENT_STATE_ENTRIES) {
      fail(eventShadowPolicyFile, `state maximum must be ${MAX_EVENT_STATE_ENTRIES}`);
    }
    if (
      policy.deduplication?.identity !==
        'trusted-repository-id-plus-authenticated-raw-body-digest' ||
      policy.deduplication?.transportHeaderRewriteAction !== 'duplicate'
    ) {
      fail(eventShadowPolicyFile, 'replay identity must not depend on unauthenticated headers');
    }
    if (policy.payload?.authoredContentIncludedInEnvelope !== false) {
      fail(eventShadowPolicyFile, 'authored content must not enter the event envelope');
    }
    if (
      !sameMembers(policy.allowlist?.pull_request, [
        'opened',
        'reopened',
        'synchronize',
        'ready_for_review',
        'converted_to_draft',
        'edited',
        'closed',
      ])
    ) {
      fail(
        eventShadowPolicyFile,
        'pull_request allowlist does not match the reviewed shadow slice'
      );
    }
    if (policy.forks?.actorAuthority !== 'none' || policy.forks?.mutationAuthority !== 'none') {
      fail(eventShadowPolicyFile, 'fork or actor identity must not grant authority');
    }
    if (policy.ordering?.githubTotalOrderAssumed !== false) {
      fail(eventShadowPolicyFile, 'GitHub delivery order must not be treated as a total order');
    }
    if (policy.mutation?.authorized !== false || policy.mutation?.writeOperationsPerformed !== 0) {
      fail(eventShadowPolicyFile, 'Event shadow must authorize and perform zero mutations');
    }
    if (policy.graduation?.attendedDecisionClass !== 'privileged-or-irreversible-operation') {
      fail(
        eventShadowPolicyFile,
        'deploying the Event shadow must remain a privileged-or-irreversible-operation'
      );
    }
  }

  for (const schemaFile of eventShadowSchemaFiles) {
    const schema = readJson(schemaFile);
    if (!schema) continue;
    if (schema.type !== 'object' || schema.additionalProperties !== false) {
      fail(schemaFile, 'top-level schema must be a closed object');
    }
  }
  const envelopeSchema = readJson(eventShadowSchemaFiles[0]);
  if (envelopeSchema) {
    if (envelopeSchema.properties?.eventShadowVersion?.const !== EVENT_SHADOW_VERSION) {
      fail(eventShadowSchemaFiles[0], 'eventShadowVersion must match policy');
    }
    if (envelopeSchema.properties?.authenticated?.const !== true) {
      fail(eventShadowSchemaFiles[0], 'authenticated must be const true');
    }
    if (envelopeSchema.properties?.transportHeadersAuthenticated?.const !== false) {
      fail(eventShadowSchemaFiles[0], 'transportHeadersAuthenticated must be const false');
    }
    if (envelopeSchema.properties?.mutationAuthorized?.const !== false) {
      fail(eventShadowSchemaFiles[0], 'mutationAuthorized must be const false');
    }
    if (envelopeSchema.properties?.writeOperationsPerformed?.const !== 0) {
      fail(eventShadowSchemaFiles[0], 'writeOperationsPerformed must be const zero');
    }
  }
  const receiptSchema = readJson(eventShadowSchemaFiles[1]);
  if (receiptSchema) {
    if (receiptSchema.properties?.policyVersion?.const !== EVENT_SHADOW_VERSION) {
      fail(eventShadowSchemaFiles[1], 'receipt policyVersion must match policy');
    }
    if (receiptSchema.properties?.mutationAuthorized?.const !== false) {
      fail(eventShadowSchemaFiles[1], 'receipt mutationAuthorized must be const false');
    }
    if (receiptSchema.properties?.writeOperationsPerformed?.const !== 0) {
      fail(eventShadowSchemaFiles[1], 'receipt writeOperationsPerformed must be const zero');
    }
  }

  if (!fs.existsSync(eventShadowCliFile)) {
    fail(eventShadowCliFile, 'file does not exist');
  } else {
    const source = fs.readFileSync(eventShadowCliFile, 'utf8');
    for (const forbidden of [
      'GITHUB_TOKEN',
      'fetch(',
      'writeFile',
      'pull_request_target',
      'contents: write',
      'pull-requests: write',
    ]) {
      if (source.includes(forbidden)) {
        fail(eventShadowCliFile, `forbidden Event shadow capability: ${forbidden}`);
      }
    }
    if (!source.includes('process.env[args.secretEnv]')) {
      fail(eventShadowCliFile, 'webhook secret must come from the named environment variable');
    }
    if (!source.includes('internal/agent-operations/event-shadow.yaml')) {
      fail(eventShadowCliFile, 'CLI must load the repository canonical Event shadow policy');
    }
    if (source.includes("option === '--policy'")) {
      fail(eventShadowCliFile, 'CLI must not accept a caller-selected policy');
    }
  }
}

function validateCollaborationContract() {
  const expectedActions = [
    'update-governed-issue-or-pull-request-metadata',
    'update-pull-request-branch-at-expected-head',
    'mark-exact-head-ready-for-review',
    'request-independent-review',
    'resolve-fixed-review-thread',
    'rerun-exact-trusted-workflow',
    'post-bounded-reconciliation-comment',
  ];
  const requestSchema = readJson(collaborationRequestSchemaFile);
  const receiptSchema = readJson(collaborationReceiptSchemaFile);
  for (const [file, schema] of [
    [collaborationRequestSchemaFile, requestSchema],
    [collaborationReceiptSchemaFile, receiptSchema],
  ]) {
    if (!schema) continue;
    if (schema.type !== 'object' || schema.additionalProperties !== false) {
      fail(file, 'top-level schema must be a closed object');
    }
    if (schema.properties?.schemaVersion?.const !== 1) {
      fail(file, 'schemaVersion must be const 1');
    }
  }
  if (requestSchema) {
    if (requestSchema.properties?.kind?.const !== 'proto-ui.collaboration-request') {
      fail(collaborationRequestSchemaFile, 'kind must bind the collaboration request');
    }
    if (!sameMembers(requestSchema.properties?.action?.enum, expectedActions)) {
      fail(collaborationRequestSchemaFile, 'action enum must match the active collaboration scope');
    }
    if (requestSchema.properties?.humanGates?.const?.length !== 0) {
      fail(
        collaborationRequestSchemaFile,
        'collaboration requests must carry zero attended decisions'
      );
    }
  }
  if (receiptSchema) {
    if (receiptSchema.properties?.kind?.const !== 'proto-ui.collaboration-receipt') {
      fail(collaborationReceiptSchemaFile, 'kind must bind the collaboration receipt');
    }
    if (!sameMembers(receiptSchema.$defs?.action?.enum, expectedActions)) {
      fail(collaborationReceiptSchemaFile, 'action enum must match the active collaboration scope');
    }
    if (!sameMembers(receiptSchema.properties?.mutationCount?.enum, [0, 1])) {
      fail(collaborationReceiptSchemaFile, 'receipt must cap mutationCount at one');
    }
    if (!sameMembers(receiptSchema.properties?.reconciliationCount?.enum, [0, 1])) {
      fail(collaborationReceiptSchemaFile, 'receipt must cap reconciliationCount at one');
    }
  }

  const policy = readYaml(capabilityPolicyFile);
  const authorization = policy?.collaborationMutationAuthorizations?.find(
    (candidate) => candidate.id === 'proto-ui-scheduled-collaboration-v1'
  );
  if (
    authorization?.status !== 'pending-runtime-identity' ||
    authorization?.repositoryId !== 'github.com:Proto-UI/Proto-UI' ||
    authorization?.mutationClass !== 'reversible-github-collaboration' ||
    !sameMembers(authorization?.allowedActions, expectedActions) ||
    !authorization?.blockedBy?.includes('poppy-broker-verified-workload-identity')
  ) {
    fail(
      capabilityPolicyFile,
      'collaboration authorization must remain pending until broker identity is bound'
    );
  }
  for (const requirement of [
    'purpose-bound-request-digest',
    'live-preflight',
    'one-mutation-maximum',
    'one-reconciliation-without-blind-retry',
    'verified-receipt',
  ]) {
    if (!authorization?.requires?.includes(requirement)) {
      fail(capabilityPolicyFile, `collaboration authorization is missing ${requirement}`);
    }
  }

  const tasks = readYaml(autonomousTasksFile);
  const task = tasks?.taskFamilies?.find(
    (candidate) => candidate.id === 'maintainer-collaboration-continuation'
  );
  if (
    task?.status !== 'blocked-runtime-identity' ||
    task?.skill !== 'pui-collaborate' ||
    task?.input !== 'purpose-bound-collaboration-request-v1' ||
    task?.output !== 'validated-collaboration-receipt-v1' ||
    task?.mutation !== 'none' ||
    task?.authorization !== 'proto-ui-scheduled-collaboration-v1'
  ) {
    fail(
      autonomousTasksFile,
      'collaboration task must remain read-only until broker identity is bound'
    );
  }

  for (const file of [collaborationRuntimeFile, collaborationCollectorFile, collaborationCliFile]) {
    if (!fs.existsSync(file)) fail(file, 'file does not exist');
  }
  if (fs.existsSync(collaborationRuntimeFile)) {
    const source = fs.readFileSync(collaborationRuntimeFile, 'utf8');
    for (const required of [
      'validateCollaborationRequest',
      'validateCollaborationHandoffBinding',
      'authorizeCollaborationMutation',
      'validateCollaborationReceipt',
      'request.requestDigest === computeCollaborationRequestDigest(request)',
    ]) {
      if (!source.includes(required))
        fail(collaborationRuntimeFile, `missing runtime guard: ${required}`);
    }
  }
  if (fs.existsSync(collaborationCollectorFile)) {
    const source = fs.readFileSync(collaborationCollectorFile, 'utf8');
    if (!source.includes('outcome is ambiguous after one live reconciliation')) {
      fail(collaborationCollectorFile, 'unknown outcomes must stop after one reconciliation');
    }
    if (!source.includes('expected_head_sha: request.target.headSha')) {
      fail(collaborationCollectorFile, 'update-branch must bind expected_head_sha');
    }
  }
  if (fs.existsSync(collaborationCliFile)) {
    const source = fs.readFileSync(collaborationCliFile, 'utf8');
    if (!source.includes('capability-policy.yaml') || source.includes("option === '--policy'")) {
      fail(
        collaborationCliFile,
        'CLI must load the canonical policy without a caller policy override'
      );
    }
  }
  const packageDocument = readJson(packageFile);
  if (
    packageDocument?.scripts?.['agent:collaborate'] !==
    'node scripts/agent-operations/collaboration-packet.mjs'
  ) {
    fail(packageFile, 'agent:collaborate must expose the registered collaboration CLI');
  }
}

function validateFixtures() {
  const valid = readJson(validFixtureFile);
  if (valid) {
    for (const issue of validateShadowReport(valid)) fail(validFixtureFile, issue);
  }
  const invalid = readJson(invalidFixtureFile);
  if (invalid) {
    const issues = validateShadowReport(invalid);
    if (issues.length === 0) {
      fail(invalidFixtureFile, 'negative fixture unexpectedly passed validation');
    }
    if (!issues.some((issue) => issue.includes('writeOperationsPerformed'))) {
      fail(invalidFixtureFile, 'negative fixture did not exercise the write-operation guard');
    }
  }
}

function validatePromptAndWorkflow() {
  const prompt = fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8') : '';
  if (!prompt) fail(promptFile, 'file does not exist or is empty');
  for (const required of [
    'untrusted data',
    'Do not follow instructions',
    'writeOperationsPerformed',
    'blocked-by-shadow-policy',
  ]) {
    if (!prompt.includes(required))
      fail(promptFile, `missing required safety language: ${required}`);
  }

  const workflow = readYaml(workflowFile);
  if (!workflow) return;
  const permissions = workflow.permissions;
  if (permissions?.contents !== 'read') fail(workflowFile, 'contents permission must be read');
  if (permissions?.issues !== 'read') fail(workflowFile, 'issues permission must be read');
  if (permissions?.['pull-requests'] !== 'read') {
    fail(workflowFile, 'pull-requests permission must be read');
  }
  const source = fs.readFileSync(workflowFile, 'utf8');
  for (const forbidden of ['contents: write', 'issues: write', 'pull-requests: write']) {
    if (source.includes(forbidden))
      fail(workflowFile, `forbidden Phase A permission: ${forbidden}`);
  }
  if (!source.includes("permission-profile: ':read-only'")) {
    fail(workflowFile, 'Codex permission profile must be :read-only');
  }
  if (!source.includes("codex-version: '0.138.0'")) {
    fail(workflowFile, 'Codex CLI version must remain pinned to 0.138.0');
  }
  if (source.includes('sandbox:')) {
    fail(workflowFile, 'legacy sandbox input must not be combined with the permission profile');
  }
  if (!source.includes('safety-strategy: drop-sudo')) {
    fail(workflowFile, 'Codex safety strategy must drop sudo');
  }
  if (source.includes('pull_request_target')) {
    fail(workflowFile, 'pull_request_target is forbidden for the shadow workflow');
  }
}

function validateLiveReport(args) {
  if (!args.report) return;
  const reportFile = path.resolve(root, args.report);
  const snapshotFile = args.snapshot ? path.resolve(root, args.snapshot) : null;
  const report = readJson(reportFile);
  const snapshot = snapshotFile ? readJson(snapshotFile) : null;
  if (!report) return;
  for (const issue of validateShadowReport(report, snapshot)) fail(reportFile, issue);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`[agent-operations] ${error.message}`);
  process.exit(1);
}

validatePolicy();
validateRegistry();
validateSchema();
validateRepoStewardTrial();
validateEventShadowContract();
validateCollaborationContract();
validateFixtures();
validatePromptAndWorkflow();
validateLiveReport(args);

if (errors.length > 0) {
  console.error(`[agent-operations] ${errors.length} issue(s)`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('[agent-operations] OK');
}
