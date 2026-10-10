import { expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { resizableRoot } from '../src/resizable';

it('Resizable clears request history on view detach while retaining the same controlled owner', async () => {
  let setupCount = 0;
  let exposes: Record<string, any> = {};
  const token = {};
  const requests: number[] = [],
    commits: number[] = [];
  const proto = definePrototype({
    ...resizableRoot,
    name: 'resizable-request-lifetime',
    setup(def) {
      setupCount++;
      return resizableRoot.setup(def);
    },
  });
  const host: RuntimeHost<any> = {
    prototypeName: proto.name,
    getRawProps: () => ({ value: 50 }),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, token],
        [ANATOMY_PARENT_CAP, () => null],
        [ANATOMY_GET_PROTO_CAP, () => proto],
      ]);
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, token],
        [CONTEXT_PARENT_CAP, () => null],
      ]);
      wiring.attach('expose-event', [
        [
          EXPOSE_EVENT_SINK_CAP,
          (name: string, payload: any) => {
            if (name === 'valueChange') requests.push(payload.value);
            if (name === 'valueCommit') commits.push(payload.value);
          },
        ],
      ]);
      wiring.attach('expose-state', [
        [
          EXPOSE_STATE_SET_EXPOSES_CAP,
          (next: Record<string, unknown>) => {
            exposes = next;
          },
        ],
      ]);
    },
  };
  const session = createRuntimeSession(proto, host);
  try {
    await session.mount();
    session.invokeInCallbackScope(() => exposes.requestValue(60));
    expect(requests).toEqual([60]);
    expect(exposes.value.get()).toBe(50);
    await session.unmount();
    expect(session.invokeInCallbackScope(() => exposes.requestValue(70, true))).toBe(false);
    expect(requests).toEqual([60]);
    expect(commits).toEqual([]);
    await session.mount();
    session.invokeInCallbackScope(() => exposes.requestValue(60, true));
    expect(setupCount).toBe(1);
    expect(requests).toEqual([60, 60]);
    expect(commits).toEqual([60]);
    expect(exposes.value.get()).toBe(50);
  } finally {
    session.dispose();
  }
});
