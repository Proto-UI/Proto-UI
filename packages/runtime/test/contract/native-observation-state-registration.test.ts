import { describe, expect, it } from 'vitest';
import { createAnatomyFamily, createContextKey, definePrototype } from '@proto.ui/core';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { createRuntimeSession, type RuntimeHost } from '../../src';

type Props = { enabled: boolean };
const host = (name: string): RuntimeHost<Props> => ({
  prototypeName: name,
  getRawProps: () => ({ enabled: false }),
  commit(_children, signal) {
    signal?.done();
  },
  schedule(task) {
    task();
  },
});

describe('real native observation registration and later State delivery', () => {
  it('Props stores the callback, suppresses hydration, and later supplies all four callback arguments', async () => {
    const trace: string[] = [];
    let readSelected = () => false;
    const prototype = definePrototype<Props>({
      name: 'native-observation-props',
      setup(def) {
        def.props.define({ enabled: { type: 'boolean' } });
        const selected = def.state.bool('privateSelection', false);
        readSelected = () => selected.get();
        trace.push('before');
        def.props.watch(['enabled'], function (run, next, prev, info) {
          expect(arguments.length).toBe(4);
          expect([prev.enabled, next.enabled]).toEqual([false, true]);
          expect(run.props.get().enabled).toBe(true);
          expect(info).toBeDefined();
          selected.set(next.enabled, 'resolved observation');
          trace.push('callback');
        });
        trace.push('after');
        expect(selected.get()).toBe(false);
        return (r) => r.el('div', selected.get() ? 'selected' : 'idle');
      },
    });
    const session = createRuntimeSession(prototype, host(prototype.name));
    try {
      expect(trace).toEqual(['before', 'after']);
      await session.mount();
      expect(trace).toEqual(['before', 'after']);
      expect(readSelected()).toBe(false);
      session.controller.applyRawProps({ enabled: true });
      expect(trace).toEqual(['before', 'after', 'callback']);
      expect(readSelected()).toBe(true);
      session.controller.applyRawProps({ enabled: true });
      expect(trace).toEqual(['before', 'after', 'callback']);
    } finally {
      await session.dispose();
    }
  });

  it('Context keeps the frozen key and only invokes the three-argument subscription after an update', async () => {
    const key = createContextKey<{ enabled: boolean }>('native-observation-context');
    expect(Object.isFrozen(key)).toBe(true);
    const token = {};
    const trace: string[] = [];
    let readSelected = () => false;
    const prototype = definePrototype<Props>({
      name: 'native-observation-context',
      setup(def) {
        def.props.define({ enabled: { type: 'boolean' } });
        const selected = def.state.bool('privateSelection', false);
        readSelected = () => selected.get();
        def.context.provide(key, { enabled: false });
        trace.push('before');
        def.context.subscribe(key, function (run, next, prev) {
          expect(arguments.length).toBe(3);
          expect([prev.enabled, next.enabled]).toEqual([false, true]);
          expect(run.context.read(key)).toEqual(next);
          selected.set(next.enabled, 'context observation');
          trace.push('callback');
        });
        trace.push('after');
        def.props.watch(['enabled'], (run, next) =>
          run.context.update(key, { enabled: next.enabled })
        );
        return (r) => r.el('div', selected.get() ? 'selected' : 'idle');
      },
    });
    const ownerHost = host(prototype.name);
    ownerHost.onRuntimeReady = (wiring) => {
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, token],
        [CONTEXT_PARENT_CAP, () => null],
      ]);
    };
    const session = createRuntimeSession(prototype, ownerHost);
    try {
      expect(trace).toEqual(['before', 'after']);
      await session.mount();
      expect(trace).toEqual(['before', 'after']);
      expect(readSelected()).toBe(false);
      session.controller.applyRawProps({ enabled: true });
      expect(trace).toEqual(['before', 'after', 'callback']);
      expect(readSelected()).toBe(true);
    } finally {
      await session.dispose();
    }
  });

  it('Anatomy has no registration emission and supplies the changed real membership to its two-argument callback', async () => {
    const family = createAnatomyFamily('native-observation-anatomy', {
      roles: {
        root: { cardinality: { min: 1, max: 1 } },
        item: { cardinality: { min: 0, max: 1 } },
      },
    });
    expect(Object.isFrozen(family)).toBe(true);
    expect(Object.isFrozen(family.decl)).toBe(true);
    expect(Object.isFrozen(family.decl.roles)).toBe(true);
    const root = document.createElement('div');
    const item = document.createElement('div');
    root.append(item);
    document.body.append(root);
    const trace: string[] = [];
    const counts: number[] = [];
    let readCount = () => 0;
    const rootPrototype = definePrototype({
      name: 'native-observation-anatomy-root',
      setup(def) {
        def.anatomy.claim(family, { role: 'root' });
        const count = def.state.numberDiscrete('privateCount', 0);
        readCount = () => count.get();
        trace.push('before');
        def.anatomy.subscribeParts(family, 'item', function (run, parts) {
          expect(arguments.length).toBe(2);
          expect(run.anatomy.order.partsOf(family, 'item').length).toBe(parts.length);
          counts.push(parts.length);
          count.set(parts.length, 'membership observation');
          trace.push('callback');
        });
        trace.push('after');
        return (r) => r.el('div', String(count.get()));
      },
    });
    const itemPrototype = definePrototype({
      name: 'native-observation-anatomy-item',
      setup(def) {
        def.anatomy.claim(family, { role: 'item' });
        return (r) => r.el('div', 'item');
      },
    });
    const anatomyHost = (
      element: HTMLElement,
      name: string
    ): RuntimeHost<Record<string, unknown>> => ({
      prototypeName: name,
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, element],
          [ANATOMY_PARENT_CAP, (instance: unknown) => (instance === item ? root : null)],
          [
            ANATOMY_GET_PROTO_CAP,
            (instance: unknown) =>
              instance === root ? rootPrototype : instance === item ? itemPrototype : null,
          ],
          [
            ANATOMY_ROOT_TARGET_CAP,
            (instance: unknown) => (instance instanceof HTMLElement ? instance : null),
          ],
        ]);
      },
    });
    const owner = createRuntimeSession(rootPrototype, anatomyHost(root, rootPrototype.name));
    let child: ReturnType<typeof createRuntimeSession> | undefined;
    try {
      expect(trace).toEqual(['before', 'after']);
      expect(counts).toEqual([]);
      await owner.mount();
      expect(counts).toEqual([]);
      expect(readCount()).toBe(0);
      child = createRuntimeSession(itemPrototype, anatomyHost(item, itemPrototype.name));
      await child.mount();
      owner.controller.update();
      expect(counts).toEqual([1]);
      expect(readCount()).toBe(1);
      owner.controller.update();
      expect(counts).toEqual([1]);
      await child.unmount();
      owner.controller.update();
      // M-ANATOMY-0001-E retains the logical claim across view detachment.
      expect(counts).toEqual([1]);
      expect(readCount()).toBe(1);
      await child.mount();
      owner.controller.update();
      expect(counts).toEqual([1]);
      expect(readCount()).toBe(1);
      await child.dispose();
      owner.controller.update();
      expect(counts).toEqual([1, 0]);
      expect(readCount()).toBe(0);
    } finally {
      await child?.dispose();
      await owner.dispose();
      root.remove();
    }
  });
});
