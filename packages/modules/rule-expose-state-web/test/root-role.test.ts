import { describe, expect, it } from 'vitest';
import {
  definePrototype,
  tw,
  HOST_ELEMENT_CAP,
  type OwnedStateHandle,
  type StyleHandle,
} from '@proto.ui/core';
import { readRootStyleEntries } from '@proto.ui/core/internal';
import { EFFECTS_CAP } from '@proto.ui/module-feedback';
import { createRuntimeSession } from '@proto.ui/runtime';
import { RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP } from '../src';

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 G: exercise the real lowering extension.
describe('Web Rule Root role lowering', () => {
  it('preserves data-state placement provenance while the actual selector context toggles', async () => {
    const queued: StyleHandle[] = [];
    const host = document.createElement('div');
    let checked!: OwnedStateHandle<boolean>;
    const proto = definePrototype({
      name: 'root-role-state-lowering',
      setup(def) {
        checked = def.state.bool('pilot.checked', false);
        def.expose('checked', checked);
        def.rule({
          when: (w) => w.state(checked).eq(true),
          intent: (i) => i.feedback.style.use(tw('w-full bg-white')),
        });
      },
    });
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit(_children, signal) {
        signal?.done();
      },
      onRuntimeReady(wiring) {
        wiring.attach('feedback', [
          [EFFECTS_CAP, { queueStyle: (h: StyleHandle) => queued.push(h), requestFlush() {} }],
        ]);
        wiring.attach('expose-state-web', [[HOST_ELEMENT_CAP, host]]);
      },
    });
    await session.mount();
    expect(host.hasAttribute('data-pilot-checked')).toBe(false);
    const entries = readRootStyleEntries(queued.at(-1)!, 'setup');
    expect(entries[0]).toMatchObject({
      token: 'data-[pilot-checked]:w-full',
      authorToken: 'w-full',
      role: 'placement',
      origin: 'rule',
    });
    session.invokeInCallbackScope(() => checked.set(true));
    expect(host.hasAttribute('data-pilot-checked')).toBe(true);
    expect(readRootStyleEntries(queued.at(-1)!, 'setup')).toEqual(entries);
    session.invokeInCallbackScope(() => checked.set(false));
    expect(host.hasAttribute('data-pilot-checked')).toBe(false);
    expect(readRootStyleEntries(queued.at(-1)!, 'setup')).toEqual(entries);
    await session.dispose();
  });

  it('retains placement, fallback, composite and unresolved roles through dark lowering and replay', async () => {
    const queued: StyleHandle[] = [];
    const proto = definePrototype({
      name: 'root-role-meta-lowering',
      setup(def) {
        def.rule({
          when: (w) => w.meta('colorScheme').eq('dark'),
          intent: (i) => i.feedback.style.use(tw('w-full theme-extension flex translate-x-2')),
        });
      },
    });
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit(_children, signal) {
        signal?.done();
      },
      onRuntimeReady(wiring) {
        wiring.attach('feedback', [
          [
            EFFECTS_CAP,
            {
              queueStyle: (h: StyleHandle) => queued.push(h),
              requestFlush() {},
            },
          ],
        ]);
        wiring.attach('rule-expose-state-web', [
          [RULE_EXPOSE_STATE_WEB_NATIVE_VARIANT_POLICY_CAP, () => false],
        ]);
      },
    });
    await session.mount();
    const last = queued.at(-1)!;
    expect(last.tokens).toEqual([
      'dark:w-full',
      'dark:theme-extension',
      'dark:flex',
      'dark:translate-x-2',
    ]);
    const entries = readRootStyleEntries(last, 'setup');
    expect(entries.map((e) => [e.authorToken, e.role, e.roleSource, e.origin])).toEqual([
      ['w-full', 'placement', 'canonical', 'rule'],
      ['theme-extension', 'surface', 'fallback', 'rule'],
      ['flex', 'composite', 'canonical', 'rule'],
      ['translate-x-2', 'unresolved', 'unresolved', 'rule'],
    ]);
    await session.unmount();
    queued.length = 0;
    await session.mount();
    // Mainline retracts the prior optimization before rebuilding the view.
    // Verify the final projection, not the intermediate cleanup effect.
    expect(readRootStyleEntries(queued.at(-1)!, 'setup')).toEqual(entries);
    await session.dispose();
  });
});
