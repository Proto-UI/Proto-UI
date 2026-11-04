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
import { selectRoot, selectTrigger } from '../src/select';
import surface from '../src/surface/root.proto';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

// Real public prototypes, real parent Context/anatomy and the existing host
// preference capability. No replacement implementation or source-string oracle.
async function mount(subject: 'select' | 'surface', props: Record<string, unknown> = {}) {
  const rootTarget = new EventTarget();
  const target = new EventTarget();
  const globalTarget = new EventTarget();
  const prototype: Prototype<any> = subject === 'select' ? selectTrigger : surface;
  const protos = new Map<object, Prototype<any>>([
    [rootTarget, selectRoot],
    [target, prototype],
  ]);
  const parent = (value: unknown) => (subject === 'select' && value === target ? rootTarget : null);
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
  if (subject === 'select') {
    const owner = createRuntimeSession(selectRoot, host(rootTarget, { defaultValue: 'alpha' }));
    cleanups.push(() => owner.dispose());
    await owner.mount();
  }
  const session = createRuntimeSession(prototype, host(target, props));
  cleanups.push(() => session.dispose());
  await session.mount();
  return {
    session,
    target,
    listeners,
    tokens: () => session.controller.getRuleStyleTokens(),
    mergedTokens: () =>
      (session.caps.getFacades().feedback as FeedbackFacade).style.exportMerged().tokens,
    timing: () =>
      session.controller.getRuleStyleTokens().filter((token) => token.startsWith('transition-')),
    update: (next: Record<string, unknown>) => session.controller.applyRawProps(next),
    preference(value: unknown) {
      preference = value;
      for (const invalidate of listeners) invalidate();
    },
  };
}

const subjects = [
  ['select', { appearance: 'elevated' }],
  ['surface', { elevation: 'raised' }],
] as const;

for (const [subject, raised] of subjects) {
  describe(`Brutalist ${subject} action timing`, () => {
    it('has one live timing writer and makes unknown/reduce static', async () => {
      const m = await mount(subject, raised);
      expect(m.timing()).toEqual(['transition-none']);
      expect(m.listeners.size).toBe(1);
      for (const [preference, expected] of [
        ['no-preference', 'transition-all'],
        ['reduce', 'transition-none'],
        ['unknown', 'transition-none'],
        [null, 'transition-none'],
        ['no-preference', 'transition-all'],
      ]) {
        m.preference(preference);
        expect(m.timing()).toEqual([expected]);
      }
      await m.session.dispose();
      expect(m.listeners.size).toBe(0);
      m.preference('reduce');
      expect(m.listeners.size).toBe(0);
    });

    it('keeps timing through repeated hover/press/release without adding displacement', async () => {
      const m = await mount(subject, raised);
      m.preference('no-preference');
      for (let repeat = 0; repeat < 2; repeat++) {
        if (subject === 'select') m.target.dispatchEvent(new CustomEvent('pointer.enter'));
        else m.update({ ...raised, hovered: true });
        expect(m.tokens()).toEqual(
          expect.arrayContaining(['translate-x-1', 'translate-y-1', 'shadow-none'])
        );
        expect(m.timing()).toEqual(['transition-all']);
        if (subject === 'select') m.target.dispatchEvent(new CustomEvent('pointer.down'));
        else m.update({ ...raised, hovered: true, pressed: true });
        expect(
          m
            .tokens()
            .filter((token) => token.startsWith('translate-'))
            .sort()
        ).toEqual(['translate-x-1', 'translate-y-1']);
        m.preference('reduce');
        expect(m.timing()).toEqual(['transition-none']);
        if (subject === 'select') {
          m.target.dispatchEvent(new CustomEvent('pointer.up'));
          m.target.dispatchEvent(new CustomEvent('pointer.leave'));
        } else m.update(raised);
        expect(m.tokens()).toContain('shadow-[4px_4px_0_0_#000]');
        expect(m.tokens()).not.toContain('translate-x-1');
        m.preference('no-preference');
        expect(m.timing()).toEqual(['transition-all']);
      }
    });

    it('withdraws category timing and movement on prop removal while hovered', async () => {
      const m = await mount(subject, raised);
      m.preference('no-preference');
      if (subject === 'select') m.target.dispatchEvent(new CustomEvent('pointer.enter'));
      else m.update({ ...raised, hovered: true });
      m.update(subject === 'select' ? {} : { hovered: true });
      expect(m.timing()).toEqual([]);
      expect(m.tokens()).not.toContain('translate-x-1');
      expect(m.tokens()).not.toContain('shadow-[4px_4px_0_0_#000]');
      m.update(raised);
      expect(m.timing()).toEqual(['transition-all']);
    });
  });
}

it('leaves default flat Trigger geometry and unchanged hover color endpoints intact', async () => {
  const m = await mount('select');
  m.preference('no-preference');
  // Read the real feedback recorder's setup plus live rule composition. A rule
  // reasserting the existing black frame is not a new paint endpoint.
  const paint = () =>
    [...m.mergedTokens()]
      .filter((token) => /^(bg-|text-main|border-black|translate-|shadow-)/.test(token))
      .sort();
  const before = paint();
  expect(before).toEqual(['bg-main', 'border-black', 'text-main-foreground']);
  for (const event of ['pointer.enter', 'pointer.down', 'pointer.up', 'pointer.leave']) {
    m.target.dispatchEvent(new CustomEvent(event));
    expect(paint()).toEqual(before);
    expect(m.mergedTokens().filter((token) => /^(translate-|shadow-)/.test(token))).toEqual([]);
    expect(m.timing()).toEqual([]);
  }
  // No visible hover transition is claimed: existing flat endpoints are equal.
});

it('does not compete with the Surface opacity fade clock, including raised surfaces', async () => {
  const m = await mount('surface', {
    elevation: 'raised',
    fade: true,
    transitionState: 'entering',
  });
  for (const preference of ['no-preference', 'reduce', 'unknown']) {
    m.preference(preference);
    expect(m.timing()).toEqual([]);
    expect(m.tokens()).toContain('surface-fade');
    expect(m.tokens()).toContain('opacity-100');
  }
  m.update({ elevation: 'raised', fade: true, transitionState: 'leaving' });
  expect(m.tokens()).toContain('opacity-0');
  m.update({ elevation: 'raised' });
  expect(m.tokens()).not.toContain('surface-fade');
  expect(m.timing()).toEqual(['transition-none']);
  m.preference('no-preference');
  expect(m.timing()).toEqual(['transition-all']);
});

it('retains the Select disabled gate without inventing an animation activation channel', async () => {
  const m = await mount('select', { appearance: 'elevated', disabled: true });
  m.preference('no-preference');
  m.target.dispatchEvent(new CustomEvent('pointer.enter'));
  m.target.dispatchEvent(new CustomEvent('pointer.down'));
  expect(m.tokens()).toContain('pointer-events-none');
  expect(m.tokens()).toContain('opacity-50');
  expect(m.tokens()).not.toContain('translate-x-1');
  expect(m.timing()).toEqual(['transition-all']);
});
