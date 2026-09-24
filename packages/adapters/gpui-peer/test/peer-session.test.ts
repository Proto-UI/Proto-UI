import { beforeEach, describe, expect, it } from 'vitest';
import type { WireRecord } from '@proto.ui/host-protocol';
import button from '@proto.ui/prototypes-base/button';

import { createPeerSession, type PeerSession } from '../src/session';
import { ScriptedHost } from './scripted-host';

const SESSION = 'session-button';
const INSTANCE = 'instance-button';

type Harness = { host: ScriptedHost; peer: PeerSession };

function createHarness(
  options: ConstructorParameters<typeof ScriptedHost>[1] = {},
  props: WireRecord = {}
): Harness {
  const host = new ScriptedHost(SESSION, options);
  const peer = createPeerSession({
    sessionId: SESSION,
    instanceId: INSTANCE,
    prototype: button,
    props,
    send: (message) => host.receive(message),
    // Deterministic: run scheduled work inline instead of on a microtask.
    schedule: (task) => task(),
  });
  host.bind((message) => peer.handle(message));
  return { host, peer };
}

describe('gpui peer: projection cycle', () => {
  let harness: Harness;
  beforeEach(() => {
    harness = createHarness();
  });

  it('installs one transaction per commit and activates only after the host applies it', async () => {
    await harness.peer.mount();

    const installs = harness.host.of('projection.install');
    expect(installs).toHaveLength(1);
    const transaction = installs[0]!.transaction;
    expect(transaction.sessionId).toBe(SESSION);
    expect(transaction.instanceId).toBe(INSTANCE);
    expect(transaction.viewEpoch).toBe(1);
    expect(transaction.commitId).toBe(1);

    // Every Base Button registration crosses as a lease, none deduplicated.
    const types = transaction.events.registrations.map((entry) => `${entry.scope}:${entry.type}`);
    expect(types).toContain('root:press.commit');
    expect(types).toContain('root:pointer.down');
    expect(types).toContain('global:key.down');
    expect(new Set(transaction.events.registrations.map((entry) => entry.leaseId)).size).toBe(
      transaction.events.registrations.length
    );

    // Activation is the peer's answer to an applied acknowledgement.
    expect(harness.host.of('projection.activate')).toHaveLength(1);
    expect(harness.host.last('projection.activate')).toMatchObject({ viewEpoch: 1, commitId: 1 });
    expect(harness.peer.snapshot()).toMatchObject({ activated: true, targetReady: true });
  });

  it('does not activate when the host rejects the transaction', async () => {
    const rejected = createHarness({ autoAck: false });
    await rejected.peer.mount();
    rejected.host.acknowledge({ status: 'failed' });

    expect(rejected.host.of('projection.activate')).toHaveLength(0);
    expect(rejected.peer.snapshot().activated).toBe(false);
    expect(rejected.host.of('diagnostic').map((entry) => entry.diagnostic.code)).toContain(
      'projection-rejected'
    );
  });

  it('carries the Template and the Slot plan as bounded data', async () => {
    await harness.peer.mount();
    const transaction = harness.host.last('projection.install')!.transaction;

    expect(JSON.parse(JSON.stringify(transaction.template))).toEqual(transaction.template);
    expect(transaction.slots.slots.every((ref) => typeof ref === 'string')).toBe(true);
    expect(transaction.focus.targets).toEqual([
      { ref: 'focus-root', sequential: true, programmatic: true },
    ]);
  });
});

describe('gpui peer: interaction', () => {
  it('tracks pointer state and emits one click per press commit', async () => {
    const { host, peer } = createHarness();
    await peer.mount();

    host.input('pointer.enter');
    expect(host.exposeState('hovered')).toBe(true);

    host.input('pointer.down');
    expect(host.exposeState('pressed')).toBe(true);

    host.input('press.commit');
    expect(host.exposeState('pressed')).toBe(false);
    expect(host.of('expose.signal').map((entry) => entry.name)).toEqual(['click']);

    host.input('pointer.leave');
    expect(host.exposeState('hovered')).toBe(false);

    await peer.dispose();
  });

  it('requests default-action prevention against the exact host sample', async () => {
    const { host, peer } = createHarness();
    await peer.mount();

    host.input('host:focus');
    expect(host.exposeState('focused')).toBe(true);

    host.clear();
    host.input('key.down', { key: ' ' });

    const prevention = host.of('default-action.prevent');
    expect(prevention).toHaveLength(1);
    expect(prevention[0]!.request).toMatchObject({
      sessionId: SESSION,
      reason: 'button.space-activation',
      source: 'base-button',
    });
    // The request names the sample it belongs to, so the host can bound it.
    const delivered = host.model.snapshot();
    expect(prevention[0]!.request.sampleId).toMatch(/^session-button:sample:/);
    expect(delivered.diagnostics.map((entry) => entry.code)).not.toContain('late-prevention');

    await peer.dispose();
  });

  it('suppresses activation and clears transient state while disabled', async () => {
    const { host, peer } = createHarness({}, { disabled: false });
    await peer.mount();

    host.input('pointer.enter');
    host.input('pointer.down');
    expect(host.exposeState('hovered')).toBe(true);

    peer.setProps({ disabled: true });
    expect(host.exposeState('disabled')).toBe(true);
    expect(host.exposeState('hovered')).toBe(false);
    expect(host.exposeState('pressed')).toBe(false);

    host.clear();
    host.input('press.commit');
    expect(host.of('expose.signal')).toHaveLength(0);

    await peer.dispose();
  });
});

describe('gpui peer: focus readiness', () => {
  it('retains a focus request until the host reports the surface ready', async () => {
    // The surface is never listed ready, so the Focus module keeps the intent.
    const { host, peer } = createHarness({ readySurfaces: [] });
    await peer.mount();
    expect(peer.snapshot().targetReady).toBe(false);

    const exposes = host.last('expose.descriptor');
    expect(exposes?.methods).toContain('focusSelf');

    host.send({
      kind: 'expose.call',
      sessionId: SESSION,
      callId: 'call-1',
      name: 'focusSelf',
      args: [],
    });
    // Not ready: no host focus request is produced, and nothing is fabricated.
    expect(host.of('focus.request')).toHaveLength(0);
    expect(host.exposeState('focused')).toBe(false);
    expect(host.last('expose.result')).toMatchObject({ callId: 'call-1', status: 'ok' });

    await peer.dispose();
  });

  it('sends a focus request once the surface is ready and follows the native fact', async () => {
    const { host, peer } = createHarness();
    await peer.mount();
    expect(peer.snapshot().targetReady).toBe(true);

    host.send({
      kind: 'expose.call',
      sessionId: SESSION,
      callId: 'call-1',
      name: 'focusSelf',
      args: [],
    });

    const requests = host.of('focus.request');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ target: 'focus-root', action: 'focus' });
    // The scripted host applies it and echoes host:focus; that is the truth.
    expect(host.exposeState('focused')).toBe(true);

    await peer.dispose();
  });
});

describe('gpui peer: lifecycle', () => {
  it('releases every lease and reports disposal exactly once', async () => {
    const { host, peer } = createHarness();
    await peer.mount();
    const installed = host.last('projection.install')!.transaction.events.registrations.length;
    expect(installed).toBeGreaterThan(0);

    await peer.dispose();

    expect(host.of('session.disposed')).toHaveLength(1);
    expect(host.model.snapshot().leases.every((lease) => lease.released)).toBe(true);

    // A second dispose is idempotent and silent.
    await peer.dispose();
    expect(host.of('session.disposed')).toHaveLength(1);
  });

  it('rejects a sample that carries a retired view epoch', async () => {
    const { host, peer } = createHarness();
    await peer.mount();
    host.clear();

    host.input('pointer.enter', { viewEpoch: 0 });

    expect(host.of('expose.state')).toHaveLength(0);
    expect(host.model.snapshot().diagnostics.map((entry) => entry.code)).toContain('stale-sample');

    await peer.dispose();
  });
});

describe('gpui peer: readiness follows the current projection', () => {
  it('withdraws readiness when a newer commit is not ready, then retries the retained request', async () => {
    // Commit 2's acknowledgement omits the surface: the host applied the
    // projection but the view is not ready for interaction yet.
    const host = new ScriptedHost(SESSION, {
      readySurfaces: (commitId) => (commitId === 2 ? [] : ['proto-surface']),
    });
    const peer = createPeerSession({
      sessionId: SESSION,
      instanceId: INSTANCE,
      prototype: button,
      props: {},
      send: (message) => host.receive(message),
      schedule: (task) => task(),
    });
    host.bind((message) => peer.handle(message));

    await peer.mount();
    expect(peer.snapshot()).toMatchObject({ commitId: 1, targetReady: true });

    // A props push re-renders in the same epoch; the host answers not ready.
    peer.setProps({});
    expect(peer.snapshot()).toMatchObject({ commitId: 2, viewEpoch: 1, targetReady: false });

    const beforeRequest = host.of('focus.request').length;
    host.send({
      kind: 'expose.call',
      sessionId: SESSION,
      callId: 'call-1',
      name: 'focusSelf',
      args: [],
    });
    // Not ready: no new host request is produced and no fact is fabricated.
    expect(host.of('focus.request')).toHaveLength(beforeRequest);
    expect(host.exposeState('focused')).toBe(false);

    // Readiness returns on the next commit; the retained request is retried.
    peer.setProps({});
    expect(peer.snapshot()).toMatchObject({ commitId: 3, viewEpoch: 1, targetReady: true });
    expect(host.of('focus.request').length).toBe(beforeRequest + 1);
    expect(host.of('focus.request').at(-1)).toMatchObject({
      target: 'focus-root',
      action: 'focus',
    });
    expect(host.exposeState('focused')).toBe(true);

    await peer.dispose();
  });

  it('keeps a props push in the same epoch rather than starting a new one', async () => {
    const { host, peer } = createHarness();
    await peer.mount();

    peer.setProps({ disabled: true });
    peer.setProps({ disabled: false });

    const installs = host.of('projection.install').map((message) => ({
      viewEpoch: message.transaction.viewEpoch,
      commitId: message.transaction.commitId,
    }));
    expect(installs).toEqual([
      { viewEpoch: 1, commitId: 1 },
      { viewEpoch: 1, commitId: 2 },
      { viewEpoch: 1, commitId: 3 },
    ]);
    // Each commit is activated for its own commit id, never a previous one.
    expect(host.of('projection.activate').map((message) => message.commitId)).toEqual([1, 2, 3]);

    await peer.dispose();
  });
});
