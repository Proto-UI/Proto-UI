import { expect, it } from 'vitest';
import { switchRoot, switchThumb } from '../src/switch';
import { switchRoot as baseRoot } from '../../base/src/switch';
import type { AnatomyPort } from '@proto.ui/module-anatomy';
import type { FeedbackFacade } from '@proto.ui/module-feedback';
import type { ContextPort } from '@proto.ui/module-context';
import { createRuntimeSession } from '@proto.ui/runtime';
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

// Real Runtime lifecycle and logical ancestry, without browser layout or native-input claims.
function runtimeHarness() {
  const parents = new Map<any, any>(),
    protos = new Map<any, any>();
  const actions: string[] = [];
  function make(proto: any, parent: any = null, props: any = {}) {
    const listeners = new Map<string, Set<any>>();
    const target = {
      addEventListener(type: string, fn: any) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: any) {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent(event: Event) {
        for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event);
        return true;
      },
    } as unknown as EventTarget;
    parents.set(target, parent);
    protos.set(target, proto);
    let exposes: any;
    const session = createRuntimeSession(proto, {
      prototypeName: proto.name,
      getRawProps: () => props,
      schedule: (fn) => fn(),
      scheduleDelay: (ms, fn) => {
        const id = setTimeout(fn, ms);
        return { cancel: () => clearTimeout(id) };
      },
      commit: (_c, s) => s?.done(),
      onRuntimeReady(w) {
        w.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, target],
          [ANATOMY_PARENT_CAP, (t: any) => parents.get(t) ?? null],
          [ANATOMY_GET_PROTO_CAP, (t: any) => protos.get(t)],
          [ANATOMY_ROOT_TARGET_CAP, (t: any) => t],
        ]);
        w.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, target],
          [CONTEXT_PARENT_CAP, (t: any) => parents.get(t) ?? null],
        ]);
        w.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => target],
          [EVENT_GLOBAL_TARGET_CAP, () => target],
        ]);
        w.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, target],
          [AS_TRIGGER_PARENT_CAP, (t: any) => parents.get(t) ?? null],
          [AS_TRIGGER_GET_PROTO_CAP, (t: any) => protos.get(t)],
        ]);
        w.attach('expose-state', [
          [
            EXPOSES_RECORD_SINK_CAP,
            (x: any) => {
              exposes = x;
            },
          ],
        ]);
        w.attach('expose-event', [
          [
            EXPOSE_EVENT_SINK_CAP,
            (name: string) => {
              actions.push(name);
            },
          ],
        ]);
      },
    });
    return {
      session,
      target,
      setParent(parent: any) {
        parents.set(target, parent);
        session.caps.getPort<AnatomyPort>('anatomy')!.syncStructure();
      },
      style() {
        return (session.caps.getFacades().feedback as FeedbackFacade).style.exportMerged().tokens;
      },
      get exposes() {
        return exposes;
      },
    };
  }

  return {
    make,
    actions,
  };
}

const hasSize = (
  part: ReturnType<ReturnType<typeof runtimeHarness>['make']>,
  size: 'default' | 'sm'
) => {
  expect(part.style()).toContain(size === 'sm' ? 'size-3' : 'size-4');
  expect(part.style()).not.toContain(size === 'sm' ? 'size-4' : 'size-3');
};

it('rebinds after repeatable view detach and releases size subscriptions at terminal disposal', async () => {
  const f = runtimeHarness();
  const small = f.make(switchRoot, null, { size: 'sm' });
  const base = f.make(baseRoot);
  await small.session.mount();
  await base.session.mount();
  const thumb = f.make(switchThumb, small.target);
  await thumb.session.mount();
  hasSize(thumb, 'sm');
  const context = thumb.session.caps.getPort<ContextPort>('context')!;
  const subscriptions = () =>
    context.dumpSubscriptions().filter((entry) => entry.instance === thumb.target);
  expect(subscriptions()).toHaveLength(2);
  for (let i = 0; i < 3; i++) {
    await thumb.session.unmount();
    expect(subscriptions()).toHaveLength(2);
    thumb.setParent(base.target);
    small.session.controller.applyRawProps({ size: i % 2 ? 'sm' : 'default' });
    await thumb.session.mount();
    hasSize(thumb, 'default');
    await thumb.session.unmount();
    small.session.controller.applyRawProps({ size: 'sm' });
    thumb.setParent(small.target);
    await thumb.session.mount();
    hasSize(thumb, 'sm');
    expect(subscriptions()).toHaveLength(2);
  }
  await thumb.session.dispose();
  expect(subscriptions()).toHaveLength(0);
  small.session.controller.applyRawProps({ size: 'default' });
  expect(f.actions).toEqual([]);
  await small.session.dispose();
  await base.session.dispose();
});

it('parent-first terminal disposal clears visual size and cannot inherit an outer sm owner', async () => {
  const f = runtimeHarness();
  const outer = f.make(switchRoot, null, { size: 'sm' });
  await outer.session.mount();
  const inner = f.make(switchRoot, outer.target, { size: 'sm' });
  await inner.session.mount();
  const thumb = f.make(switchThumb, inner.target);
  await thumb.session.mount();
  hasSize(thumb, 'sm');
  await inner.session.dispose();
  hasSize(thumb, 'default');
  for (const size of ['default', 'sm']) {
    outer.session.controller.applyRawProps({ size });
    hasSize(thumb, 'default');
  }
  expect(f.actions).toEqual([]);
  await thumb.session.dispose();
  await outer.session.dispose();
});
