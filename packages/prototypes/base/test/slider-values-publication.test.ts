import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { sliderValuesRoot, sliderValuesThumb } from '../src/slider';
import { fieldRoot } from '../src/field';
for (const p of [sliderValuesRoot, sliderValuesThumb, fieldRoot]) AdaptToWebComponent(p);
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
const create = (name: string, props: Record<string, unknown>) => {
  const root = document.createElement(name) as any;
  setElementProps(root, props);
  return root;
};
async function fixture(props: Record<string, unknown>) {
  const root = create(sliderValuesRoot.name, props);
  document.body.append(root);
  await flush();
  return { root, x: root.getExposes() };
}
it('synchronous controlled Props feedback is authoritative before idle and does not require receipt attribution', async () => {
  const f = await fixture({ value: [20, 80] }),
    commits: any[] = [];
  f.root.addEventListener('valueCommit', (e: CustomEvent) => commits.push(e.detail.value));
  f.root.addEventListener('valueChange', () => setElementProps(f.root, { value: [40, 60] }));
  expect(f.x.requestValues([30, 70])).toBe(true);
  expect(f.x.getValue()).toEqual([40, 60]);
  expect(f.x.phase.get()).toBe('idle');
  expect(f.x.commitValue()).toBe(true);
  expect(commits).toEqual([[30, 70]]);
});
it('callback wrong-shape owner and changed policy invalidate stale completion', async () => {
  const f = await fixture({ value: [20, 80] });
  f.root.addEventListener('valueChange', () => setElementProps(f.root, { value: [true] }));
  expect(f.x.requestValues([30, 70])).toBe(false);
  expect(f.x.getValue()).toBeNull();
  expect(f.x.commitValue()).toBe(false);
});
it('policy update during notification is received and prevents the obsolete edit', async () => {
  const f = await fixture({ defaultValue: 50 });
  f.root.addEventListener('valueChange', () =>
    setElementProps(f.root, { max: 60, readOnly: true })
  );
  expect(f.x.requestValue(70)).toBe(false);
  expect(f.x.getValue()).toBe(50);
  expect(f.x.readOnly.get()).toBe(true);
  expect(f.x.commitValue()).toBe(false);
});
it('State observer Props feedback converges using the same declared owner', async () => {
  const f = await fixture({ value: [20, 80] });
  const handle = f.x.values;
  let rewrote = false;
  handle.subscribe((e: any) => {
    if (e.type === 'next' && !rewrote) {
      rewrote = true;
      setElementProps(f.root, { value: [40, 60] });
    }
  });
  setElementProps(f.root, { value: [30, 70] });
  expect(f.x.getValue()).toEqual([40, 60]);
  expect(f.x.values).toBe(handle);
  expect(f.x.phase.get()).toBe('idle');
});
it('idle observer Props update cannot be dropped or admit a nested edit in publication', async () => {
  const f = await fixture({ value: [20, 80] });
  let once = false;
  f.x.phase.subscribe((e: any) => {
    if (e.type === 'next' && e.next === 'idle' && !once) {
      once = true;
      expect(f.x.requestValues([5, 95])).toBe(false);
      setElementProps(f.root, { value: [40, 60] });
    }
  });
  setElementProps(f.root, { value: [30, 70] });
  expect(f.x.getValue()).toEqual([40, 60]);
  expect(f.x.phase.get()).toBe('idle');
});
it('nonconvergent synchronous owner feedback gives a bounded diagnostic, not false idle acceptance', async () => {
  const f = await fixture({ value: [20, 80] });
  let next = 21,
    calls = 0;
  f.x.values.subscribe((e: any) => {
    if (e.type === 'next') {
      calls++;
      setElementProps(f.root, { value: [next++, 80] });
    }
  });
  setElementProps(f.root, { value: [30, 70] });
  expect(calls).toBeLessThan(100);
  expect(f.x.getValue()).toBeNull();
  expect(f.x.diagnostic.get()).toBe('reentrant-props-limit');
  expect(f.x.requestValues([20, 80])).toBe(false);
});
it('Props fallback is honored instead of reconstructing invalid raw spelling', async () => {
  const f = await fixture({ value: 20 });
  setElementProps(f.root, { value: NaN });
  expect(f.x.getValue()).toBe(20);
  expect(f.x.diagnostic.get()).toBe('');
  const g = await fixture({ defaultValue: NaN, min: -10 });
  expect(g.x.getValue()).toBe(-10);
});
it('public Anatomy order supplies omitted indices and moving a retained Thumb changes keyboard owner', async () => {
  const a = await fixture({ defaultValue: [20], step: 5 }),
    b = await fixture({ defaultValue: [70], step: 5 }),
    thumb = create(sliderValuesThumb.name, {});
  a.root.append(thumb);
  await flush();
  expect(thumb.getExposes().index.get()).toBe(0);
  b.root.append(thumb);
  await flush();
  const x = thumb.getExposes();
  x.focusSelf();
  await flush();
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await flush();
  expect(b.x.getValue()).toEqual([75]);
  expect(a.x.getValue()).toEqual([20]);
  expect(b.root.firstElementChild).toBe(thumb);
});
it('dynamic Thumb retirement cancels its pending logical completion', async () => {
  const f = await fixture({ defaultValue: [20] }),
    thumb = create(sliderValuesThumb.name, { index: 0 });
  f.root.append(thumb);
  await flush();
  expect(f.x.beginInteraction(0)).toBe(true);
  expect(f.x.requestThumbValue(0, 30)).toBe(true);
  thumb.remove();
  await flush();
  expect(f.x.commitValue()).toBe(false);
  expect(f.x.getValue()).toEqual([30]);
});
it('whole Field retirement and new attachment use declared owner and correct policy', async () => {
  const field = create(fieldRoot.name, { disabled: true }),
    root = create(sliderValuesRoot.name, { defaultValue: [20] }),
    thumb = create(sliderValuesThumb.name, { index: 0 });
  root.append(thumb);
  field.append(root);
  document.body.append(field);
  await flush();
  expect(thumb.getExposes().disabled.get()).toBe(true);
  field.remove();
  await flush();
  document.body.append(field);
  await flush();
  expect(root.getExposes().getValue()).toEqual([20]);
  expect(thumb.getExposes().disabled.get()).toBe(true);
  setElementProps(field, { disabled: false });
  await flush();
  expect(thumb.getExposes().disabled.get()).toBe(false);
});
it('completion rechecks policy after interacting=false observers before emitting commit', async () => {
  const f = await fixture({ defaultValue: [20, 80] }),
    commits: unknown[] = [];
  f.root.addEventListener('valueCommit', (e: CustomEvent) => commits.push(e.detail));
  f.x.beginInteraction();
  f.x.requestValues([30, 70]);
  f.x.interacting.subscribe((e: any) => {
    if (e.type === 'next' && e.next === false) setElementProps(f.root, { readOnly: true });
  });
  expect(f.x.commitValue()).toBe(false);
  expect(commits).toEqual([]);
  expect(f.x.readOnly.get()).toBe(true);
});
it('feedback-limit failure publishes disabled projections to retained Thumbs', async () => {
  const f = await fixture({ value: [20] }),
    thumb = create(sliderValuesThumb.name, { index: 0 });
  f.root.append(thumb);
  await flush();
  expect(thumb.getExposes().disabled.get()).toBe(false);
  let next = 21;
  f.x.values.subscribe((e: any) => {
    if (e.type === 'next') setElementProps(f.root, { value: [next++] });
  });
  setElementProps(f.root, { value: [30] });
  expect(f.x.ready.get()).toBe(false);
  expect(thumb.getExposes().disabled.get()).toBe(true);
});

// Regression witnesses supplied by the current independent reviewer.

import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';

function runtimeFixture(proto: any, raw: Record<string, unknown>) {
  const token = {};
  let exposes: Record<string, any> = {};
  const commits: any[] = [];
  const host: RuntimeHost<any> = {
    prototypeName: proto.name,
    getRawProps: () => raw,
    commit(_c, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    onRuntimeReady(w) {
      w.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, token],
        [ANATOMY_PARENT_CAP, () => null],
        [ANATOMY_GET_PROTO_CAP, () => proto],
      ]);
      w.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, token],
        [CONTEXT_PARENT_CAP, () => null],
      ]);
      w.attach('expose-event', [
        [
          EXPOSE_EVENT_SINK_CAP,
          (name: string, payload: any) => {
            if (name === 'valueCommit') commits.push(payload);
          },
        ],
      ]);
      w.attach('expose-state', [
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
  return {
    session,
    get x() {
      return exposes;
    },
    commits,
  };
}
it('independent: terminal Runtime dispose during commit cleanup prevents a stale event', async () => {
  const f = runtimeFixture(sliderValuesRoot, { defaultValue: [20, 80] });
  await f.session.mount();
  try {
    f.session.invokeInCallbackScope(() => {
      expect(f.x.beginInteraction()).toBe(true);
      expect(f.x.requestValues([30, 70])).toBe(true);
    });
    f.x.interacting.subscribe((e: any) => {
      if (e.type === 'next' && e.next === false) f.session.dispose();
    });
    const result = f.session.invokeInCallbackScope(() => f.x.commitValue());
    expect(result).toBe(false);
    expect(f.commits).toEqual([]);
  } finally {
    f.session.dispose();
  }
});
it('independent: live orphan Thumb still raises required Context error', async () => {
  let f: ReturnType<typeof runtimeFixture> | undefined;
  try {
    await expect(async () => {
      f = runtimeFixture(sliderValuesThumb, {});
      await f.session.mount();
    }).rejects.toThrow(/Context|context/);
  } finally {
    f?.session.dispose();
  }
});
for (const point of ['values', 'notifying', 'publishing', 'idle', 'activeIndex'])
  it(`independent: synchronous terminal dispose at ${point} publication boundary stops old request`, async () => {
    const f = runtimeFixture(sliderValuesRoot, {
      defaultValue: point === 'activeIndex' ? 50 : [20, 80],
    });
    await f.session.mount();
    try {
      const handle =
        point === 'values' ? f.x.values : point === 'activeIndex' ? f.x.activeIndex : f.x.phase;
      handle.subscribe((e: any) => {
        if (
          e.type === 'next' &&
          (point === 'values' || point === 'activeIndex' || e.next === point)
        )
          f.session.dispose();
      });
      const result = f.session.invokeInCallbackScope(() =>
        point === 'activeIndex' ? f.x.requestValue(60) : f.x.requestValues([30, 70])
      );
      expect(result).toBe(false);
      expect(f.commits).toEqual([]);
    } finally {
      f.session.dispose();
    }
  });

it('independent: terminal dispose when beginning interaction stops later writes', async () => {
  const f = runtimeFixture(sliderValuesRoot, { defaultValue: [20, 80] });
  await f.session.mount();
  try {
    f.x.interacting.subscribe((e: any) => {
      if (e.type === 'next' && e.next === true) f.session.dispose();
    });
    expect(f.session.invokeInCallbackScope(() => f.x.beginInteraction())).toBe(false);
    expect(f.commits).toEqual([]);
  } finally {
    f.session.dispose();
  }
});

for (const [point, update] of [
  ['disabled', { value: [20, 80], disabled: true }],
  ['readOnly', { value: [20, 80], readOnly: true }],
  ['valueShape', { value: 50 }],
  ['ready', { value: [20, 80], step: 0 }],
  ['diagnostic', { value: [true] }],
] as const)
  it(`terminal disposal during ${point} owner reconciliation stops subsequent writes`, async () => {
    const f = runtimeFixture(sliderValuesRoot, { value: [20, 80] });
    await f.session.mount();
    try {
      let disposed = false;
      f.x[point].subscribe((event: any) => {
        if (event.type === 'next' && !disposed) {
          disposed = true;
          f.session.dispose();
        }
      });
      f.session.controller.applyRawProps(update);
      expect(disposed).toBe(true);
      expect(f.commits).toEqual([]);
    } finally {
      f.session.dispose();
    }
  });
it('repeatable Runtime unmount clears the selected slot and pending commit but retains the sole owner', async () => {
  const f = runtimeFixture(sliderValuesRoot, { defaultValue: 50 });
  await f.session.mount();
  try {
    f.session.invokeInCallbackScope(() => {
      expect(f.x.requestValue(60)).toBe(true);
    });
    expect(f.x.activeIndex.get()).toBe(0);
    await f.session.unmount();
    expect(f.x.activeIndex.get()).toBe(-1);
    await f.session.mount();
    expect(f.x.activeIndex.get()).toBe(-1);
    expect(f.session.invokeInCallbackScope(() => f.x.getValue())).toBe(60);
    expect(f.session.invokeInCallbackScope(() => f.x.commitValue())).toBe(false);
  } finally {
    await f.session.dispose();
  }
});
it('terminal disposal before any mounted epoch invalidates retained Root methods', async () => {
  const f = runtimeFixture(sliderValuesRoot, { defaultValue: 50 });
  const x = f.x;
  await f.session.dispose();
  expect(x.getValue()).toBeNull();
  expect(x.getDisplayValue()).toBeNull();
  expect(x.requestValue(60)).toBe(false);
  expect(x.resetValue()).toBe(false);
});

import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
async function pairedRuntimeFixture(thumbProps: Record<string, unknown> = { index: 0 }) {
  const rootToken = new EventTarget(),
    thumbToken = new EventTarget(),
    globalTarget = new EventTarget();
  const protos = new Map<object, any>([
    [rootToken, sliderValuesRoot],
    [thumbToken, sliderValuesThumb],
  ]);
  const parents = new Map<object, object>([[thumbToken, rootToken]]);
  const commits: unknown[] = [];
  function make(token: EventTarget, raw: Record<string, unknown>) {
    let x: Record<string, any> = {};
    const proto = protos.get(token)!;
    const host: RuntimeHost<any> = {
      prototypeName: proto.name,
      getRawProps: () => raw,
      commit(_c, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(w) {
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => token],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, (item: object) => parents.get(item) ?? null],
          [ANATOMY_GET_PROTO_CAP, (item: object) => protos.get(item) ?? null],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [CONTEXT_PARENT_CAP, (item: object) => parents.get(item) ?? null],
        ]);
        w.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string, payload: unknown) => {
              if (name === 'valueCommit') commits.push(payload);
            },
          ],
        ]);
        w.attach('expose-state', [
          [
            EXPOSE_STATE_SET_EXPOSES_CAP,
            (next: Record<string, unknown>) => {
              x = next;
            },
          ],
        ]);
      },
    };
    return {
      session: createRuntimeSession(proto, host),
      get x() {
        return x;
      },
    };
  }
  const root = make(rootToken, { defaultValue: 20 });
  await root.session.mount();
  const thumb = make(thumbToken, thumbProps);
  await thumb.session.mount();
  return { root, thumb, commits };
}
for (const point of ['value', 'percentage'])
  it(`Thumb ${point} observer terminal disposal stops its projection frame`, async () => {
    const { root, thumb, commits } = await pairedRuntimeFixture();
    try {
      expect(thumb.x.disabled.get()).toBe(false);
      let retired = false;
      thumb.x[point].subscribe((event: any) => {
        if (event.type === 'next' && !retired) {
          retired = true;
          void thumb.session.dispose();
        }
      });
      expect(root.session.invokeInCallbackScope(() => root.x.requestThumbValue(0, 30))).toBe(false);
      expect(retired).toBe(true);
      expect(commits).toEqual([]);
      expect(root.session.invokeInCallbackScope(() => root.x.commitValue())).toBe(false);
    } finally {
      await thumb.session.dispose();
      await root.session.dispose();
    }
  });
it('Root-first terminal disposal during Thumb projection cannot reenable the retained child', async () => {
  const { root, thumb, commits } = await pairedRuntimeFixture();
  try {
    expect(thumb.x.disabled.get()).toBe(false);
    let retired = false;
    thumb.x.value.subscribe((event: any) => {
      if (event.type === 'next' && !retired) {
        retired = true;
        void root.session.dispose();
      }
    });
    expect(root.session.invokeInCallbackScope(() => root.x.requestThumbValue(0, 30))).toBe(false);
    expect(retired).toBe(true);
    expect(thumb.x.disabled.get()).toBe(true);
    expect(commits).toEqual([]);
  } finally {
    await thumb.session.dispose();
    await root.session.dispose();
  }
});
it('synchronous Thumb move cannot let an old projection overwrite the new Root', async () => {
  const a = await fixture({ defaultValue: [20] }),
    b = await fixture({ defaultValue: [70] });
  const thumb = create(sliderValuesThumb.name, { index: 0 });
  a.root.append(thumb);
  await flush();
  let moved = false;
  thumb.getExposes().value.subscribe((e: any) => {
    if (e.type === 'next' && !moved) {
      moved = true;
      b.root.append(thumb);
    }
  });
  a.x.requestValues([30]);
  await flush();
  expect(moved).toBe(true);
  expect(thumb.getExposes().value.get()).toBe(70);
  expect(thumb.getExposes().percentage.get()).toBe(70);
  expect(thumb.getExposes().disabled.get()).toBe(false);
  thumb.getExposes().focusSelf();
  await flush();
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await flush();
  expect(a.x.getValue()).toEqual([30]);
  expect(b.x.getValue()).toEqual([71]);
});
it('logical-session entry rejects every noninteger or unsupported negative index before writes', async () => {
  const f = await fixture({ defaultValue: 20 });
  for (const index of [NaN, Infinity, -Infinity, -2, -0.5]) {
    expect(f.x.beginInteraction(index)).toBe(false);
    expect(f.x.interacting.get()).toBe(false);
    expect(f.x.activeIndex.get()).toBe(-1);
  }
  expect(f.x.beginInteraction()).toBe(true);
});

const projectionNotificationPoints = [
  'value',
  'percentage',
  'startPercentage',
  'endPercentage',
  'extent',
  'index',
  'disabled',
  'readOnly',
  'orientation',
  'direction',
] as const;
for (const point of projectionNotificationPoints)
  for (const retireRoot of [false, true])
    it(`${point} projection notification rechecks ${retireRoot ? 'Root availability' : 'part retirement'} before its next write`, async () => {
      const { root, thumb, commits } = await pairedRuntimeFixture(
        point === 'startPercentage' ? { index: 0, startIndex: 0 } : { index: 0 }
      );
      try {
        let retired = false;
        thumb.x[point].subscribe((event: any) => {
          if (event.type === 'next' && !retired) {
            retired = true;
            void (retireRoot ? root : thumb).session.dispose();
          }
        });
        if (point === 'index') thumb.session.controller.applyRawProps({ index: 1 });
        else if (point === 'disabled') root.session.controller.applyRawProps({ disabled: true });
        else if (point === 'readOnly') root.session.controller.applyRawProps({ readOnly: true });
        else if (point === 'orientation')
          root.session.controller.applyRawProps({ orientation: 'vertical' });
        else if (point === 'direction') root.session.controller.applyRawProps({ direction: 'rtl' });
        else root.session.invokeInCallbackScope(() => root.x.requestValue(30));
        expect(retired).toBe(true);
        expect(commits).toEqual([]);
        if (retireRoot) expect(thumb.x.disabled.get()).toBe(true);
      } finally {
        await thumb.session.dispose();
        await root.session.dispose();
      }
    });
