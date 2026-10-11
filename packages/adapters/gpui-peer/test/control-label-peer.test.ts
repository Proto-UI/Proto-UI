import { afterEach, describe, expect, it } from 'vitest';
import { createControlLabelRef, type Prototype } from '@proto.ui/core';
import type { ControlLabelPlan, PeerToHostMessage, WireRecord } from '@proto.ui/host-protocol';
import { labelRoot } from '@proto.ui/prototypes-base/label';
import { checkboxRoot } from '@proto.ui/prototypes-base/checkbox';
import { switchRoot } from '@proto.ui/prototypes-base/switch';
import { createPeerSession, type PeerSession } from '../src/session';
import { createNativeScopeLedger, createNativeA11yLedger } from '../src/control-label';
import { ScriptedHost } from './scripted-host';

// A scripted native boundary proves real Runtime/Prototype semantics. It is
// deliberately separate from the real Rust/GPUI and OS-accessibility evidence.
const sessions: PeerSession[] = [];
afterEach(async () => {
  for (const session of sessions.splice(0).reverse()) await session.dispose();
});

function pairHarness() {
  const scope = createNativeScopeLedger();
  const nativeA11yId = createNativeA11yLedger();
  let nextView = 0;
  const create = async (
    id: string,
    prototype: Prototype<any>,
    props: WireRecord = {},
    tree = 'window:1/tree:1'
  ) => {
    const host = new ScriptedHost(id);
    let plan: ControlLabelPlan | null = null;
    let viewRevision = 0;
    let sequence = 0;
    let peer: PeerSession;
    const receive = (message: PeerToHostMessage) => {
      host.receive(message);
      if (message.kind === 'control-label.plan') {
        plan = message.plan;
        if (plan) {
          viewRevision = ++nextView;
          peer.handle({
            kind: 'control-label.view',
            sessionId: id,
            viewEpoch: message.viewEpoch,
            leaseId: plan.leaseId,
            revision: viewRevision,
            view: {
              identity: `${id}:surface:${message.viewEpoch}`,
              scope: tree,
              authoredName: false,
            },
          });
        }
      }
    };
    peer = createPeerSession({
      sessionId: id,
      instanceId: id,
      prototype,
      props,
      nativeScope: scope,
      nativeA11yId,
      send: receive,
      schedule: (task) => task(),
    });
    host.bind((message) => peer.handle(message));
    sessions.push(peer);
    await peer.mount();
    return {
      host,
      peer,
      activate(source: 'pointer' | 'accessibility' = 'pointer') {
        if (!plan) throw new Error('no Label lease');
        peer.handle({
          kind: 'control-label.activate',
          sessionId: id,
          viewEpoch: peer.snapshot().viewEpoch,
          leaseId: plan.leaseId,
          viewRevision,
          sequence: ++sequence,
          source,
        });
      },
    };
  };
  return { create };
}

describe('GPUI peer: real Label and existing control owners', () => {
  it.each([
    ['Checkbox', checkboxRoot],
    ['Switch', switchRoot],
  ] as const)(
    'names %s by the rendered Label and activates its existing owner exactly once',
    async (_, prototype) => {
      const h = pairHarness();
      const label = await h.create('label', labelRoot, { activation: true });
      const target = await h.create('target', prototype);
      const ref = createControlLabelRef();
      label.peer.setAssociations({ controlLabel: ref });
      target.peer.setAssociations({ controlLabel: ref });
      const name = target.host.last('a11y.snapshot')?.snapshot;
      expect(name?.relations.labelledBy).toEqual([
        label.host.last('projection.install')!.transaction.a11y!.semanticObjectId,
      ]);
      expect(name?.name).not.toMatchObject({ kind: 'text' });
      label.activate();
      expect(
        target.host.of('expose.signal').filter((m) => m.name === 'checkedChange')
      ).toHaveLength(1);
      expect(target.host.last('expose.state')).toMatchObject({ name: 'checked', value: true });
      expect(target.host.of('focus.request')).toHaveLength(1);
      expect(label.host.of('projection.install')[0]!.transaction.focus.targets).toEqual([
        { ref: 'focus-root', sequential: false, programmatic: false },
      ]);
    }
  );

  it('keeps disabled naming while rejecting activation and focus, then supports a native accessibility source', async () => {
    const h = pairHarness();
    const label = await h.create('label', labelRoot, { activation: true });
    const target = await h.create('target', checkboxRoot, { disabled: true });
    const ref = createControlLabelRef();
    label.peer.setAssociations({ controlLabel: ref });
    target.peer.setAssociations({ controlLabel: ref });
    expect(target.host.last('a11y.snapshot')?.snapshot?.relations.labelledBy).toEqual([
      label.host.last('projection.install')!.transaction.a11y!.semanticObjectId,
    ]);
    label.activate();
    expect(target.host.of('expose.signal')).toHaveLength(0);
    expect(target.host.of('focus.request')).toHaveLength(0);
    target.peer.setProps({ disabled: false });
    label.activate('accessibility');
    expect(target.host.of('expose.signal').filter((m) => m.name === 'checkedChange')).toHaveLength(
      1
    );
  });

  it('keeps controlled state and withdraws the old association on replacement', async () => {
    const h = pairHarness();
    const label = await h.create('label', labelRoot, { activation: true });
    const target = await h.create('target', checkboxRoot, { checked: false });
    const ref = createControlLabelRef();
    label.peer.setAssociations({ controlLabel: ref });
    target.peer.setAssociations({ controlLabel: ref });
    label.activate();
    expect(target.host.of('expose.signal').filter((m) => m.name === 'checkedChange')).toHaveLength(
      1
    );
    expect(
      (
        target.host.last('a11y.snapshot')?.snapshot ??
        target.host.last('projection.install')!.transaction.a11y
      )?.states.checked
    ).toBe('false');
    target.peer.setAssociations({ controlLabel: null });
    label.activate();
    expect(target.host.of('expose.signal').filter((m) => m.name === 'checkedChange')).toHaveLength(
      1
    );
    expect(target.host.last('a11y.snapshot')?.snapshot?.relations.labelledBy ?? null).toBeNull();
  });

  it('never equates a shared association or logical root with a verified native tree', async () => {
    const h = pairHarness();
    const label = await h.create('label', labelRoot, { activation: true }, 'window:1/tree:1');
    const target = await h.create('target', checkboxRoot, {}, 'window:2/tree:1');
    const ref = createControlLabelRef();
    label.peer.setAssociations({ controlLabel: ref });
    target.peer.setAssociations({ controlLabel: ref });
    label.activate();
    expect(target.host.of('expose.signal')).toHaveLength(0);
    expect(target.host.of('focus.request')).toHaveLength(0);
    expect(target.host.last('a11y.snapshot')?.snapshot?.relations.labelledBy ?? null).toBeNull();
  });
});
