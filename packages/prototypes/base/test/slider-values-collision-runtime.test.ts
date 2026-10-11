import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { sliderValuesRoot, sliderValuesThumb } from '../src/slider';
for (const p of [sliderValuesRoot, sliderValuesThumb]) AdaptToWebComponent(p);
const flush = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
async function fixture(props: Record<string, unknown> = {}) {
  const root = document.createElement(sliderValuesRoot.name) as any;
  setElementProps(root, { defaultValue: [20, 40, 60], minStepsBetweenValues: 10, ...props });
  const thumbs = Array.from({ length: 3 }, (_, index) => {
    const el = document.createElement(sliderValuesThumb.name) as any;
    setElementProps(el, { index });
    return el;
  });
  root.append(...thumbs);
  document.body.append(root);
  await flush();
  const changes: any[] = [],
    commits: any[] = [];
  root.addEventListener('valueChange', (e: CustomEvent) => changes.push(e.detail));
  root.addEventListener('valueCommit', (e: CustomEvent) => commits.push(e.detail));
  return { root, thumbs, x: root.getExposes(), changes, commits };
}
it('logical input requires a selected live mapped session', async () => {
  const f = await fixture();
  expect(f.x.requestInteractionValue(45)).toBe(false);
  expect(f.x.beginInteraction()).toBe(true);
  expect(f.x.requestInteractionValue(45)).toBe(false);
  expect(f.x.cancelInteraction()).toBe(true);
  expect(f.x.beginInteraction(0)).toBe(true);
  expect(f.x.requestInteractionValue(45)).toBe(true);
  expect(f.x.getValue()).toEqual([45, 55, 65]);
  expect(f.x.requestInteractionValue(25)).toBe(true);
  expect(f.x.getValue()).toEqual([25, 55, 65]);
  expect(f.x.commitValue()).toBe(true);
  expect(f.commits).toEqual([{ value: [25, 55, 65], activeThumbIndex: 0, reason: 'interaction' }]);
  expect(f.x.commitValue()).toBe(false);
});
it('controlled non-echo keeps Props display while subsequent collision samples use accepted history', async () => {
  const f = await fixture({ value: [20, 40, 60] });
  const handle = f.x.values;
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(45)).toBe(true);
  expect(f.x.requestInteractionValue(25)).toBe(true);
  expect(f.changes.map((e) => e.value)).toEqual([
    [45, 55, 65],
    [25, 55, 65],
  ]);
  expect(f.x.getValue()).toEqual([20, 40, 60]);
  expect(f.x.getDisplayValue()).toEqual([20, 40, 60]);
  expect(f.x.values).toBe(handle);
  expect(f.x.commitValue()).toBe(true);
  expect(f.commits[0].value).toEqual([25, 55, 65]);
});
it('swap migrates only a logical index, uses start history and retains actual Thumb nodes', async () => {
  const f = await fixture({ thumbCollisionBehavior: 'swap' });
  f.thumbs[0].getExposes().focusSelf();
  await flush();
  const focused = document.activeElement;
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(80)).toBe(true);
  expect(f.x.activeIndex.get()).toBe(1);
  expect(f.x.getValue()).toEqual([30, 80, 90]);
  expect(document.activeElement).toBe(focused);
  expect([...f.root.children]).toEqual(f.thumbs);
  expect(f.x.requestInteractionValue(20)).toBe(true);
  expect(f.x.activeIndex.get()).toBe(0);
  expect(f.x.getValue()).toEqual([20, 40, 60]);
  expect(f.x.commitValue()).toBe(true);
  expect(f.commits[0].value).toEqual([20, 40, 60]);
});
it('veto preserves the previous proposal, selected index and focus, including controlled non-echo', async () => {
  const f = await fixture({ value: [20, 40, 60], thumbCollisionBehavior: 'swap' });
  f.thumbs[0].getExposes().focusSelf();
  await flush();
  const focused = document.activeElement;
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(25)).toBe(true);
  const cancel = () => f.x.cancelValueChange();
  f.root.addEventListener('valueChange', cancel);
  expect(f.x.requestInteractionValue(80)).toBe(false);
  expect(f.x.activeIndex.get()).toBe(0);
  expect(document.activeElement).toBe(focused);
  f.root.removeEventListener('valueChange', cancel);
  expect(f.x.requestInteractionValue(35)).toBe(true);
  expect(f.x.activeIndex.get()).toBe(0);
  expect(f.changes.at(-1).value).toEqual([30, 40, 60]);
  expect(f.x.commitValue()).toBe(true);
  expect(f.commits[0].activeThumbIndex).toBe(0);
});
it('collision configuration does not change keyboard or direct same-slot input', async () => {
  const f = await fixture({ thumbCollisionBehavior: 'push', step: 1 });
  expect(f.x.requestThumbValue(0, 45)).toBe(false);
  expect(f.x.requestKeyboardValue(0, 'End')).toBe(true);
  expect(f.x.getValue()).toEqual([30, 40, 60]);
  expect(f.commits[0].reason).toBe('keyboard');
});
it('strategy change cancels a session and stale completion', async () => {
  const f = await fixture();
  f.x.beginInteraction(0);
  f.x.requestInteractionValue(45);
  setElementProps(f.root, { thumbCollisionBehavior: 'none', minStepsBetweenValues: 10 });
  await flush();
  expect(f.x.interacting.get()).toBe(false);
  expect(f.x.requestInteractionValue(25)).toBe(false);
  expect(f.x.commitValue()).toBe(false);
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(100)).toBe(false);
});
it('same-owner no-op never migrates index or erases prior completion', async () => {
  const f = await fixture({ defaultValue: [30, 40, 60], thumbCollisionBehavior: 'swap' });
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(40)).toBe(false);
  expect(f.x.activeIndex.get()).toBe(0);
  expect(f.changes).toEqual([]);
});
for (const prop of [
  { disabled: true },
  { readOnly: true },
  { max: 90 },
  { thumbCollisionBehavior: 'none' },
])
  it(`notification policy update ${JSON.stringify(prop)} prevents stale collision index`, async () => {
    const f = await fixture({ thumbCollisionBehavior: 'swap' });
    f.x.beginInteraction(0);
    f.root.addEventListener('valueChange', () => setElementProps(f.root, prop));
    expect(f.x.requestInteractionValue(80)).toBe(false);
    expect(f.x.activeIndex.get()).toBe(-1);
    expect(f.x.commitValue()).toBe(false);
    expect(f.x.getValue()).toEqual([20, 40, 60]);
  });
it('notification reparenting a Thumb invalidates collision before owner/index publication', async () => {
  const f = await fixture({ thumbCollisionBehavior: 'swap' });
  const other = await fixture();
  f.x.beginInteraction(0);
  f.root.addEventListener('valueChange', () => other.root.append(f.thumbs[0]));
  expect(f.x.requestInteractionValue(80)).toBe(false);
  expect(f.x.getValue()).toEqual([20, 40, 60]);
  expect(f.x.commitValue()).toBe(false);
});
it('start interaction observers cannot submit nested input before selection is initialized', async () => {
  const f = await fixture();
  f.x.activeIndex.subscribe((e: any) => {
    if (e.type === 'next' && e.next === 0) expect(f.x.requestInteractionValue(45)).toBe(false);
  });
  expect(f.x.beginInteraction(0)).toBe(true);
  expect(f.x.getValue()).toEqual([20, 40, 60]);
  expect(f.changes).toEqual([]);
});
it('upstream-equivalent packed same-vector swap has no notification or index migration', async () => {
  const f = await fixture({ defaultValue: [0, 10, 20], max: 20, thumbCollisionBehavior: 'swap' });
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(10)).toBe(false);
  expect(f.x.activeIndex.get()).toBe(0);
  expect(f.changes).toEqual([]);
  expect(f.x.commitValue()).toBe(false);
});
it('controlled return to display-owner preserves previous proposal and completion, as upstream does', async () => {
  const f = await fixture({ value: [20, 40, 60], thumbCollisionBehavior: 'swap' });
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(25)).toBe(true);
  expect(f.x.requestInteractionValue(20)).toBe(false);
  expect(f.changes.map((e) => e.value)).toEqual([[25, 40, 60]]);
  expect(f.x.commitValue()).toBe(true);
  expect(f.commits[0].value).toEqual([25, 40, 60]);
});
it('synchronous controlled feedback owns display but cannot replace accepted collision history', async () => {
  const f = await fixture({ value: [20, 40, 60] });
  f.root.addEventListener('valueChange', () =>
    setElementProps(f.root, { value: [10, 40, 80], minStepsBetweenValues: 10 })
  );
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(45)).toBe(true);
  expect(f.x.getValue()).toEqual([10, 40, 80]);
  expect(f.x.requestInteractionValue(25)).toBe(true);
  expect(f.changes.at(-1).value).toEqual([25, 55, 65]);
  expect(f.x.commitValue()).toBe(true);
  expect(f.commits[0].value).toEqual([25, 55, 65]);
});
it('disabled swap target is rejected but a disabled pushed neighbor is not an independent owner', async () => {
  const f = await fixture({ thumbCollisionBehavior: 'swap' });
  setElementProps(f.thumbs[1], { index: 1, disabled: true });
  await flush();
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(80)).toBe(false);
  expect(f.x.activeIndex.get()).toBe(0);
  expect(f.changes).toEqual([]);
  f.x.cancelInteraction();
  setElementProps(f.root, { thumbCollisionBehavior: 'push', minStepsBetweenValues: 10 });
  await flush();
  f.x.beginInteraction(0);
  expect(f.x.requestInteractionValue(45)).toBe(true);
  expect(f.x.getValue()).toEqual([45, 55, 65]);
});
for (const point of ['interacting', 'activeIndex'])
  it(`begin ${point} notification policy change retires the half-built session`, async () => {
    const f = await fixture();
    f.x[point].subscribe((e: any) => {
      if (e.type === 'next' && e.next === (point === 'interacting' ? true : 0)) {
        expect(f.x.cancelInteraction()).toBe(false);
        expect(f.x.beginInteraction(1)).toBe(false);
        expect(f.x.requestInteractionValue(45)).toBe(false);
        setElementProps(f.root, { readOnly: true });
      }
    });
    expect(f.x.beginInteraction(0)).toBe(false);
    expect(f.x.interacting.get()).toBe(false);
    expect(f.x.activeIndex.get()).toBe(-1);
    expect(f.changes).toEqual([]);
  });
it('cancellation notifications cannot start or edit a replacement session in the old frame', async () => {
  const f = await fixture();
  f.x.beginInteraction(0);
  f.x.requestInteractionValue(45);
  f.x.interacting.subscribe((e: any) => {
    if (e.type === 'next' && e.next === false) {
      expect(f.x.beginInteraction(1)).toBe(false);
      expect(f.x.requestValues([1, 2, 3])).toBe(false);
    }
  });
  expect(f.x.cancelInteraction()).toBe(true);
  expect(f.x.activeIndex.get()).toBe(-1);
  expect(f.x.commitValue()).toBe(false);
  expect(f.x.getValue()).toEqual([45, 55, 65]);
});
it('owner State policy feedback stops before publishing stale swap selection', async () => {
  const f = await fixture({ thumbCollisionBehavior: 'swap' });
  f.x.beginInteraction(0);
  const indices: number[] = [];
  f.x.activeIndex.subscribe((e: any) => {
    if (e.type === 'next') indices.push(e.next);
  });
  f.x.values.subscribe((e: any) => {
    if (e.type === 'next') setElementProps(f.root, { readOnly: true });
  });
  expect(f.x.requestInteractionValue(80)).toBe(false);
  expect(indices).not.toContain(1);
  expect(f.x.commitValue()).toBe(false);
});

// Real Runtime sessions using the same existing public capability fixture as
// the owner publication suite. These are lifecycle tests, not pointer hosts.
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import { EXPOSE_STATE_SET_EXPOSES_CAP } from '@proto.ui/module-expose-state';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
async function runtimeFixture() {
  const rootToken = new EventTarget(),
    tokens = Array.from({ length: 3 }, () => new EventTarget());
  const protos = new Map<object, any>([
    [rootToken, sliderValuesRoot],
    ...tokens.map((t) => [t, sliderValuesThumb] as [object, any]),
  ]);
  const parents = new Map<object, object>(tokens.map((t) => [t, rootToken]));
  const events: Array<[string, unknown]> = [];
  const make = (token: EventTarget, raw: Record<string, unknown>) => {
    let exposes: any;
    const proto = protos.get(token);
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
          [EVENT_GLOBAL_TARGET_CAP, () => rootToken],
        ]);
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, token],
          [ANATOMY_PARENT_CAP, (t: object) => parents.get(t) ?? null],
          [ANATOMY_GET_PROTO_CAP, (t: object) => protos.get(t) ?? null],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, token],
          [CONTEXT_PARENT_CAP, (t: object) => parents.get(t) ?? null],
        ]);
        w.attach('expose-event', [
          [EXPOSE_EVENT_SINK_CAP, (name: string, payload: unknown) => events.push([name, payload])],
        ]);
        w.attach('expose-state', [
          [
            EXPOSE_STATE_SET_EXPOSES_CAP,
            (x: unknown) => {
              exposes = x;
            },
          ],
        ]);
      },
    };
    return {
      session: createRuntimeSession(proto, host),
      get x() {
        return exposes;
      },
    };
  };
  const root = make(rootToken, {
    defaultValue: [20, 40, 60],
    minStepsBetweenValues: 10,
    thumbCollisionBehavior: 'swap',
  });
  await root.session.mount();
  const thumbs = tokens.map((t, index) => make(t, { index }));
  for (const t of thumbs) await t.session.mount();
  return {
    root,
    thumbs,
    events,
    async dispose() {
      for (const t of thumbs) await t.session.dispose();
      await root.session.dispose();
    },
  };
}
for (const point of ['values', 'activeIndex', 'phase'])
  it(`terminal Runtime retirement during collision ${point} notification stops the old frame`, async () => {
    const f = await runtimeFixture();
    try {
      f.root.session.invokeInCallbackScope(() => f.root.x.beginInteraction(0));
      let retired = false;
      f.root.x[point].subscribe((e: any) => {
        if (e.type === 'next' && !retired && (point !== 'phase' || e.next === 'publishing')) {
          retired = true;
          void f.root.session.dispose();
        }
      });
      expect(f.root.session.invokeInCallbackScope(() => f.root.x.requestInteractionValue(80))).toBe(
        false
      );
      expect(retired).toBe(true);
      expect(f.events.filter(([name]) => name === 'valueCommit')).toEqual([]);
    } finally {
      await f.dispose();
    }
  });
