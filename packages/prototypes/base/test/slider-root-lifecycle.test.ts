import { expect, it } from 'vitest';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { sliderRoot } from '../src/slider';

function fixture() {
  const token = {};
  let exposes: Record<string, any> = {};
  const events: string[] = [];
  const host: RuntimeHost<any> = {
    prototypeName: sliderRoot.name,
    getRawProps: () => ({ defaultValue: 50 }),
    commit(_commit, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(wiring) {
      wiring.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, token],
        [ANATOMY_PARENT_CAP, () => null],
        [ANATOMY_GET_PROTO_CAP, () => sliderRoot],
      ]);
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, token],
        [CONTEXT_PARENT_CAP, () => null],
      ]);
      wiring.attach('expose-state', [
        [
          EXPOSE_STATE_SET_EXPOSES_CAP,
          (next: Record<string, any>) => {
            exposes = next;
          },
        ],
      ]);
      wiring.attach('expose-event', [[EXPOSE_EVENT_SINK_CAP, (name: string) => events.push(name)]]);
    },
  };
  const session = createRuntimeSession(sliderRoot, host);
  return {
    session,
    events,
    get x() {
      return exposes;
    },
  };
}

it('live scalar Slider publishes policy, orientation and ratio updates', async () => {
  const f = fixture();
  await f.session.mount();
  try {
    f.session.controller.applyRawProps({
      defaultValue: 50,
      disabled: true,
      readOnly: true,
      orientation: 'vertical',
      max: 200,
    });
    expect(f.x.disabled.get()).toBe(true);
    expect(f.x.readOnly.get()).toBe(true);
    expect(f.x.orientation.get()).toBe('vertical');
    expect(f.x.percentage.get()).toBe(25);
  } finally {
    await f.session.dispose();
  }
});

for (const mounted of [false, true])
  for (const [point, update] of [
    ['disabled', { disabled: true }],
    ['readOnly', { readOnly: true }],
    ['orientation', { orientation: 'vertical' }],
    ['percentage', { max: 200 }],
    ['value', { value: 60 }],
  ] as const)
    it(`scalar Slider stops publication after terminal retirement during ${point}, mounted=${mounted}`, async () => {
      const f = fixture();
      if (mounted) await f.session.mount();
      let retired = false;
      const afterRetirement: string[] = [];
      for (const name of ['disabled', 'readOnly', 'orientation', 'percentage'])
        f.x[name].subscribe((event: any) => {
          if (event.type === 'next' && retired) afterRetirement.push(name);
        });
      f.x[point].subscribe((event: any) => {
        if (event.type === 'next' && !retired) {
          retired = true;
          f.session.dispose();
        }
      });
      try {
        expect(() => f.session.controller.applyRawProps(update)).not.toThrow();
        expect(retired).toBe(true);
        expect(afterRetirement).toEqual([]);
      } finally {
        await f.session.dispose();
      }
    });

for (const method of ['requestValue', 'resetValue'])
  it(`scalar Slider ${method} stops its caller after publication retires the owner`, async () => {
    const f = fixture();
    await f.session.mount();
    try {
      if (method === 'resetValue') f.session.invokeInCallbackScope(() => f.x.requestValue(60));
      f.events.length = 0;
      let retired = false;
      f.x.percentage.subscribe((event: any) => {
        if (event.type === 'next' && !retired) {
          retired = true;
          f.session.dispose();
        }
      });
      expect(f.session.invokeInCallbackScope(() => f.x[method](60))).toBe(false);
      expect(retired).toBe(true);
      expect(f.events).toEqual([]);
    } finally {
      await f.session.dispose();
    }
  });
