import { expect, it } from 'vitest';
import { definePrototype, tw } from '@proto.ui/core';
import { createRuntimeSession, type RuntimeHost } from '../../src';
it('reevaluates a generic numeric prop threshold and withdraws its contribution through the runtime', async () => {
  const proto = definePrototype<{ width?: number }>({
    name: 'runtime-generic-gte',
    setup(def) {
      def.props.define({ width: { type: 'number', default: 0 } });
      def.feedback.style.use(tw('text-base'));
      def.rule({
        when: (w) => w.prop('width').gte(768),
        intent: (i) => i.feedback.style.use(tw('text-sm')),
      });
      return () => null;
    },
  });
  const host: RuntimeHost<any> = {
    prototypeName: proto.name,
    getRawProps: () => ({ width: 767 }),
    commit: (_children, signal) => signal?.done(),
    schedule: (task) => task(),
  };
  const session = createRuntimeSession(proto, host);
  await session.mount();
  expect(session.controller.getRuleStyleTokens()).toEqual([]);
  session.controller.applyRawProps({ width: 768 });
  expect(session.controller.getRuleStyleTokens()).toEqual(['text-sm']);
  session.controller.applyRawProps({ width: 767 });
  expect(session.controller.getRuleStyleTokens()).toEqual([]);
  await session.dispose();
});
