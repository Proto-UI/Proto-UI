import assert from 'node:assert/strict';

export const VIEW_OPERATION_CASES = Object.freeze([
  'remove-root',
  'remove-source',
  'unrelated-reinsert',
  'terminal-replacement',
  'owned-transport',
  'nested-author-remove',
  'second-reconnect',
  'aborted-transport',
]);
const initial = 'connectedCallback:before,connectedCallback:after';
export function expectedReactionPhases(name) {
  assert(VIEW_OPERATION_CASES.includes(name), `Unknown physical case: ${name}`);
  const pair = ['disconnectedCallback:before', 'disconnectedCallback:after'];
  if (name === 'aborted-transport') return [];
  if (name === 'remove-root' || name === 'remove-source') return pair;
  const cycle = [...pair, 'connectedCallback:before', 'connectedCallback:after'];
  return name === 'nested-author-remove' || name === 'second-reconnect'
    ? [...cycle, ...cycle]
    : cycle;
}
export function expectedChecks(name) {
  const checks = { 'initial-connect-observed': initial, 'initial-current': true };
  if (name === 'remove-root' || name === 'remove-source')
    Object.assign(checks, { 'before-deferred-retirement': 0, withdrawn: false });
  else if (name === 'unrelated-reinsert')
    Object.assign(checks, {
      'connected-again': true,
      'no-retirement-yet': 0,
      'old-invalid': false,
      'new-current': true,
    });
  else if (name === 'terminal-replacement')
    Object.assign(checks, {
      'terminal-retired': 1,
      'old-invalid-without-intermediate-query': false,
      'new-owner-current': true,
    });
  else if (name === 'aborted-transport')
    Object.assign(checks, { 'original-error': true, unmoved: true, 'still-current': true });
  else {
    if (name === 'nested-author-remove') checks['legitimate-first-move'] = true;
    Object.assign(checks, {
      destination: true,
      'no-retirement-yet': 0,
      'final-current': name === 'owned-transport',
    });
  }
  checks['complete-native-reaction-sequence'] = expectedReactionPhases(name).join(',');
  return checks;
}
export function assertViewOperationCase(result, name) {
  assert.equal(result?.name, name);
  assert.equal(result.pass, true, `${name}: ${result.failure}`);
  assert.equal(result.failure, null);
  const expected = expectedChecks(name);
  assert.deepEqual(
    result.checks.map((entry) => entry.label),
    Object.keys(expected),
    `${name}: changed or missing obligations`
  );
  for (const check of result.checks) {
    assert.equal(
      check.expected,
      expected[check.label],
      `${name}: weakened expectation ${check.label}`
    );
    assert.equal(check.actual, expected[check.label], `${name}: ${check.label}`);
  }
  assert.deepEqual(
    result.initialReactions.map((event) => event.phase),
    initial.split(',')
  );
  assert(result.initialReactions.every((event) => event.connected === true));
  const reactions = result.events.filter((event) => event.phase.includes('Callback:'));
  assert.deepEqual(
    reactions.map((event) => event.phase),
    expectedReactionPhases(name)
  );
  reactions.forEach((event, index) => {
    const connected =
      event.phase.startsWith('connectedCallback') ||
      name === 'owned-transport' ||
      name === 'second-reconnect' ||
      (name === 'nested-author-remove' && index < 4);
    assert.equal(event.connected, connected, `${name}: physical callback admission`);
    assert(Array.isArray(event.path) && event.path.length > 0, `${name}: missing physical path`);
  });
}
export function assertViewOperationReceipt(receipt, source, expected) {
  assert.match(expected.revision, /^[0-9a-f]{40}$/);
  assert.match(expected.tree, /^[0-9a-f]{40}$/);
  for (const record of [receipt, source]) {
    assert.equal(record?.revision, expected.revision, 'Stale native revision');
    assert.equal(record?.tree, expected.tree, 'Stale native tree');
  }
  assert.equal(source.trackedTreeClean, true);
  assert.equal(receipt.pass, true, String(receipt.failure));
  assert.equal(receipt.failure, null);
  assert.deepEqual(receipt.pageErrors, []);
  assert.deepEqual(receipt.cleanupErrors, []);
  assert.deepEqual(receipt.observation?.cases, VIEW_OPERATION_CASES);
  assert.deepEqual(
    receipt.observation.results.map((entry) => entry.name),
    VIEW_OPERATION_CASES
  );
  for (const [index, name] of VIEW_OPERATION_CASES.entries())
    assertViewOperationCase(receipt.observation.results[index], name);
}
