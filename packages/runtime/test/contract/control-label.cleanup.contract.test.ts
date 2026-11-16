import { describe, expect, it } from 'vitest';
import { createAnatomyFamily, type ControlLabelFacade } from '@proto.ui/core';
import { A11yModuleDef } from '@proto.ui/module-a11y';
import { StateModuleDef } from '@proto.ui/module-state';
import { defineModule } from '@proto.ui/module-base';
import { RuntimeModuleOrchestrator } from '../../src';
import { ControlLabelModuleDef } from '../../../modules/control-label/src/create';
import { CONTROL_LABEL_HOST_CAP } from '../../../modules/control-label/src/caps';
import { acquireAnatomyControlLabelPair } from '../../../modules/control-label/src/anatomy-pair';
import { bindControlLabel } from '../../../modules/control-label/src/registry';

describe('Control Label Runtime terminal cleanup', () => {
  const cases = [
    { stage: 'binding', failure: new Error('first binding cleanup failure') },
    { stage: 'binding', failure: undefined },
    { stage: 'host', failure: null },
    { stage: 'host', failure: false },
    { stage: 'order', failure: 0 },
    { stage: 'order', failure: '' },
  ] as const;

  it.each(cases)(
    'retires all resources and preserves $stage failure $failure',
    ({ stage, failure }) => {
      const family = createAnatomyFamily('terminal-cleanup', {
        roles: {
          root: { cardinality: { min: 1, max: 1 } },
          label: { cardinality: { min: 0, max: 1 } },
          target: { cardinality: { min: 0, max: 1 } },
        },
      });
      const pair = { family, labelRole: 'label', targetRole: 'target' };
      const domain = {},
        scope = {},
        labelView = {},
        targetView = {};
      const calls: string[] = [];
      let fail = false;
      let hostLive = true;
      let nameLive = false;
      let orderLive = false;
      let targetsLive = false;
      let attachments = 0;
      const secondary = new Error('later cleanup failure');
      // The real Runtime owns all module lifetimes. This bounded Anatomy port
      // supplies observable subscription receipts and one stable opaque domain.
      const anatomy = defineModule({
        name: 'anatomy',
        resourceOwnership: 'instance',
        create: () => ({
          name: 'anatomy',
          scope: 'instance',
          facade: {},
          hooks: {},
          port: {
            resolveSelfRole: () => 'label',
            resolveDomainScope: () => domain,
            subscribeOrder: () => {
              orderLive = true;
              return () => {
                calls.push('order');
                orderLive = false;
                if (fail) throw stage === 'order' ? failure : secondary;
              };
            },
            subscribeTargets: () => {
              targetsLive = true;
              return () => {
                calls.push('targets');
                targetsLive = false;
                if (fail) throw secondary;
              };
            },
          },
        }),
      });
      const hub = new RuntimeModuleOrchestrator(
        { prototypeName: 'control-label-cleanup', getPhase: () => 'setup' },
        [StateModuleDef, anatomy, A11yModuleDef, ControlLabelModuleDef]
      );
      hub.getWiring().attach('control-label', [
        [
          CONTROL_LABEL_HOST_CAP,
          {
            attach() {
              attachments++;
              return {
                view: () => (hostLive ? { identity: labelView, scope } : null),
                setActivation() {},
                dispose() {
                  calls.push('host');
                  hostLive = false;
                  hub.dispose();
                  if (fail && stage !== 'order') throw stage === 'host' ? failure : secondary;
                },
              };
            },
          },
        ],
      ]);
      (hub.getFacades()['control-label'] as ControlLabelFacade).label(pair);
      hub.setMountPhase('mounted', 1);
      expect(attachments).toBe(1);
      expect(orderLive && targetsLive).toBe(true);
      const probe = acquireAnatomyControlLabelPair(pair, domain);
      const previousRef = probe.ref;
      probe.dispose();
      const target = bindControlLabel({
        owner: {},
        kind: 'target',
        ref: previousRef,
        semanticRef: {},
        view: () => ({ identity: targetView, scope }),
        options: () => ({ naming: true, activation: false }),
        name: () => {
          nameLive = true;
          return {
            isActive: () => nameLive,
            dispose() {
              calls.push('binding');
              nameLive = false;
              if (fail && stage === 'binding') throw failure;
            },
          };
        },
        activate() {},
        diagnostic() {},
      });
      expect(nameLive).toBe(true);
      fail = true;
      try {
        let threw = false;
        let caught: unknown;
        try {
          hub.dispose();
        } catch (error) {
          threw = true;
          caught = error;
        }
        expect(threw).toBe(true);
        expect(caught).toBe(failure);
        expect(calls).toEqual(['binding', 'host', 'order', 'targets']);
        expect({ nameLive, hostLive, orderLive, targetsLive }).toEqual({
          nameLive: false,
          hostLive: false,
          orderLive: false,
          targetsLive: false,
        });
        // A new receipt must get a new nominal identity, proving that terminal
        // cleanup also released the private reference-counted Anatomy lease.
        const replacement = acquireAnatomyControlLabelPair(pair, domain);
        try {
          expect(replacement.ref).not.toBe(previousRef);
        } finally {
          replacement.dispose();
        }
        hub.dispose();
        expect(calls).toEqual(['binding', 'host', 'order', 'targets']);
        expect(attachments).toBe(1);
      } finally {
        fail = false;
        target.dispose();
        hub.dispose();
      }
    }
  );
});
