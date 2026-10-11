import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { WireRecord, WireValue } from '@proto.ui/host-protocol';
import * as base from '@proto.ui/prototypes-base/field';
import * as shadcn from '@proto.ui/prototypes-shadcn/field';
import * as brutalist from '@proto.ui/prototypes-brutalist/field';
import * as bootstrap from '@proto.ui/prototypes-bootstrap-2-3-2/field';
import * as liquid from '@proto.ui/prototypes-liquid-glass/field';
import { createPeerSession, type PeerSession } from '../src/session';
import { createNativeScopeLedger, createNativeA11yLedger } from '../src/control-label';
import { ScriptedHost } from './scripted-host';
const families = { base, shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': liquid };
async function flush() {
  for (let i = 0; i < 16; i++) await Promise.resolve();
}
let serial = 0;
async function fixture(
  name: string,
  family: Pick<
    typeof base,
    | 'fieldRoot'
    | 'fieldLabel'
    | 'fieldControl'
    | 'fieldDescription'
    | 'fieldError'
    | 'fieldValidity'
  >,
  props: WireRecord = {}
) {
  const nativeScope = createNativeScopeLedger(),
    nativeA11yId = createNativeA11yLedger(),
    sessions: PeerSession[] = [];
  const open = async (role: string, props: WireRecord = {}, parent?: PeerSession) => {
    const id = `field-${++serial}-${name}-${role}`,
      host = new ScriptedHost(id, { readySurfaces: ['proto-surface'] });
    const peer = createPeerSession({
      sessionId: id,
      instanceId: id,
      prototype: (family as any)[`field${role[0].toUpperCase()}${role.slice(1)}`] as Prototype<any>,
      props,
      parent,
      nativeScope,
      nativeA11yId,
      send: (message) => host.receive(message),
      schedule: (task) => task(),
    });
    host.bind((message) => peer.handle(message));
    sessions.push(peer);
    await peer.mount();
    let calls = 0;
    return {
      host,
      peer,
      call(method: string, ...args: WireValue[]) {
        host.send({
          kind: 'expose.call',
          sessionId: id,
          callId: `${id}-call-${++calls}`,
          name: method,
          args,
        });
        const result = host.last('expose.result');
        expect(result?.status).toBe('ok');
        return result?.value;
      },
    };
  };
  const root = await open('root', props),
    label = await open('label', {}, root.peer),
    control = await open('control', { value: 'owned' }, root.peer),
    description = await open('description', {}, root.peer),
    error = await open('error', { keepMounted: true }, root.peer),
    validity = await open('validity', {}, root.peer);
  await flush();
  return {
    root,
    label,
    control,
    description,
    error,
    validity,
    open,
    dispose: async () => {
      for (const session of sessions.reverse()) await session.dispose();
    },
  };
}
// Real Proto UI Runtime and peer serialization, with a deterministic host model.
// This file does not install a native TextControl host, Rust/GPUI renderer, OS AT,
// native Label input bridge, or material compositor, and cannot certify them.
for (const [name, family] of Object.entries(families))
  describe(`Field ${name} semantic transport only`, () => {
    it('carries required/readonly/invalid/busy and exact naming/help/error relationships without a native-success claim', async () => {
      const f = await fixture(name, family as any, {
        required: true,
        readOnly: true,
        invalid: true,
        errors: ['Owner error'],
      });
      try {
        const snapshot = f.control.host.lastA11y();
        expect(snapshot?.states).toMatchObject({
          required: true,
          readOnly: true,
          invalid: true,
          busy: false,
        });
        expect(snapshot?.relations.labelledBy).toEqual([f.label.host.lastA11y()!.semanticObjectId]);
        expect(snapshot?.relations.describedBy).toEqual([
          f.description.host.lastA11y()!.semanticObjectId,
        ]);
        expect(snapshot?.relations.errorMessage).toEqual([
          f.error.host.lastA11y()!.semanticObjectId,
        ]);
        f.root.peer.setProps({ required: true, invalid: false });
        await flush();
        expect(f.control.host.lastA11y()?.states.invalid).toBe(false);
        expect(f.control.host.lastA11y()?.relations.errorMessage ?? []).toEqual([]);
        // Existing peer transport has no actual native editor plan; the descriptor is
        // a logical value and must not be relabeled as native editing evidence.
        expect(f.control.host.exposeState('value')).toBe('owned');
        expect(
          JSON.stringify(f.control.host.last('projection.install')?.transaction.template)
        ).not.toContain('input');
        await f.description.peer.dispose();
        await flush();
        expect(f.control.host.lastA11y()?.relations.describedBy ?? []).toEqual([]);
      } finally {
        await f.dispose();
      }
    });
    it('rejects replaced/disabled async results and preserves the same controlled semantic owner', async () => {
      const f = await fixture(name, family as any, { externalValidation: true, invalid: false });
      try {
        const first = f.root.call('validate') as string;
        expect(f.control.host.lastA11y()?.states.busy).toBe(true);
        expect((f.root.call('getValidity') as any).status).toBe('unvalidated');
        f.control.peer.setProps({ value: 'new owner' });
        await flush();
        expect(f.root.call('resolveValidation', first, { invalid: true })).toBe(false);
        const second = f.root.call('validate') as string;
        expect(
          f.root.call('resolveValidation', second, { invalid: true, errors: ['Proposed'] })
        ).toBe(true);
        expect(f.control.host.lastA11y()?.states.invalid).toBe(false);
        expect(f.root.host.last('expose.signal')).toMatchObject({
          name: 'validityChange',
          payload: { invalid: true },
        });
        const third = f.root.call('validate') as string;
        f.root.peer.setProps({ externalValidation: true, disabled: true });
        await flush();
        expect(f.root.call('resolveValidation', third, { invalid: false })).toBe(false);
        expect(f.control.host.lastA11y()?.states.disabled).toBe(true);
        f.root.peer.setProps({ externalValidation: true });
        await flush();
        const retiring = f.root.call('validate') as string;
        await f.control.peer.dispose();
        await flush();
        expect(f.root.call('resolveValidation', retiring, { invalid: false })).toBe(false);
        expect(f.root.call('validate')).toBeNull();
        expect((f.root.call('getValidity') as any).status).toBe('unvalidated');
      } finally {
        await f.dispose();
      }
    });
  });
