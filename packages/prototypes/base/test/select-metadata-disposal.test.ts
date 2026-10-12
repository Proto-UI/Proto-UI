import { expect, it } from 'vitest';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost, type RuntimeSession } from '@proto.ui/runtime';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { selectRoot, selectItem, SELECT_CONTEXT } from '../src/select';

it('a metadata Context subscriber synchronously disposes Item before its props notification returns', async () => {
  const rootToken = new EventTarget(),
    itemToken = new EventTarget(),
    observerToken = new EventTarget();
  let itemSession: RuntimeSession<typeof selectItem> | undefined;
  let armed = false,
    disposed = false;
  const observer = definePrototype({
    name: 'select-metadata-disposal-observer',
    setup(def) {
      def.context.subscribe(SELECT_CONTEXT, () => {
        if (armed && !disposed) {
          disposed = true;
          void itemSession?.dispose();
        }
      });
    },
  });
  const protos = new Map<object, Prototype<any>>([
    [rootToken, selectRoot],
    [itemToken, selectItem],
    [observerToken, observer],
  ]);
  const parent = (token: unknown) =>
    token === itemToken || token === observerToken ? rootToken : null;
  const host = (token: object, raw: Record<string, unknown>): RuntimeHost<any> => ({
    prototypeName: protos.get(token)!.name,
    getRawProps: () => raw,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => token as EventTarget],
        [EVENT_GLOBAL_TARGET_CAP, () => rootToken],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, token],
        [AS_TRIGGER_PARENT_CAP, parent],
        [AS_TRIGGER_GET_PROTO_CAP, (value: unknown) => protos.get(value as object) ?? null],
      ]);
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, token],
        [CONTEXT_PARENT_CAP, parent],
      ]);
      wiring.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, token],
        [ANATOMY_PARENT_CAP, parent],
        [ANATOMY_GET_PROTO_CAP, (value: unknown) => protos.get(value as object) ?? null],
      ]);
    },
  });
  const root = createRuntimeSession(selectRoot, host(rootToken, { open: true, value: 'beta' }));
  const subscriber = createRuntimeSession(observer, host(observerToken, {}));
  itemSession = createRuntimeSession(
    selectItem,
    host(itemToken, { value: 'beta', textValue: 'Beta' })
  );
  await root.mount();
  await subscriber.mount();
  await itemSession.mount();
  armed = true;
  expect(() =>
    itemSession?.controller.applyRawProps({ value: 'beta', textValue: 'Beta', disabled: true })
  ).not.toThrow();
  expect(disposed).toBe(true);
  await subscriber.dispose();
  await root.dispose();
  await itemSession.dispose();
});
