import { describe, expect, it, vi } from 'vitest';
import { tw, type RuleHandle, type RuleSpec, type StyleHandle } from '@proto.ui/core';
import { CapsVault, SYS_CAP } from '@proto.ui/module-base';
import { createRuleModule } from '@proto.ui/module-rule';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import { createRuntimeSession } from '../../src';

const rule: RuleSpec<Record<string, unknown>> = {
  when: (w) => w.t(),
  intent: (i) => i.feedback.style.use(tw('opacity-50')),
};

describe('T-RULE-0001: setup cancellation boundary', () => {
  it('removes only the setup contribution and rejects retained handles from created onward', async () => {
    let retained!: RuleHandle;
    let removed!: RuleHandle;
    let declare!: () => RuleHandle;
    const styles: StyleHandle[] = [];
    const phases: string[] = [];
    const reject = (phase: string) => {
      phases.push(phase);
      expect(() => retained.dispose()).toThrow();
      expect(() => removed.dispose()).toThrow();
      expect(declare).toThrow();
    };
    const session = createRuntimeSession(
      {
        name: 'rule-setup-cancellation',
        setup(def) {
          removed = def.rule({
            when: (w) => w.t(),
            intent: (i) => i.feedback.style.use(tw('bg-red-500')),
          });
          removed.dispose();
          retained = def.rule(rule);
          declare = () => def.rule(rule);
          def.lifecycle.onCreated(() => reject('created'));
          def.lifecycle.onMounted(() => reject('mounted'));
          def.lifecycle.onBeforeDispose(() => reject('beforeDispose'));
          return (r) => {
            reject('render');
            return r.el('div', 'ok');
          };
        },
      },
      {
        prototypeName: 'rule-setup-cancellation',
        getRawProps: () => ({}),
        schedule: (task) => task(),
        commit: (_children, signal) => signal?.done(),
        onRuntimeReady: (wiring) =>
          wiring.attach('feedback', [
            [
              EFFECTS_CAP,
              {
                queueStyle: (style: StyleHandle) => styles.push(style),
                requestFlush: () => {},
              },
            ],
          ]),
      }
    );
    expect(phases).toEqual(['created']);
    await session.mount();
    expect(styles.at(-1)?.tokens).toEqual(['opacity-50']);
    await session.unmount();
    reject('detached');
    await session.mount();
    expect(styles.at(-1)?.tokens).toEqual(['opacity-50']);
    await session.dispose();
    reject('disposed');
    expect(phases).toEqual([
      'created',
      'render',
      'mounted',
      'detached',
      'render',
      'mounted',
      'beforeDispose',
      'disposed',
    ]);
  });

  it('guards the direct Module facade before declaration callbacks or removal mutate IR', () => {
    let setup = true;
    const ensureSetup = () => {
      if (!setup) throw new Error('setup only');
    };
    const caps = new CapsVault();
    caps.attachBase([[SYS_CAP, { ensureSetup }]]);
    const module = createRuleModule<Record<string, unknown>>({
      init: { prototypeName: 'rule-direct-cancellation', declarations: [] },
      caps,
      deps: {
        requireFacade() {
          throw new Error('unused');
        },
        requirePort() {
          throw new Error('unused');
        },
        tryFacade: () => undefined,
        tryPort: () => undefined,
      },
    });
    const removed = module.facade.rule(rule);
    const retained = module.facade.rule(rule);
    removed.dispose();
    expect(module.port.exportIR().map((r) => r.id)).toEqual([retained.id]);
    setup = false;
    const when = vi.fn(rule.when);
    expect(() => module.facade.rule({ ...rule, when })).toThrow();
    expect(when).not.toHaveBeenCalled();
    expect(() => retained.dispose()).toThrow();
    expect(module.port.exportIR().map((r) => r.id)).toEqual([retained.id]);
    module.hooks.dispose?.();
  });
});
