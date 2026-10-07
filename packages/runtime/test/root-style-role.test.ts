import { describe, expect, it } from 'vitest';
import {
  definePrototype,
  tw,
  type EffectsPort,
  type OwnedStateHandle,
  type StyleHandle,
} from '@proto.ui/core';
import { readRootStyleEntries } from '@proto.ui/core/internal';
import { EFFECTS_CAP, type FeedbackPort } from '@proto.ui/module-feedback';
import { createRuntimeSession, type RuntimeHost } from '../src';

// D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001 G/H: actual session, Rule and mount epochs.
describe('Runtime Root style roles', () => {
  it('retains Rule/patch origins, replays to a fresh port before commit, and disposes', async () => {
    let active!: OwnedStateHandle<boolean>;
    let setupCount = 0;
    const proto = definePrototype({
      name: 'root-role-session',
      setup(def) {
        setupCount++;
        active = def.state.bool('active', false);
        def.feedback.style.use(tw('w-2 bg-white'));
        def.rule({
          when: (w) => w.state(active).eq(true),
          intent: (i) => i.feedback.style.use(tw('w-full')),
        });
        return (r) => r.el('span', { style: tw('w-4') }, 'content');
      },
    });
    const first: StyleHandle[] = [];
    const second: StyleHandle[] = [];
    let current = first;
    const atCommit: StyleHandle[] = [];
    const port = (target: StyleHandle[]): EffectsPort => ({
      queueStyle: (h) => target.push(h),
      requestFlush() {},
    });
    const host: RuntimeHost<any> = {
      prototypeName: proto.name,
      getRawProps: () => ({}),
      schedule: (task) => task(),
      commit(_children, signal) {
        atCommit.push(current.at(-1)!);
        signal?.done();
      },
      onRuntimeReady: (wiring) => wiring.attach('feedback', [[EFFECTS_CAP, port(first)]]),
    };
    const session = createRuntimeSession(proto, host);
    const entries = () => readRootStyleEntries(current.at(-1)!, 'setup');
    const feedback = session.caps.getPort<FeedbackPort>('feedback')!;
    await session.mount();
    expect(entries()[0]).toMatchObject({ token: 'w-2', role: 'placement', origin: 'setup' });
    session.invokeInCallbackScope(() => active.set(true));
    expect(entries()[0]).toMatchObject({ token: 'w-full', role: 'placement', origin: 'rule' });
    session.invokeInCallbackScope(() => feedback.patchStyle(tw('w-8')));
    expect(entries().at(-1)).toMatchObject({ token: 'w-8', role: 'placement', origin: 'runtime' });
    session.invokeInCallbackScope(() => feedback.suppressStyle(tw('w-1')));
    expect(current.at(-1)!.tokens).toEqual(['bg-white']);
    session.invokeInCallbackScope(() => feedback.clearStylePatch());
    expect(entries()[0]).toMatchObject({ token: 'w-full', origin: 'rule' });
    session.invokeInCallbackScope(() => active.set(false));
    expect(entries()[0]).toMatchObject({ token: 'w-2', origin: 'setup' });
    await session.unmount();
    const firstCount = first.length;
    session.invokeInCallbackScope(() => feedback.patchStyle(tw('w-16')));
    expect(first).toHaveLength(firstCount);
    current = second;
    session.caps.getWiring().attach('feedback', [[EFFECTS_CAP, port(second)]]);
    await session.mount();
    expect(readRootStyleEntries(atCommit.at(-1)!, 'setup').at(-1)).toMatchObject({
      token: 'w-16',
      origin: 'runtime',
    });
    expect(first).toHaveLength(firstCount);
    expect(setupCount).toBe(1);
    await session.dispose();
    expect(session.instancePhase).toBe('disposed');
  });
});
