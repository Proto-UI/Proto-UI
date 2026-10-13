import { afterEach, describe, expect, it } from 'vitest';
import type { A11ySemanticObjectSnapshot, Prototype } from '@proto.ui/core';
import { createRuntimeSession } from '@proto.ui/runtime';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { A11Y_PROJECT_CAP } from '@proto.ui/module-a11y';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { EXPOSE_EVENT_SINK_CAP } from '@proto.ui/module-expose-event';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { checkboxGroupRoot, checkboxGroupItem, checkboxGroupAll } from '../src/checkbox-group';
import { toggleGroupRoot, toggleGroupItem } from '../src/toggle-group';
import { calendarRoot, calendarDay } from '../src/calendar';

// C-A11Y-0001-F / DOMAIN-BOUNDARY (draft): action declarations describe ability;
// they do not install another input route. These controls publish selection at Root,
// so the child does not claim an expose event. Host activation enters press.commit.
// This portable harness is not GPUI/native-AT acceptance; GPUI currently lacks gridcell.
function portableHarness() {
  const parents = new Map<EventTarget, EventTarget | null>();
  const protos = new Map<EventTarget, Prototype<any, any>>();
  const sessions: ReturnType<typeof createRuntimeSession>[] = [];
  function make(proto: Prototype<any, any>, parent: EventTarget | null = null, props = {}) {
    const target = new EventTarget();
    parents.set(target, parent);
    protos.set(target, proto);
    let exposes: any;
    let semantics: A11ySemanticObjectSnapshot | undefined;
    const events: Array<{ name: string; payload: unknown }> = [];
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => props,
      schedule: (fn) => fn(),
      scheduleDelay: (ms, fn) => {
        const id = setTimeout(fn, ms);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_children, signal) => signal?.done(),
      onRuntimeReady(w) {
        w.attach('a11y', [
          [
            A11Y_PROJECT_CAP,
            (snapshot: A11ySemanticObjectSnapshot) => {
              semantics = snapshot;
            },
          ],
        ]);
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, (t: EventTarget) => parents.get(t) ?? null],
          [ANATOMY_GET_PROTO_CAP, (t: EventTarget) => protos.get(t)],
          [ANATOMY_ROOT_TARGET_CAP, (t: EventTarget) => t],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, (t: EventTarget) => parents.get(t) ?? null],
        ]);
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => target],
        ]);
        w.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, (t: EventTarget) => parents.get(t) ?? null],
          [AS_TRIGGER_GET_PROTO_CAP, (t: EventTarget) => protos.get(t)],
        ]);
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (value: unknown) => {
              exposes = value;
            },
          ],
        ]);
        w.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string, payload: unknown) => events.push({ name, payload }),
          ],
        ]);
      },
    });
    sessions.push(session);
    return {
      session,
      target,
      events,
      get exposes() {
        return exposes;
      },
      get semantics() {
        return semantics;
      },
    };
  }
  return {
    make,
    async dispose() {
      for (const session of sessions.reverse()) await session.dispose();
    },
  };
}

const cases = [
  {
    name: 'CheckboxGroup Item',
    root: checkboxGroupRoot,
    child: checkboxGroupItem,
    role: 'checkbox',
    initial: [],
    next: ['a'],
    rootProps: {},
    childProps: { value: 'a' },
  },
  {
    name: 'CheckboxGroup All',
    root: checkboxGroupRoot,
    child: checkboxGroupAll,
    role: 'checkbox',
    initial: [],
    next: ['a', 'b'],
    rootProps: {},
    childProps: {},
  },
  {
    name: 'ToggleGroup Item',
    root: toggleGroupRoot,
    child: toggleGroupItem,
    role: 'button',
    initial: [],
    next: ['a'],
    rootProps: {},
    childProps: { value: 'a' },
  },
  {
    name: 'Calendar day',
    root: calendarRoot,
    child: calendarDay,
    role: 'gridcell',
    initial: '2026-10-09',
    next: '2026-10-10',
    rootProps: { defaultMonth: '2026-10', defaultValue: '2026-10-09' },
    childProps: { date: '2026-10-10' },
  },
];
const readValue = (exposes: any) => (exposes.getValue ? exposes.getValue() : exposes.value.get());
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};

for (const test of cases) {
  it(`${test.name} declares portable activate and its existing semantic input selects exactly once`, async () => {
    const h = portableHarness();
    const root = h.make(test.root, null, test.rootProps);
    await root.session.mount();
    const child = h.make(test.child, root.target, test.childProps);
    await child.session.mount();
    if (test.child === checkboxGroupAll) {
      for (const value of ['a', 'b'])
        await h.make(checkboxGroupItem, root.target, { value }).session.mount();
    }
    try {
      expect(child.semantics).toMatchObject({ role: test.role, actions: { activate: {} } });
      expect(child.semantics?.actions.activate).toEqual({});
      expect(readValue(root.exposes)).toEqual(test.initial);
      // Inject the already-normalized semantic input, not action.event as an input name.
      child.target.dispatchEvent(new Event('press.commit'));
      expect(readValue(root.exposes)).toEqual(test.next);
      expect(root.events).toEqual([{ name: 'valueChange', payload: { value: test.next } }]);
      expect(child.events).toEqual([]);
    } finally {
      await h.dispose();
    }
  });
}

const registered = new Set<Prototype<any, any>>();
for (const test of cases) for (const proto of [test.root, test.child]) registered.add(proto);
for (const proto of registered)
  AdaptToWebComponent(proto, { registerAs: `activate-${proto.name}` });
const mounted: HTMLElement[] = [];
afterEach(async () => {
  for (const root of mounted.splice(0)) root.remove();
  await flush();
});
function element(proto: Prototype<any, any>, props: Record<string, unknown> = {}) {
  const node = document.createElement(`activate-${proto.name}`) as HTMLElement & {
    getExposes(): any;
  };
  setElementProps(node, props);
  return node;
}
async function fixture(test: (typeof cases)[number], props: Record<string, unknown> = {}) {
  const root = element(test.root, { ...test.rootProps, ...props });
  const child = element(test.child, test.childProps);
  root.append(child);
  if (test.child === checkboxGroupAll) {
    root.append(
      element(checkboxGroupItem, { value: 'a' }),
      element(checkboxGroupItem, { value: 'b' }),
      element(checkboxGroupItem, { value: 'blocked', disabled: true })
    );
  }
  const requests: unknown[] = [];
  root.addEventListener('valueChange', (event) => requests.push((event as CustomEvent).detail));
  document.body.append(root);
  mounted.push(root);
  await flush();
  return { root, child, requests, value: () => readValue(root.getExposes()) };
}

for (const test of cases)
  describe(`${test.name} Web adapter input preservation`, () => {
    it('normalizes one click to one request without installing a second route', async () => {
      const f = await fixture(test);
      f.child.click();
      await flush();
      expect(f.value()).toEqual(test.next);
      expect(f.requests).toEqual([{ value: test.next }]);
      f.child.click();
      await flush();
      // Calendar reselect is a no-op; the other controls toggle back exactly once.
      expect(f.value()).toEqual(test.child === calendarDay ? test.next : []);
      expect(f.requests).toEqual(
        test.child === calendarDay ? [{ value: test.next }] : [{ value: test.next }, { value: [] }]
      );
    });
    it.each(['disabled', 'readOnly'])(
      'preserves Root %s and recovers when cleared',
      async (policy) => {
        const f = await fixture(test, { [policy]: true });
        f.child.click();
        await flush();
        expect(f.value()).toEqual(test.initial);
        expect(f.requests).toEqual([]);
        setElementProps(f.root, { ...test.rootProps, [policy]: false });
        await flush();
        f.child.click();
        await flush();
        expect(f.value()).toEqual(test.next);
        expect(f.requests).toEqual([{ value: test.next }]);
      }
    );
    it('preserves child disabled and recovers when cleared', async () => {
      const f = await fixture(test);
      setElementProps(f.child, { ...test.childProps, disabled: true });
      await flush();
      expect(f.child.getAttribute('aria-disabled')).toBe('true');
      f.child.click();
      await flush();
      expect(f.value()).toEqual(test.initial);
      expect(f.requests).toEqual([]);
      setElementProps(f.child, test.childProps);
      await flush();
      f.child.click();
      await flush();
      expect(f.value()).toEqual(test.next);
      expect(f.requests).toEqual([{ value: test.next }]);
    });
    it('emits one controlled proposal and waits for canonical owner acceptance', async () => {
      const f = await fixture(test, { value: test.initial });
      f.child.click();
      await flush();
      expect(f.value()).toEqual(test.initial);
      expect(f.requests).toEqual([{ value: test.next }]);
      setElementProps(f.root, { ...test.rootProps, value: test.next });
      await flush();
      expect(f.value()).toEqual(test.next);
      expect(f.requests).toEqual([{ value: test.next }]);
    });
  });

it('Calendar unavailable and hidden capacity remain inert through the same click route', async () => {
  const test = cases[3];
  for (const props of [
    { unavailable: ['2026-10-10'] },
    { min: '2026-10-11' },
    { max: '2026-10-09' },
  ]) {
    const f = await fixture(test, props);
    expect(f.child.getAttribute('aria-disabled')).toBe('true');
    f.child.click();
    await flush();
    expect(f.value()).toBe(test.initial);
    expect(f.requests).toEqual([]);
  }
  const f = await fixture(test);
  setElementProps(f.child, { offset: 41 });
  await flush();
  expect(f.child.getExposes().hidden.get()).toBe(true);
  expect(f.child.getAttribute('aria-disabled')).toBe('true');
  f.child.click();
  await flush();
  expect(f.value()).toBe(test.initial);
  expect(f.requests).toEqual([]);
});
