import { describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { RuntimeHost } from '../../src';
import { executeWithHost } from '../../src';
import { EXPOSES_RECORD_SINK_CAP } from '@proto.ui/module-expose-state';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
} from '@proto.ui/module-focus';
import {
  AS_TRIGGER_GET_PROTO_CAP,
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
} from '@proto.ui/module-as-trigger';
import dropdownContent from '../../../prototypes/base/src/dropdown/content.proto';
import dropdownItem from '../../../prototypes/base/src/dropdown/item.proto';
import dropdownRoot from '../../../prototypes/base/src/dropdown/root.proto';

class FakeNodeTarget extends EventTarget {
  constructor(
    readonly id: string,
    private readonly orderMap: Map<string, number>
  ) {
    super();
  }

  compareDocumentPosition(other: FakeNodeTarget): number {
    const a = this.orderMap.get(this.id) ?? 0;
    const b = this.orderMap.get(other.id) ?? 0;
    if (a < b) return 4;
    if (a > b) return 2;
    return 0;
  }

  dispatch(type: string, detail?: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

function createDropdownRuntimeTree(options?: {
  rootRaw?: Record<string, unknown>;
  itemARaw?: Record<string, unknown>;
  itemBRaw?: Record<string, unknown>;
}) {
  const orderMap = new Map<string, number>([
    ['root', 0],
    ['content', 1],
    ['item-a', 2],
    ['item-b', 3],
  ]);
  const globalTarget = new FakeNodeTarget('global', new Map());
  const targets = {
    root: new FakeNodeTarget('root', orderMap),
    content: new FakeNodeTarget('content', orderMap),
    itemA: new FakeNodeTarget('item-a', orderMap),
    itemB: new FakeNodeTarget('item-b', orderMap),
  };
  const parents = new Map<unknown, unknown | null>([
    [targets.root, null],
    [targets.content, targets.root],
    [targets.itemA, targets.content],
    [targets.itemB, targets.content],
  ]);
  const protos = new Map<unknown, Prototype<any>>([
    [targets.root, dropdownRoot as any],
    [targets.content, dropdownContent as any],
    [targets.itemA, dropdownItem as any],
    [targets.itemB, dropdownItem as any],
  ]);

  const createHost = (args: {
    prototypeName: string;
    target: FakeNodeTarget;
    raw?: Record<string, unknown>;
  }) => {
    const scheduled: Array<() => void> = [];
    let raw = { ...(args.raw ?? {}) };
    let exposes: Record<string, any> | null = null;
    let runInCallbackScope: ((fn: () => void) => void) | null = null;

    const host: RuntimeHost<any> = {
      prototypeName: args.prototypeName,
      getRawProps: () => raw,
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        scheduled.push(task);
      },
      scheduleDelay(_durationMs, task) {
        let active = true;
        scheduled.push(() => {
          if (active) task();
        });
        return {
          cancel() {
            active = false;
          },
        };
      },
      onRuntimeReady(wiring) {
        wiring.attach('expose-state', [
          [EXPOSES_RECORD_SINK_CAP, (next: Record<string, unknown>) => (exposes = next)],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => args.target],
          [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
        ]);
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, args.target],
          [ANATOMY_PARENT_CAP, (instance: unknown) => parents.get(instance) ?? null],
          [ANATOMY_GET_PROTO_CAP, (instance: unknown) => protos.get(instance) ?? null],
          [ANATOMY_ROOT_TARGET_CAP, (instance: unknown) => instance as FakeNodeTarget],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, args.target],
          [CONTEXT_PARENT_CAP, (instance: unknown) => parents.get(instance) ?? null],
        ]);
        wiring.attach('focus', [
          [FOCUS_INSTANCE_TOKEN_CAP, args.target],
          [FOCUS_PARENT_CAP, (instance: unknown) => parents.get(instance) ?? null],
          [
            FOCUS_RUN_IN_CALLBACK_CAP,
            (fn: () => void) => {
              if (runInCallbackScope) {
                runInCallbackScope(fn);
                return;
              }
              fn();
            },
          ],
        ]);
        wiring.attach('as-trigger', [
          [AS_TRIGGER_INSTANCE_CAP, args.target],
          [AS_TRIGGER_PARENT_CAP, (instance: unknown) => parents.get(instance) ?? null],
          [AS_TRIGGER_GET_PROTO_CAP, (instance: unknown) => protos.get(instance) ?? null],
        ]);
      },
    };

    return {
      host,
      scheduled,
      target: args.target,
      getExposes: () => exposes,
      setRunInCallbackScope(next: (fn: () => void) => void) {
        runInCallbackScope = next;
      },
      applyRawProps(next: Record<string, unknown>) {
        raw = { ...next };
      },
    };
  };

  const root = createHost({
    prototypeName: dropdownRoot.name,
    target: targets.root,
    raw: options?.rootRaw,
  });
  const content = createHost({
    prototypeName: dropdownContent.name,
    target: targets.content,
  });
  const itemA = createHost({
    prototypeName: dropdownItem.name,
    target: targets.itemA,
    raw: { value: 'a', textValue: 'Alpha', ...(options?.itemARaw ?? {}) },
  });
  const itemB = createHost({
    prototypeName: dropdownItem.name,
    target: targets.itemB,
    raw: { value: 'b', textValue: 'Beta', ...(options?.itemBRaw ?? {}) },
  });

  const execs = {
    root: executeWithHost(dropdownRoot as any, root.host as any),
    content: executeWithHost(dropdownContent as any, content.host as any),
    itemA: executeWithHost(dropdownItem as any, itemA.host as any),
    itemB: executeWithHost(dropdownItem as any, itemB.host as any),
  };
  root.setRunInCallbackScope(execs.root.invokeInCallbackScope);
  content.setRunInCallbackScope(execs.content.invokeInCallbackScope);
  itemA.setRunInCallbackScope(execs.itemA.invokeInCallbackScope);
  itemB.setRunInCallbackScope(execs.itemB.invokeInCallbackScope);

  const syncAll = () => {
    execs.root.controller.update();
    execs.content.controller.update();
    execs.itemA.controller.update();
    execs.itemB.controller.update();
  };

  syncAll();

  return {
    root,
    content,
    itemA,
    itemB,
    execs,
    syncAll,
  };
}

describe('runtime contract: dropdown-menu (v0)', () => {
  it('DROPDOWN-RT-0000: root exposes open state and collection APIs, but not transient active navigation state', () => {
    const tree = createDropdownRuntimeTree();
    const rootExposes = tree.root.getExposes() as any;

    expect(rootExposes.open).toBeTruthy();
    expect(typeof rootExposes.getCollectionItems).toBe('function');
    expect(rootExposes.activeValue).toBeUndefined();
  });

  it('DROPDOWN-RT-0100: closeOnItemCommit is the root policy, and item closeOnCommit may override it', () => {
    const keepOpen = createDropdownRuntimeTree({
      rootRaw: { defaultOpen: true, closeOnItemCommit: false },
    });

    const keepOpenRoot = keepOpen.root.getExposes() as any;
    const keepOpenItemA = keepOpen.itemA.getExposes() as any;
    keepOpen.itemA.target.dispatch('press.commit');

    expect(keepOpenRoot.open.get()).toBe(true);
    expect(keepOpenItemA.active.get()).toBe(true);

    const itemOverride = createDropdownRuntimeTree({
      rootRaw: { defaultOpen: true, closeOnItemCommit: false },
      itemARaw: { closeOnCommit: true },
    });

    const itemOverrideRoot = itemOverride.root.getExposes() as any;
    const itemOverrideItemA = itemOverride.itemA.getExposes() as any;
    itemOverride.itemA.target.dispatch('press.commit');

    expect(itemOverrideRoot.open.get()).toBe(false);
    expect(itemOverrideItemA.active.get()).toBe(false);
  });

  it('DROPDOWN-RT-0200: active item state is transient and MUST NOT persist across close/reopen sync', () => {
    const tree = createDropdownRuntimeTree({
      rootRaw: { open: true },
    });
    const rootExposes = tree.root.getExposes() as any;
    const itemAExposes = tree.itemA.getExposes() as any;
    const itemBExposes = tree.itemB.getExposes() as any;

    tree.itemB.target.dispatch('host:focus');
    expect(itemBExposes.active.get()).toBe(true);
    expect(itemAExposes.active.get()).toBe(false);

    tree.root.applyRawProps({ open: false });
    tree.execs.root.controller.applyRawProps({ open: false } as any);
    expect(rootExposes.open.get()).toBe(false);
    expect(itemAExposes.active.get()).toBe(false);
    expect(itemBExposes.active.get()).toBe(false);

    tree.root.applyRawProps({ open: true });
    tree.execs.root.controller.applyRawProps({ open: true } as any);
    expect(rootExposes.open.get()).toBe(true);
    expect(itemBExposes.active.get()).toBe(false);
  });

  it('DROPDOWN-RT-0300: controlled open state ignores item commit close requests and only changes through prop sync', () => {
    const tree = createDropdownRuntimeTree({
      rootRaw: { open: true },
    });
    const rootExposes = tree.root.getExposes() as any;
    const itemAExposes = tree.itemA.getExposes() as any;

    tree.itemA.target.dispatch('press.commit');
    expect(rootExposes.open.get()).toBe(true);
    expect(itemAExposes.active.get()).toBe(true);

    tree.root.applyRawProps({ open: false });
    tree.execs.root.controller.applyRawProps({ open: false } as any);

    expect(rootExposes.open.get()).toBe(false);
    expect(itemAExposes.active.get()).toBe(false);
  });
});
