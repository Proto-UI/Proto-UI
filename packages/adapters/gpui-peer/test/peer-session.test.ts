import { beforeEach, describe, expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import type { PeerToHostMessage, WireRecord } from '@proto.ui/host-protocol';
import button from '@proto.ui/prototypes-base/button';
import toggle from '@proto.ui/prototypes-base/toggle';
import { switchRoot, switchThumb } from '@proto.ui/prototypes-base/switch';
import { tabsContent, tabsList, tabsRoot, tabsTrigger } from '@proto.ui/prototypes-base/tabs';

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
  it('declares its click event as a signal, not as something unsupported', async () => {
    // Base Button declares `click` with `def.expose.event`. The declaration
    // is recognised by the Expose module's predicate; it carries no `kind`.
    const { host, peer } = createHarness();
    await peer.mount();
    const exposes = host.last('expose.descriptor');
    expect(exposes?.signals).toEqual(['click']);
    expect(exposes?.unsupported).toEqual([]);
    await peer.dispose();
  });

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

describe('gpui peer: Base Toggle', () => {
  it('flips active on every commit, announces the new value and projects it as pressed', async () => {
    const host = new ScriptedHost(SESSION);
    const peer = createPeerSession({
      sessionId: SESSION,
      instanceId: INSTANCE,
      prototype: toggle,
      props: {},
      send: (message) => host.receive(message),
      schedule: (task) => task(),
    });
    host.bind((message) => peer.handle(message));
    await peer.mount();
    expect(host.last('expose.descriptor')?.signals).toEqual(['activeChange']);

    host.input('press.commit');
    expect(host.exposeState('active')).toBe(true);
    expect(host.last('a11y.snapshot')?.snapshot?.states.pressed).toBe(true);

    host.input('press.commit');
    expect(host.exposeState('active')).toBe(false);
    expect(host.last('a11y.snapshot')?.snapshot?.states.pressed).toBe(false);

    expect(host.of('expose.signal').map((signal) => [signal.name, signal.payload])).toEqual([
      ['activeChange', { active: true }],
      ['activeChange', { active: false }],
    ]);
    await peer.dispose();
  });
});

describe('gpui peer: instances composed into one another', () => {
  function open(
    sessionId: string,
    prototype: Parameters<typeof createPeerSession>[0]['prototype'],
    parent?: PeerSession,
    sent?: PeerToHostMessage[]
  ) {
    const host = new ScriptedHost(sessionId);
    const peer = createPeerSession({
      sessionId,
      instanceId: `${sessionId}:instance`,
      prototype,
      props: {},
      send: (message) => {
        sent?.push(message);
        host.receive(message);
      },
      schedule: (task) => task(),
      parent,
    });
    host.bind((message) => peer.handle(message));
    return { host, peer };
  }

  it('lets a Switch thumb follow its root through context', async () => {
    const root = open('switch-root', switchRoot);
    await root.peer.mount();
    const thumb = open('switch-thumb', switchThumb, root.peer);
    await thumb.peer.mount();
    expect(thumb.host.exposeState('checked')).toBe(false);

    root.host.input('press.commit');
    expect(root.host.exposeState('checked')).toBe(true);
    expect(thumb.host.exposeState('checked')).toBe(true);

    await thumb.peer.dispose();
    await root.peer.dispose();
  });

  it('names the trigger group an instance belongs to, and none for a part that is not one', async () => {
    const root = open('switch-root', switchRoot);
    await root.peer.mount();
    const thumb = open('switch-thumb', switchThumb, root.peer);
    await thumb.peer.mount();

    expect(root.host.last('projection.install')?.transaction.events.trigger).toEqual({
      anchor: 'switch-root',
    });
    expect(thumb.host.last('projection.install')?.transaction.events.trigger).toBeUndefined();

    await thumb.peer.dispose();
    await root.peer.dispose();
  });

  it('ends the thumb before the root when the root ends first', async () => {
    const sent: PeerToHostMessage[] = [];
    const root = open('switch-root', switchRoot, undefined, sent);
    await root.peer.mount();
    const thumb = open('switch-thumb', switchThumb, root.peer, sent);
    await thumb.peer.mount();

    await root.peer.dispose();
    expect(
      sent.flatMap((message) => (message.kind === 'session.disposed' ? [message.sessionId] : []))
    ).toEqual(['switch-thumb', 'switch-root']);
    // The ended root is no longer an instance anything can belong to.
    expect(() => open('switch-thumb-2', switchThumb, root.peer)).toThrow(/switch-root has ended/);
  });

  it('keeps the root running when its thumb ends first', async () => {
    const root = open('switch-root', switchRoot);
    await root.peer.mount();
    const thumb = open('switch-thumb', switchThumb, root.peer);
    await thumb.peer.mount();

    await thumb.peer.dispose();
    root.host.input('press.commit');
    expect(root.host.exposeState('checked')).toBe(true);

    await root.peer.dispose();
    expect(thumb.host.of('session.disposed')).toHaveLength(1);
    expect(root.host.of('session.disposed')).toHaveLength(1);
  });

  it('sends the ids a Tabs trigger and panel give themselves and name each other by', async () => {
    const root = open('tabs-root', tabsRoot);
    root.peer.setProps({ defaultValue: 'overview' });
    await root.peer.mount();
    const trigger = open('tabs-trigger', tabsTrigger, root.peer);
    trigger.peer.setProps({ value: 'overview' });
    await trigger.peer.mount();
    const panel = open('tabs-panel', tabsContent, root.peer);
    panel.peer.setProps({ value: 'overview' });
    await panel.peer.mount();

    const triggerA11y = trigger.host.lastA11y();
    const panelA11y = panel.host.lastA11y();
    expect(triggerA11y?.role).toBe('tab');
    expect(panelA11y?.role).toBe('tabpanel');
    expect(triggerA11y?.id).toMatch(/-trigger-overview$/);
    expect(panelA11y?.id).toMatch(/-content-overview$/);
    expect(triggerA11y?.relations.controls).toBe(panelA11y?.id);
    expect(panelA11y?.relations.labelledBy).toBe(triggerA11y?.id);

    await panel.peer.dispose();
    await trigger.peer.dispose();
    await root.peer.dispose();
  });

  it('cannot set a thumb up without the root it belongs to', () => {
    // Setup runs as the session is created, and the thumb's context has no
    // provider to subscribe to.
    expect(() => open('switch-thumb', switchThumb)).toThrow(/provider missing/);
  });
});

describe('gpui peer: feedback style', () => {
  // A Prototype of the test's own, hidden while it is off, as an inactive
  // Tabs panel is.
  const panel = definePrototype({
    name: 'test-feedback-panel',
    setup(def) {
      const on = def.state.bool('on', false);
      def.feedback.style.use(tw('rounded-md'));
      def.rule({
        when: (w) => w.state(on).eq(false),
        intent: (i) => i.feedback.style.use(tw('hidden')),
      });
      def.event.on('press.commit', () => {
        on.set(!on.get(), 'reason: test panel press.commit');
      });
    },
  });

  it('carries the root style on the projection, then sends each change whole', async () => {
    const host = new ScriptedHost(SESSION);
    const peer = createPeerSession({
      sessionId: SESSION,
      instanceId: INSTANCE,
      prototype: panel,
      props: {},
      send: (message) => host.receive(message),
      schedule: (task) => task(),
    });
    host.bind((message) => peer.handle(message));
    await peer.mount();

    // The first frame's style arrives with the projection, not after it.
    expect(host.last('projection.install')?.transaction.style).toEqual(['rounded-md', 'hidden']);
    expect(host.of('style.apply')).toHaveLength(0);

    // Each change is the whole list, not a difference from the last one.
    host.input('press.commit');
    expect(host.last('style.apply')?.tokens).toEqual(['rounded-md']);
    host.input('press.commit');
    expect(host.last('style.apply')?.tokens).toEqual(['rounded-md', 'hidden']);
    expect(host.of('style.apply')).toHaveLength(2);

    await peer.dispose();
  });

  it('sends nothing for a Prototype with no feedback style', async () => {
    const { host, peer } = createHarness();
    await peer.mount();
    expect(host.last('projection.install')?.transaction.style).toEqual([]);
    host.input('press.commit');
    expect(host.of('style.apply')).toHaveLength(0);
    await peer.dispose();
  });
});

describe('gpui peer: view intent', () => {
  function open(
    sessionId: string,
    prototype: Parameters<typeof createPeerSession>[0]['prototype'],
    props: WireRecord,
    parent?: PeerSession
  ) {
    const host = new ScriptedHost(sessionId);
    const peer = createPeerSession({
      sessionId,
      instanceId: `${sessionId}:instance`,
      prototype,
      props,
      send: (message) => host.receive(message),
      schedule: (task) => task(),
      parent,
    });
    host.bind((message) => peer.handle(message));
    return { host, peer };
  }

  /** Lets reconciliation, which runs on its own promise chain, finish. */
  const settle = async () => {
    for (let turn = 0; turn < 20; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
  };

  /** The views a session installed and detached, in order. */
  const views = (host: ScriptedHost) =>
    host.sent.flatMap((message) =>
      message.kind === 'projection.install'
        ? [`install ${message.transaction.viewEpoch}`]
        : message.kind === 'projection.detach'
          ? [`detach ${message.viewEpoch}`]
          : []
    );

  it('gives only the current Tabs panel a view, and moves it as the value changes', async () => {
    const root = open('tabs-root', tabsRoot, { value: 'overview' });
    await root.peer.mount();
    const overview = open('panel-overview', tabsContent, { value: 'overview' }, root.peer);
    await overview.peer.mount();
    const settings = open('panel-settings', tabsContent, { value: 'settings' }, root.peer);
    await settings.peer.mount();
    await settle();
    // The inactive panel is detached from its creation, so it never renders.
    expect(views(overview.host)).toEqual(['install 1']);
    expect(views(settings.host)).toEqual([]);

    root.peer.setProps({ value: 'settings' });
    await settle();
    expect(views(overview.host)).toEqual(['install 1', 'detach 1']);
    expect(views(settings.host)).toEqual(['install 1']);
    // Its listeners are released before the host hears that the view went.
    const kinds = overview.host.sent.map((message) => message.kind);
    expect(kinds.lastIndexOf('lease.release')).toBeLessThan(kinds.indexOf('projection.detach'));

    root.peer.setProps({ value: 'overview' });
    await settle();
    // The view comes back in a new epoch; the instance itself was kept.
    expect(views(overview.host)).toEqual(['install 1', 'detach 1', 'install 2']);
    expect(views(settings.host)).toEqual(['install 1', 'detach 1']);
    expect(overview.host.exposeState('current')).toBe(true);

    await settings.peer.dispose();
    await overview.peer.dispose();
    await root.peer.dispose();
    expect(views(settings.host)).toEqual(['install 1', 'detach 1']);
    expect(settings.host.of('session.disposed')).toHaveLength(1);
  });

  it('does not make live a view whose intent went while it attached', async () => {
    const leaving = definePrototype({
      name: 'test-view-leaving',
      setup(def) {
        def.lifecycle.onMounted((run) => run.lifecycle.setPresent(false));
        return (r) => r.el('div', 'leaving');
      },
    });
    // The host answers the install only after the view was detached again.
    const host = new ScriptedHost('leaving', { autoAck: false });
    const peer = createPeerSession({
      sessionId: 'leaving',
      instanceId: 'leaving:instance',
      prototype: leaving,
      props: {},
      send: (message) => host.receive(message),
      schedule: (task) => task(),
    });
    host.bind((message) => peer.handle(message));
    await peer.mount();
    await settle();
    host.acknowledge();
    await settle();
    expect(views(host)).toEqual(['install 1', 'detach 1']);
    expect(host.of('projection.activate')).toHaveLength(0);
    await peer.dispose();
  });

  it('does not report a detach that a newer intent superseded while it ran', async () => {
    let returned = false;
    const returning = definePrototype({
      name: 'test-view-returning',
      setup(def) {
        def.props.define({ open: { type: 'boolean', empty: 'fallback' } });
        def.props.setDefaults({ open: true });
        def.props.watch(['open'], (run, next) => run.lifecycle.setPresent(!!next.open));
        // Only the first unmount turns back; disposal must not.
        def.lifecycle.onUnmounted((run) => {
          if (returned) return;
          returned = true;
          run.lifecycle.setPresent(true);
        });
        return (r) => r.el('div', 'returning');
      },
    });
    const { host, peer } = open('returning', returning, { open: true });
    await peer.mount();
    await settle();
    peer.setProps({ open: false });
    await settle();
    // No detach: the view came back in a new epoch instead.
    expect(views(host)).not.toContain('detach 1');
    expect(views(host).at(-1)).toBe('install 2');
    await peer.dispose();
  });

  it('keeps reconciling after an attach fails', async () => {
    let failing = true;
    const fragile = definePrototype({
      name: 'test-view-fragile',
      setup(def) {
        def.props.define({ open: { type: 'boolean', empty: 'fallback' } });
        def.props.setDefaults({ open: true });
        def.props.watch(['open'], (run, next) => run.lifecycle.setPresent(!!next.open));
        return (r) => {
          if (failing) throw new Error('render failed');
          return r.el('div', 'fragile');
        };
      },
    });
    const { host, peer } = open('fragile', fragile, { open: true });
    await peer.mount();
    await settle();
    expect(views(host)).toEqual([]);
    expect(host.of('diagnostic').map((message) => message.diagnostic.code)).toContain(
      'view-reconcile-failed'
    );

    failing = false;
    peer.setProps({ open: false });
    peer.setProps({ open: true });
    await settle();
    expect(host.of('projection.install')).toHaveLength(1);
    await expect(peer.dispose()).resolves.toBeUndefined();
    expect(host.of('session.disposed')).toHaveLength(1);
  });

  it('does nothing for an intent that a newer one replaced', async () => {
    const flicker = definePrototype({
      name: 'test-view-flicker',
      setup(def) {
        def.event.on('press.commit', (run) => {
          run.lifecycle.setPresent(false);
          run.lifecycle.setPresent(true);
        });
        return (r) => r.el('div', 'flicker');
      },
    });
    const { host, peer } = open('flicker', flicker, {});
    await peer.mount();
    await settle();
    host.input('press.commit');
    await settle();
    expect(views(host)).toEqual(['install 1']);
    await peer.dispose();
  });
});

describe('gpui peer: focus plan', () => {
  function open(
    sessionId: string,
    prototype: Parameters<typeof createPeerSession>[0]['prototype'],
    props: WireRecord,
    parent?: PeerSession
  ) {
    const host = new ScriptedHost(sessionId);
    const peer = createPeerSession({
      sessionId,
      instanceId: `${sessionId}:instance`,
      prototype,
      props,
      send: (message) => host.receive(message),
      schedule: (task) => task(),
      parent,
    });
    host.bind((message) => peer.handle(message));
    return { host, peer };
  }

  /** Whether the host was last told the root is a tab stop. */
  const sequential = (host: ScriptedHost) =>
    host.sent.flatMap((message) =>
      message.kind === 'projection.install'
        ? [message.transaction.focus.targets[0]?.sequential]
        : message.kind === 'focus.plan'
          ? [message.focus.targets[0]?.sequential]
          : []
    );

  it('moves a Tabs list tab stop to the tab selected outside a commit', async () => {
    const root = open('tabs-root', tabsRoot, { defaultValue: 'a' });
    await root.peer.mount();
    const list = open('tabs-list', tabsList, {}, root.peer);
    await list.peer.mount();
    const alpha = open('tab-a', tabsTrigger, { value: 'a' }, list.peer);
    await alpha.peer.mount();
    const beta = open('tab-b', tabsTrigger, { value: 'b' }, list.peer);
    await beta.peer.mount();
    // Mounting sends the plan with each projection, and nothing on its own.
    expect(sequential(alpha.host)).toEqual([true]);
    expect(sequential(beta.host)).toEqual([false]);

    beta.host.input('press.commit');
    expect(sequential(alpha.host)).toEqual([true, false]);
    expect(sequential(beta.host)).toEqual([false, true]);

    for (const { peer } of [beta, alpha, list, root]) await peer.dispose();
  });
});
