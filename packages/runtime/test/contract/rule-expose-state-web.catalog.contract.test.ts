import { expect, it } from 'vitest';
import { HOST_ELEMENT_CAP, tw, type OwnedStateHandle, type StyleHandle } from '@proto.ui/core';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import type { RulePort } from '@proto.ui/module-rule';
import { EXPOSE_STATE_WEB_MAP_CAP } from '@proto.ui/module-expose-state-web';
import { createRuntimeSession } from '../../src';
it('T-RULE-EXPOSE-STATE-WEB-0001-CASE-RUNTIME: rebuilds selector contributions for the next view without recreating State', async () => {
  let state!: OwnedStateHandle<boolean>;
  let setups = 0,
    name = 'open';
  const host = document.createElement('div');
  const styles: StyleHandle[] = [];
  const session = createRuntimeSession(
    {
      name: 'rule-web-epochs',
      setup(def) {
        setups++;
        state = def.state.bool('open', true);
        def.expose.state('open', state);
        def.rule({
          when: (w) => w.state(state).eq(true),
          intent: (i) => i.feedback.style.use(tw('opacity-50')),
        });
        return (r) => r.el('span', 'stable');
      },
    },
    {
      prototypeName: 'rule-web-epochs',
      getRawProps: () => ({}),
      schedule: (f) => f(),
      commit: (_c, s) => s?.done(),
      onRuntimeReady(w) {
        w.attach('feedback', [
          [EFFECTS_CAP, { queueStyle: (s: StyleHandle) => styles.push(s), requestFlush() {} }],
        ]);
        w.attach('expose-state-web', [
          [HOST_ELEMENT_CAP, host],
          [EXPOSE_STATE_WEB_MAP_CAP, () => ({ dataAttr: 'data-' + name, cssVar: '--pui-' + name })],
        ]);
      },
    }
  );
  const rule = session.caps.getPort<RulePort<Record<string, unknown>>>('rule')!;
  try {
    await session.mount();
    expect(styles.at(-1)?.tokens).toEqual(['data-[open]:opacity-50']);
    for (const next of ['next', 'last']) {
      await session.unmount();
      expect(rule.evaluate({ props: {} })).toMatchObject({ plan: { tokens: ['opacity-50'] } });
      name = next;
      await session.mount();
      expect(styles.at(-1)?.tokens).toEqual([`data-[${next}]:opacity-50`]);
      expect(host.getAttribute('data-' + next)).toBe('');
    }
    expect(setups).toBe(1);
  } finally {
    await session.dispose();
  }
});
