// Retained parent-to-connector bridge. No credentials are read or transmitted.
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCapabilityPolicy, collectRepositorySnapshot } from './assessment-runtime.mjs';
import {
  ConnectorReviewSession,
  CONNECTOR_AUTHORIZATION,
  INITIAL_SWEEP_AUTHORIZATION,
  isConnectorReviewScopeActive,
} from './connector-review-session.mjs';
import { RemoteCloudReviewLedger, ownerGitLedgerTransport } from './remote-cloud-review-ledger.mjs';
import { ConnectorReviewTransport } from './connector-review-transport.mjs';

// Avoid the terminal's 4096-byte canonical-input limit on connector JSON.
if (process.stdin.isTTY) process.stdin.setRawMode(true);

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  if (
    !['--ledger-dir', '--genesis', '--checkpoint'].includes(process.argv[i]) ||
    !process.argv[i + 1]
  )
    throw new Error('invalid worker option');
  args.set(process.argv[i], process.argv[i + 1]);
}
const policyPath = fileURLToPath(
  new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
);
const root = fileURLToPath(new URL('../../', import.meta.url));
const readPolicy = () => loadCapabilityPolicy(policyPath);
const readSnapshot = () =>
  collectRepositorySnapshot(root, { repositoryId: 'github.com:Proto-UI/Proto-UI' });
const policy = readPolicy();
const enabled = args.size > 0;
if (
  enabled &&
  (args.size !== 3 ||
    ![CONNECTOR_AUTHORIZATION, INITIAL_SWEEP_AUTHORIZATION].some((id) =>
      isConnectorReviewScopeActive(policy, id)
    ))
) {
  throw new Error('publication worker needs exact ledger pins and an active admitted review scope');
}
const pending = new Map();
const send = (message) => process.stdout.write(JSON.stringify(message) + '\n');
const allowed = new Set([
  'fetch',
  'get_user_login',
  'get_repo_collaborator_permission',
  'list_pull_request_review_threads',
]);
if (enabled) allowed.add('add_review_to_pr');
const call = (operation, args) => {
  if (!allowed.has(operation)) throw new Error('read-only worker refuses this operation');
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ kind: 'tool-call', id, operation, arguments: args });
  });
};
const transport = new ConnectorReviewTransport(call);
const ledger = enabled
  ? new RemoteCloudReviewLedger(args.get('--ledger-dir'), args.get('--genesis'), {
      checkpoint: args.get('--checkpoint'),
      transport: ownerGitLedgerTransport(),
    })
  : null;
const session = ledger
  ? new ConnectorReviewSession({ transport, ledger, readPolicy, readSnapshot })
  : null;
let busy = false;
const lines = createInterface({ input: process.stdin });
lines.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    if (message.kind === 'exit' && !busy) process.exit(0);
    if (message.kind === 'tool-result') {
      const waiting = pending.get(message.id);
      if (!waiting) throw new Error('unknown or replayed tool result');
      pending.delete(message.id);
      waiting.resolve(message.result);
      return;
    }
    if (
      ![
        'collect',
        'capture-initial-sweep',
        'begin',
        'begin-initial-sweep',
        'publish',
        'finish',
        'abandon',
      ].includes(message.kind) ||
      busy
    )
      throw new Error('one parent command at a time');
    if (message.kind !== 'collect' && !session)
      throw new Error('worker is read-only; production state and policy not enabled');
    if (
      typeof message.output !== 'string' ||
      !message.output.startsWith('/tmp/') ||
      message.output.includes('..')
    )
      throw new Error('output must be an explicit /tmp path');
    busy = true;
    try {
      let result;
      if (message.kind === 'collect') result = await transport.collect(message.pullRequest);
      if (message.kind === 'capture-initial-sweep') result = await session.captureInitialSweep();
      if (message.kind === 'begin-initial-sweep')
        result = await session.beginInitialSweep(message.pullRequest);
      if (message.kind === 'begin')
        result = await session.begin(message.pullRequest, message.event);
      if (message.kind === 'publish')
        result = await session.publishParentPacket(
          message.packet,
          message.assessment,
          message.analysisReconciliation,
          { modelTrace: message.modelTrace, modelTraceContext: message.modelTraceContext }
        );
      if (message.kind === 'finish') result = await session.finishParentAnalysis(message.packet);
      if (message.kind === 'abandon') result = await session.abandonBeforeIntent();
      writeFileSync(message.output, JSON.stringify(result, null, 2));
      send({
        kind: 'completed',
        command: message.kind,
        output: message.output,
        status: result.status ?? null,
        headSha: result.input?.headSha ?? null,
        coverage: result.coverage ?? null,
      });
    } finally {
      busy = false;
    }
  } catch (error) {
    send({ kind: 'error', message: error.message });
  }
});
lines.on('close', () => {
  for (const waiting of pending.values()) waiting.reject(new Error('parent bridge disconnected'));
});
send({
  kind: 'ready',
  protocol: 'proto-ui.connector-review.v1',
  mode: enabled ? 'parent-publication' : 'read-only',
});
