import { expect, it } from 'vitest';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { RULE_META_GET_CAP } from '@proto.ui/module-rule-meta';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import { selectRoot, selectTrigger } from '../src/select';

it('default Trigger dark hover is meta-driven while light and pressed remain upstream-transparent', async () => {
  const rootToken = new EventTarget(),
    triggerToken = new EventTarget();
  let colorScheme = 'light';
  const parent = (token: unknown) => (token === triggerToken ? rootToken : null);
  const host = (token: EventTarget): RuntimeHost<any> => ({
    prototypeName: token === rootToken ? selectRoot.name : selectTrigger.name,
    getRawProps: () => ({}),
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, token],
        [ANATOMY_PARENT_CAP, parent],
        [ANATOMY_GET_PROTO_CAP, (t: unknown) => (t === rootToken ? selectRoot : selectTrigger)],
      ]);
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, token],
        [CONTEXT_PARENT_CAP, parent],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, token],
        [AS_TRIGGER_PARENT_CAP, parent],
        [AS_TRIGGER_GET_PROTO_CAP, (t: unknown) => (t === rootToken ? selectRoot : selectTrigger)],
      ]);
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => token],
        [EVENT_GLOBAL_TARGET_CAP, () => rootToken],
      ]);
      wiring.attach('rule-meta', [
        [RULE_META_GET_CAP, (key: string) => (key === 'colorScheme' ? colorScheme : undefined)],
      ]);
    },
  });
  const root = createRuntimeSession(selectRoot, host(rootToken));
  const trigger = createRuntimeSession(selectTrigger, host(triggerToken));
  await root.mount();
  await trigger.mount();
  const tokens = () => trigger.controller.getRuleStyleTokens();
  expect(tokens()).not.toContain('bg-input/30');
  triggerToken.dispatchEvent(new Event('pointer.enter'));
  expect(tokens()).not.toContain('bg-input/50');
  colorScheme = 'dark';
  expect(tokens()).toContain('bg-input/50');
  triggerToken.dispatchEvent(new Event('pointer.leave'));
  expect(tokens()).not.toContain('bg-input/50');
  expect(tokens()).toContain('bg-input/30');
  triggerToken.dispatchEvent(new Event('pointer.down'));
  expect(tokens()).not.toContain('bg-input/70');
  expect(tokens()).not.toContain('translate-y-px');
  trigger.controller.applyRawProps({ appearance: 'ghost' });
  expect(tokens()).not.toContain('bg-input/30');
  await trigger.dispose();
  await root.dispose();
});
