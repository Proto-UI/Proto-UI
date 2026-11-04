import { afterEach, describe, expect, it } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import type { FeedbackFacade } from '@proto.ui/module-feedback';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import {
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_GET_PROTO_CAP,
} from '@proto.ui/module-anatomy';
import {
  AS_TRIGGER_INSTANCE_CAP,
  AS_TRIGGER_PARENT_CAP,
  AS_TRIGGER_GET_PROTO_CAP,
} from '@proto.ui/module-as-trigger';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import { RULE_META_GET_CAP, RULE_META_PREFERENCE_SOURCE_CAP } from '@proto.ui/module-rule-meta';
import { selectRoot, selectItem } from '../src/select';
import type { ExposePort } from '@proto.ui/module-expose';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

// Real public prototypes, real parent Context/anatomy and the existing host
// preference capability. No replacement implementation or source-string oracle.
async function mount() {
  const rootTarget = new EventTarget();
  const targets = [new EventTarget(), new EventTarget()];
  const globalTarget = new EventTarget();
  const protos = new Map<object, Prototype<any>>([
    [rootTarget, selectRoot],
    [targets[0], selectItem],
    [targets[1], selectItem],
  ]);
  const parent = (value: unknown) => (targets.includes(value as EventTarget) ? rootTarget : null);
  const getProto = (value: unknown) => protos.get(value as object) ?? null;
  let preference: unknown = 'unknown';
  const listeners = new Set<() => void>();
  const getter = (key: string) => (key === 'preference.reducedMotion' ? preference : null);
  const host = (token: EventTarget, raw: Record<string, unknown>): RuntimeHost<any> => ({
    prototypeName: protos.get(token)!.name,
    getRawProps: () => raw,
    commit(_children, signal) {
      signal?.done();
    },
    schedule(task) {
      task();
    },
    scheduleDelay(durationMs, task) {
      const timer = setTimeout(task, durationMs);
      return {
        cancel() {
          clearTimeout(timer);
        },
      };
    },
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => token],
        [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
      ]);
      wiring.attach('as-trigger', [
        [AS_TRIGGER_INSTANCE_CAP, token],
        [AS_TRIGGER_PARENT_CAP, parent],
        [AS_TRIGGER_GET_PROTO_CAP, getProto],
      ]);
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, token],
        [CONTEXT_PARENT_CAP, parent],
      ]);
      wiring.attach('anatomy', [
        [ANATOMY_INSTANCE_TOKEN_CAP, token],
        [ANATOMY_PARENT_CAP, parent],
        [ANATOMY_GET_PROTO_CAP, getProto],
      ]);
      wiring.attach('rule-meta', [
        [RULE_META_GET_CAP, getter],
        [
          RULE_META_PREFERENCE_SOURCE_CAP,
          {
            getter,
            subscribe(keys: readonly string[], invalidate: () => void) {
              expect(keys).toEqual(['preference.reducedMotion']);
              listeners.add(invalidate);
              return () => {
                listeners.delete(invalidate);
              };
            },
          },
        ],
      ]);
    },
  });
  const owner = createRuntimeSession(selectRoot, host(rootTarget, { defaultValue: 'alpha' }));
  cleanups.push(() => owner.dispose());
  await owner.mount();
  const items = [];
  for (const [index, target] of targets.entries()) {
    const value = index === 0 ? 'alpha' : 'beta';
    const session = createRuntimeSession(selectItem, host(target, { value, textValue: value }));
    cleanups.push(() => session.dispose());
    await session.mount();
    items.push({
      session,
      target,
      timing: () =>
        session.controller.getRuleStyleTokens().filter((token) => token.startsWith('transition-')),
      paint: () =>
        (session.caps.getFacades().feedback as FeedbackFacade).style.exportMerged().tokens,
      selected: () =>
        (session.caps.getPort<ExposePort>('expose')!.get('selected') as { get(): boolean }).get(),
      update: (next: Record<string, unknown>) =>
        session.controller.applyRawProps({ value, textValue: value, ...next }),
    });
  }
  return {
    items,
    listeners,
    preference(value: unknown) {
      preference = value;
      for (const invalidate of listeners) invalidate();
    },
  };
}

const pair = ['bg-main', 'text-main-foreground', 'border-black'];
const highlight = (item: Awaited<ReturnType<typeof mount>>['items'][number]) =>
  pair.every((token) => item.paint().includes(token));

it('uses incoming-only colors without changing selected-only paint or geometry', async () => {
  const m = await mount();
  const [a, b] = m.items;
  expect(a.selected()).toBe(true);
  expect(b.selected()).toBe(false);
  m.preference('no-preference');
  expect(a.timing()).toEqual(['transition-none']);
  expect(highlight(a)).toBe(false);
  const geometry = a
    .paint()
    .filter((token) => !token.startsWith('transition-') && !pair.includes(token));
  a.target.dispatchEvent(new CustomEvent('pointer.enter'));
  expect(a.timing()).toEqual(['transition-[border-color]']);
  expect(highlight(a)).toBe(true);
  expect(
    a.paint().some((token) => token.startsWith('translate-') || token.startsWith('shadow-'))
  ).toBe(false);
  a.target.dispatchEvent(new CustomEvent('pointer.leave'));
  expect(a.timing()).toEqual(['transition-none']);
  expect(highlight(a)).toBe(false);
  expect(
    a.paint().filter((token) => !token.startsWith('transition-') && !pair.includes(token))
  ).toEqual(geometry);
  expect(a.selected()).toBe(true);
});

it('keeps real highlight paint responsive throughout live reduce and unknown round trips', async () => {
  const m = await mount();
  const [a] = m.items;
  for (const preference of ['no-preference', 'reduce', 'unknown', null, 'no-preference']) {
    m.preference(preference);
    a.target.dispatchEvent(new CustomEvent('pointer.enter'));
    expect(a.timing()).toEqual([
      preference === 'no-preference' ? 'transition-[border-color]' : 'transition-none',
    ]);
    expect(highlight(a)).toBe(true);
    const paint = a.paint().filter((token) => !token.startsWith('transition-'));
    m.preference('reduce');
    expect(a.timing()).toEqual(['transition-none']);
    expect(a.paint().filter((token) => !token.startsWith('transition-'))).toEqual(paint);
    a.target.dispatchEvent(new CustomEvent('pointer.leave'));
    expect(a.timing()).toEqual(['transition-none']);
    expect(highlight(a)).toBe(false);
  }
});

it('drops outgoing timing before a different real Item takes incoming paint', async () => {
  const m = await mount();
  const [a, b] = m.items;
  m.preference('no-preference');
  for (let repeat = 0; repeat < 3; repeat++) {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      from.target.dispatchEvent(new CustomEvent('pointer.enter'));
      expect(highlight(from)).toBe(true);
      from.target.dispatchEvent(new CustomEvent('pointer.leave'));
      to.target.dispatchEvent(new CustomEvent('pointer.enter'));
      expect(from.timing()).toEqual(['transition-none']);
      expect(highlight(from)).toBe(false);
      expect(to.timing()).toEqual(['transition-[border-color]']);
      expect(highlight(to)).toBe(true);
      expect(m.items.filter(highlight)).toHaveLength(1);
      to.target.dispatchEvent(new CustomEvent('pointer.leave'));
    }
  }
});

it('disabled projection removes timing without gaining a new action owner', async () => {
  const m = await mount();
  const [a] = m.items;
  m.preference('no-preference');
  a.target.dispatchEvent(new CustomEvent('pointer.enter'));
  expect(a.timing()).toEqual(['transition-[border-color]']);
  a.update({ disabled: true });
  expect(a.timing()).toEqual(['transition-none']);
  expect(a.paint()).toEqual(expect.arrayContaining(['pointer-events-none', 'opacity-50']));
  expect(
    a.paint().some((token) => token.startsWith('translate-') || token.startsWith('shadow-'))
  ).toBe(false);
  a.update({ disabled: false });
  a.target.dispatchEvent(new CustomEvent('pointer.enter'));
  expect(a.timing()).toEqual(['transition-[border-color]']);
});

it('owns one preference lease per actual Item and releases both on disposal', async () => {
  const m = await mount();
  expect(m.listeners.size).toBe(2);
  await m.items[0].session.dispose();
  expect(m.listeners.size).toBe(1);
  await m.items[1].session.dispose();
  expect(m.listeners.size).toBe(0);
  m.preference('reduce');
  expect(m.listeners.size).toBe(0);
});
