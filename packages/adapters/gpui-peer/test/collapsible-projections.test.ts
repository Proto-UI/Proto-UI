import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { WireRecord } from '@proto.ui/host-protocol';
import { COLLAPSIBLE_PROJECTIONS } from '../../base/test/fixtures/collapsible-projections';
import { createPeerSession, type PeerSession } from '../src/session';
import { ScriptedHost } from './scripted-host';

async function flush() {
  for (let i = 0; i < 16; i++) await Promise.resolve();
}

function open(
  id: string,
  prototype: Prototype<any, any>,
  props: WireRecord = {},
  parent?: PeerSession
) {
  const host = new ScriptedHost(id, { readySurfaces: ['proto-surface'] });
  const peer = createPeerSession({
    sessionId: id,
    instanceId: `${id}:instance`,
    prototype,
    props,
    parent,
    send: (message) => host.receive(message),
    schedule: (task) => task(),
  });
  host.bind((message) => peer.handle(message));
  return { host, peer };
}

// These execute the real peer against its deterministic transport model.
// They do not claim Rust paint, native system input, optical material or GPUI parity.
for (const [family, parts] of COLLAPSIBLE_PROJECTIONS) {
  describe(`${family}: Collapsible native transport fixture`, () => {
    for (const keepMounted of [false, true]) {
      it(`keeps three real parts and repeated disclosure epochs (keepMounted=${keepMounted})`, async () => {
        const root = open(`${family}-root-${keepMounted}`, parts.collapsibleRoot);
        await root.peer.mount();
        const trigger = open(
          `${family}-trigger-${keepMounted}`,
          parts.collapsibleTrigger,
          {},
          root.peer
        );
        await trigger.peer.mount();
        const content = open(
          `${family}-content-${keepMounted}`,
          parts.collapsibleContent,
          { keepMounted },
          root.peer
        );
        await content.peer.mount();
        try {
          expect(trigger.host.exposeState('expanded')).toBe(false);
          expect(content.host.exposeState('hidden')).toBe(true);
          expect(trigger.host.lastA11y()?.role).toBe('button');
          expect(content.host.lastA11y()?.role).toBeUndefined();
          for (let cycle = 0; cycle < 2; cycle++) {
            trigger.host.input('press.commit');
            await flush();
            expect(root.host.exposeState('open')).toBe(true);
            expect(trigger.host.exposeState('expanded')).toBe(true);
            expect(content.host.exposeState('hidden')).toBe(false);
            trigger.host.input('press.commit');
            await flush();
            expect(root.host.exposeState('open')).toBe(false);
            expect(content.host.exposeState('hidden')).toBe(true);
          }
          expect(
            root.host.of('expose.signal').filter((event) => event.name === 'openChange')
          ).toHaveLength(4);
          expect(content.host.of('session.disposed')).toHaveLength(0);
          if (!keepMounted) expect(content.host.of('projection.detach')).toHaveLength(2);
          else expect(content.host.of('projection.detach')).toHaveLength(0);
        } finally {
          await root.peer.dispose();
        }
        expect(trigger.host.of('session.disposed')).toHaveLength(1);
        expect(content.host.of('session.disposed')).toHaveLength(1);
      });
    }
    it('keeps controlled refusal, acceptance and disabled states on the same owner', async () => {
      const root = open(`${family}-controlled-root`, parts.collapsibleRoot, { open: false });
      await root.peer.mount();
      const trigger = open(`${family}-controlled-trigger`, parts.collapsibleTrigger, {}, root.peer);
      await trigger.peer.mount();
      const content = open(
        `${family}-controlled-content`,
        parts.collapsibleContent,
        { keepMounted: true },
        root.peer
      );
      await content.peer.mount();
      try {
        trigger.host.input('press.commit');
        await flush();
        expect(root.host.exposeState('open')).toBe(false);
        expect(content.host.exposeState('hidden')).toBe(true);
        expect(
          root.host.of('expose.signal').filter((event) => event.name === 'openChange')
        ).toHaveLength(1);
        root.peer.setProps({ open: true, disabled: true });
        await flush();
        expect(root.host.exposeState('open')).toBe(true);
        expect(trigger.host.exposeState('disabled')).toBe(true);
        expect(content.host.exposeState('hidden')).toBe(false);
        trigger.host.input('pointer.down');
        trigger.host.input('press.commit');
        await flush();
        expect(trigger.host.exposeState('pressed')).toBe(false);
        expect(
          root.host.of('expose.signal').filter((event) => event.name === 'openChange')
        ).toHaveLength(1);
      } finally {
        await root.peer.dispose();
      }
    });
  });
}
