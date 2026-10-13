import { describe, expect, it } from 'vitest';
import type { Prototype, A11ySemanticObjectSnapshot } from '@proto.ui/core';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import * as base from '@proto.ui/prototypes-base/select';
import * as shadcn from '@proto.ui/prototypes-shadcn/select';
import { createPeerSession, type PeerSession } from '../src/session';
import { createNativeScopeLedger, createNativeA11yLedger } from '../src/control-label';
import { ScriptedHost } from './scripted-host';

async function flush() {
  for (let i = 0; i < 16; i++) await Promise.resolve();
}
// Real Runtime + GPUI peer wire transport, deterministic host model only.
// No Rust renderer, native accessible tree or OS assistive-technology acceptance.
for (const [family, prototypes] of Object.entries({ base, shadcn })) {
  describe(`GPUI peer ${family} Select structural transport`, () => {
    it('carries isolated semantic-object labelledBy leases and withdraws stale targets', async () => {
      const nativeScope = createNativeScopeLedger();
      const nativeA11yId = createNativeA11yLedger();
      const sessions: PeerSession[] = [];
      let serial = 0;
      const open = async (
        part: 'selectRoot' | 'selectGroup' | 'selectLabel' | 'selectSeparator',
        parent?: PeerSession
      ) => {
        const id = `select-structural-${family}-${++serial}`;
        const host = new ScriptedHost(id, { readySurfaces: ['proto-surface'] });
        const peer = createPeerSession({
          sessionId: id,
          instanceId: id,
          props: {},
          prototype: prototypes[part] as Prototype<any>,
          parent,
          nativeScope,
          nativeA11yId,
          send: (message) => host.receive(message),
          schedule: (task) => task(),
        });
        sessions.push(peer);
        host.bind((message) => peer.handle(message));
        await peer.mount();
        await flush();
        return { peer, host };
      };
      try {
        const root = await open('selectRoot');
        const first = await open('selectGroup', root.peer);
        const label = await open('selectLabel', first.peer);
        const second = await open('selectGroup', root.peer);
        const secondLabel = await open('selectLabel', second.peer);
        const inner = await open('selectGroup', first.peer);
        const innerLabel = await open('selectLabel', inner.peer);
        const nestedRoot = await open('selectRoot', first.peer);
        await open('selectLabel', nestedRoot.peer);
        const separator = await open('selectSeparator', root.peer);
        const names = (group: typeof first) => group.host.lastA11y()?.relations.labelledBy ?? [];
        expect(first.host.lastA11y()?.role).toBe('group');
        const labelId = label.host.lastA11y()!.semanticObjectId;
        expect(names(first)).toEqual([labelId]);
        expect(names(second)).toEqual([secondLabel.host.lastA11y()!.semanticObjectId]);
        expect(names(inner)).toEqual([innerLabel.host.lastA11y()!.semanticObjectId]);
        expect(names(nestedRoot)).toEqual([]);
        expect(nestedRoot.host.lastA11y()?.role).not.toBe('group');
        expect(label.host.lastA11y()?.id).toBeUndefined();
        expect(separator.host.lastA11y()?.role).not.toBe('separator');
        // Tree-hidden transport is independently checked below; it is not a state.
        const duplicate = await open('selectLabel', first.peer);
        expect(names(first)).toEqual([]);
        await duplicate.peer.dispose();
        await flush();
        expect(names(first)).toEqual([labelId]);
        await label.peer.dispose();
        await flush();
        expect(names(first)).toEqual([]); // Inner group and nested Select orphan stay isolated.
        const replacement = await open('selectLabel', first.peer);
        const replacementId = replacement.host.lastA11y()!.semanticObjectId;
        expect(replacementId).not.toBe(labelId);
        expect(names(first)).toEqual([replacementId]);
        expect(names(second)).toEqual([secondLabel.host.lastA11y()!.semanticObjectId]);
        await replacement.peer.dispose();
        await flush();
        expect(names(first)).toEqual([]);
      } finally {
        for (const peer of sessions.reverse()) await peer.dispose();
      }
    });
    it('declares tree-hidden before the peer serialization boundary', async () => {
      const snapshots: A11ySemanticObjectSnapshot[] = [];
      const host: RuntimeHost<any> = {
        prototypeName: `select-separator-source-${family}`,
        getRawProps: () => ({}),
        commit: (_children, signal) => signal?.done(),
        schedule: (task) => task(),
        onRuntimeReady: (wiring) => {
          wiring.attach('anatomy', [
            [ANATOMY_INSTANCE_TOKEN_CAP, {}],
            [ANATOMY_PARENT_CAP, () => null],
            [ANATOMY_GET_PROTO_CAP, () => prototypes.selectSeparator],
          ]);
          wiring.attach('a11y', [
            [
              A11Y_PROJECT_CAP,
              (snapshot: A11ySemanticObjectSnapshot) => {
                snapshots.push(snapshot);
              },
            ],
          ]);
        },
      };
      const runtime = executeWithHost(prototypes.selectSeparator, host);
      try {
        expect(snapshots.at(-1)?.tree?.hidden).toBe(true);
        expect(snapshots.at(-1)?.role).toBeUndefined();
      } finally {
        await runtime.invokeUnmounted();
      }
    });
    // Existing gap: host-protocol/src/wire.ts A11ySnapshotWire has no tree;
    // gpui-peer/src/session.ts serializeA11y omits snapshot.tree. The original
    // failing transport probe is preserved in local evidence. Prototype intent
    // and passing relationship transport above do not prove native hiding.
    it.todo(
      'transports decorative tree.hidden through GPUI peer after its owning capability is implemented'
    );
  });
}
