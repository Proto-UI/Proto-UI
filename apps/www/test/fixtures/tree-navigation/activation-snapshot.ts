import type { A11ySemanticObjectSnapshot, Prototype } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { treeRoot, treeItem } from '@proto.ui/prototypes-base/tree';
function portableHarness() {
  const parents = new Map<EventTarget, EventTarget | null>();
  const protos = new Map<EventTarget, Prototype<any, any>>();
  const sessions: ReturnType<typeof createRuntimeSession>[] = [];
  function make(proto: Prototype<any, any>, parent: EventTarget | null = null, props = {}) {
    const target = new EventTarget();
    parents.set(target, parent);
    protos.set(target, proto);
    let exposes: any;
    let semantics: A11ySemanticObjectSnapshot | undefined;
    const events: Array<{ name: string; payload: unknown }> = [];
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => props,
      schedule: (fn) => fn(),
      scheduleDelay: (ms, fn) => {
        const id = setTimeout(fn, ms);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(w) {
        w.attach('a11y', [
          [
            A11Y_PROJECT_CAP,
            (snapshot: A11ySemanticObjectSnapshot) => {
              semantics = snapshot;
            },
          ],
        ]);
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, (t: EventTarget) => parents.get(t) ?? null],
          [ANATOMY_GET_PROTO_CAP, (t: EventTarget) => protos.get(t)],
          [ANATOMY_ROOT_TARGET_CAP, (t: EventTarget) => t],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, (t: EventTarget) => parents.get(t) ?? null],
        ]);
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => target],
        ]);
        w.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, (t: EventTarget) => parents.get(t) ?? null],
          [AS_TRIGGER_GET_PROTO_CAP, (t: EventTarget) => protos.get(t)],
        ]);
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (value: unknown) => {
              exposes = value;
            },
          ],
        ]);
        w.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string, payload: unknown) => events.push({ name, payload }),
          ],
        ]);
      },
    });
    sessions.push(session);
    return {
      session,
      target,
      events,
      get exposes() {
        return exposes;
      },
      get semantics() {
        return semantics;
      },
    };
  }
  return {
    make,
    async dispose() {
      for (const session of sessions.reverse()) await session.dispose();
    },
  };
}

// A separate portable Runtime probe, not a browser accessibility-tree or GPUI AT claim.
export async function activationSnapshot() {
  const harness = portableHarness();
  try {
    const root = harness.make(treeRoot);
    await root.session.mount();
    const item = harness.make(treeItem, root.target, { nodeKey: 'probe' });
    await item.session.mount();
    return { role: item.semantics?.role, actions: item.semantics?.actions };
  } finally {
    await harness.dispose();
  }
}
