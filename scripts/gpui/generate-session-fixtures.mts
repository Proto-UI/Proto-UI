/**
 * Records what the real GPUI peer sends for Base Prototype sessions, for the
 * Rust host to render and replay.
 *
 * Each session runs `createPeerSession` from `packages/adapters/gpui-peer`
 * against a Prototype from `@proto.ui/prototypes-base`, with a minimal host
 * that applies every projection. Nothing here restates what a Prototype
 * projects: the template, the event registrations, the focus plan and the
 * accessibility snapshot are whatever the peer produced.
 *
 *   pnpm gpui:session-fixtures            # write
 *   pnpm check:gpui-session-fixtures      # verify they are current
 *
 * `--dir <path>` reads and writes the fixtures somewhere else, which lets a
 * test prove that a stale fixture actually fails the check instead of
 * asserting that it would.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Prototype } from '@proto.ui/core';
import button from '@proto.ui/prototypes-base/button';
import { switchRoot, switchThumb } from '@proto.ui/prototypes-base/switch';
import toggle from '@proto.ui/prototypes-base/toggle';
import type { PeerToHostMessage, WireRecord } from '@proto.ui/host-protocol';

import { createPeerSession, type PeerSession } from '../../packages/adapters/gpui-peer/src/session';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_DIR = path.join(ROOT, 'native/gpui/fixtures');

/** The surface the peer waits for before it treats its focus target as ready. */
const READY_SURFACE = 'proto-surface';

type SessionSpec = {
  readonly id: string;
  readonly prototype: Prototype<any>;
  readonly props: WireRecord;
  /** The session, by name, that this one opens inside. It is recorded first. */
  readonly parent?: string;
};

type Recording = {
  readonly file: string;
  readonly name: string;
  readonly module: string;
  /** Each session, by the name tests use, in the order they open. */
  readonly sessions: { readonly [name: string]: SessionSpec };
};

const RECORDINGS: readonly Recording[] = [
  {
    file: 'base-button-session.json',
    name: 'Base Button',
    module: '@proto.ui/prototypes-base/button',
    sessions: {
      enabled: { id: 'button-enabled', prototype: button, props: {} },
      disabled: { id: 'button-disabled', prototype: button, props: { disabled: true } },
    },
  },
  {
    file: 'base-toggle-session.json',
    name: 'Base Toggle',
    module: '@proto.ui/prototypes-base/toggle',
    sessions: {
      inactive: { id: 'toggle-inactive', prototype: toggle, props: {} },
      active: { id: 'toggle-active', prototype: toggle, props: { defaultActive: true } },
      disabled: { id: 'toggle-disabled', prototype: toggle, props: { disabled: true } },
    },
  },
  {
    file: 'base-switch-session.json',
    name: 'Base Switch',
    module: '@proto.ui/prototypes-base/switch',
    sessions: {
      root: { id: 'switch-root', prototype: switchRoot, props: {} },
      thumb: { id: 'switch-thumb', prototype: switchThumb, props: {}, parent: 'root' },
    },
  },
];

/**
 * Runs one session to its first activation and returns everything the peer
 * sent, with the session itself for any that open inside it.
 */
async function record(
  spec: SessionSpec,
  parent: PeerSession | undefined
): Promise<{ sent: PeerToHostMessage[]; peer: PeerSession }> {
  const sessionId = spec.id;
  const sent: PeerToHostMessage[] = [];
  const pending: Array<() => void> = [];
  const peer: PeerSession = createPeerSession({
    sessionId,
    instanceId: `${sessionId}:instance`,
    prototype: spec.prototype,
    props: spec.props,
    parent,
    send: (message) => {
      sent.push(message);
      if (message.kind !== 'projection.install') return;
      const { transaction } = message;
      // Acknowledge after the install returns, as a host across a transport would.
      pending.push(() =>
        peer.handle({
          kind: 'projection.ack',
          ack: {
            sessionId: transaction.sessionId,
            viewEpoch: transaction.viewEpoch,
            commitId: transaction.commitId,
            status: 'applied',
            readySurfaces: [READY_SURFACE],
            diagnostics: [],
          },
        })
      );
    },
    schedule: (task) => task(),
  });
  await peer.mount();
  while (pending.length > 0) pending.shift()!();
  return { sent, peer };
}

function optionPath(argv: readonly string[], flag: string, fallback: string): string {
  const at = argv.indexOf(flag);
  if (at === -1) return fallback;
  const value = argv[at + 1];
  if (!value) throw new Error(`${flag} needs a path`);
  return path.resolve(ROOT, value);
}

function compare(label: string, target: string, expected: string): boolean {
  let actual: string;
  try {
    actual = readFileSync(target, 'utf8');
  } catch {
    console.error(`[gpui:session-fixtures] ${path.relative(ROOT, target)} is missing`);
    return false;
  }
  if (actual === expected) {
    console.log(`[gpui:session-fixtures] ${path.relative(ROOT, target)} is current (${label})`);
    return true;
  }
  console.error(
    `[gpui:session-fixtures] ${path.relative(ROOT, target)} is stale; ` +
      'run `pnpm gpui:session-fixtures`'
  );
  return false;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const dir = optionPath(argv, '--dir', DEFAULT_DIR);
  for (const recording of RECORDINGS) {
    const sessions: { [name: string]: PeerToHostMessage[] } = {};
    const opened: { [name: string]: PeerSession } = {};
    for (const [name, spec] of Object.entries(recording.sessions)) {
      const parent = spec.parent === undefined ? undefined : opened[spec.parent];
      if (spec.parent !== undefined && !parent) {
        throw new Error(`${recording.name}: ${name} opens inside ${spec.parent}, recorded later`);
      }
      const { sent, peer } = await record(spec, parent);
      sessions[name] = sent;
      opened[name] = peer;
    }
    const fixture = {
      note:
        'Generated by scripts/gpui/generate-session-fixtures.mts by running the real ' +
        `GPUI peer against ${recording.name}. Do not edit.`,
      prototype: recording.module,
      readySurface: READY_SURFACE,
      /** Every message the peer sent, in order, up to and including activation. */
      sessions,
    };

    const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
    const out = path.join(dir, recording.file);
    const label = Object.entries(sessions)
      .map(([name, messages]) => `${name}: ${messages.length} messages`)
      .join(', ');

    if (argv.includes('--check')) {
      if (!compare(label, out, serialized)) process.exitCode = 1;
      continue;
    }
    writeFileSync(out, serialized);
    console.log(`[gpui:session-fixtures] wrote ${path.relative(ROOT, out)}: ${label}`);
  }
}

// Only run when executed directly; a test imports `main` instead.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
