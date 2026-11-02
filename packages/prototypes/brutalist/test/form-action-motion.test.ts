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
import { formRoot, formSubmit, formReset } from '../src/form';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

// Real public prototypes, real parent Context/anatomy and the existing host
// preference capability. No replacement implementation or source-string oracle.
async function mount(subject: 'submit' | 'reset', props: Record<string, unknown> = {}) {
  const rootTarget = new EventTarget();
  const target = new EventTarget();
  const globalTarget = new EventTarget();
  const prototype: Prototype<any> = subject === 'submit' ? formSubmit : formReset;
  const protos = new Map<object, Prototype<any>>([
    [rootTarget, formRoot],
    [target, prototype],
  ]);
  const parent = (value: unknown) => (value === target ? rootTarget : null);
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
  const owner = createRuntimeSession(formRoot, host(rootTarget, {}));
  cleanups.push(() => owner.dispose());
  await owner.mount();
  const session = createRuntimeSession(prototype, host(target, props));
  cleanups.push(() => session.dispose());
  await session.mount();
  return {
    session,
    ownerUpdate: (next: Record<string, unknown>) => owner.controller.applyRawProps(next),
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

for (const subject of ['submit', 'reset'] as const) {
  describe(`Brutalist Form ${subject}`, () => {
    it('has one live preference writer and disposes its subscription', async () => {
      const m = await mount(subject);
      expect(m.timing()).toEqual(['transition-none']);
      expect(m.listeners.size).toBe(1);
      for (const value of ['no-preference', 'reduce', 'unknown', null, 'no-preference']) {
        m.preference(value);
        expect(m.timing()).toEqual([
          value === 'no-preference' ? 'transition-all' : 'transition-none',
        ]);
      }
      await m.session.dispose();
      expect(m.listeners.size).toBe(0);
      m.preference('reduce');
      expect(m.listeners.size).toBe(0);
    });
    it('retains actual endpoints through repeated and interrupted hover/press', async () => {
      const m = await mount(subject);
      for (const preference of ['no-preference', 'reduce', 'unknown']) {
        m.preference(preference);
        for (let repeat = 0; repeat < 2; repeat++) {
          m.target.dispatchEvent(new CustomEvent('pointer.enter'));
          expect(m.mergedTokens()).toEqual(
            expect.arrayContaining(['translate-x-1', 'translate-y-1', 'shadow-none'])
          );
          m.target.dispatchEvent(new CustomEvent('pointer.down'));
          m.preference('reduce');
          expect(m.timing()).toEqual(['transition-none']);
          expect(m.mergedTokens()).toContain('translate-x-1');
          m.target.dispatchEvent(new CustomEvent('pointer.cancel'));
          expect(m.mergedTokens()).not.toContain('translate-x-1');
          expect(m.mergedTokens()).toContain('shadow-[4px_4px_0_0_#000]');
          m.preference(preference);
        }
      }
    });
    it('clears movement under parent and local disabled without replacing timing', async () => {
      const m = await mount(subject);
      m.preference('no-preference');
      m.target.dispatchEvent(new CustomEvent('pointer.enter'));
      m.target.dispatchEvent(new CustomEvent('pointer.down'));
      m.ownerUpdate({ disabled: true });
      expect(m.mergedTokens()).not.toContain('translate-x-1');
      expect(m.mergedTokens()).toContain('pointer-events-none');
      expect(m.timing()).toEqual(['transition-all']);
      m.update({ disabled: true });
      m.ownerUpdate({ disabled: false });
      m.target.dispatchEvent(new CustomEvent('pointer.enter'));
      expect(m.mergedTokens()).not.toContain('translate-x-1');
      m.update({});
      m.target.dispatchEvent(new CustomEvent('pointer.enter'));
      expect(m.mergedTokens()).toContain('translate-x-1');
    });
  });
}

// Adapter-backed DOM behavior, not a real-browser animation measurement.
for (const prototype of [formRoot, formSubmit, formReset]) AdaptToWebComponent(prototype);
const flush = async () => {
  for (let i = 0; i < 35; i++) await Promise.resolve();
};
for (const action of ['submit', 'reset'] as const) {
  it(`keeps exactly one real Form ${action} event and inherited disabled behavior`, async () => {
    const root = document.createElement('brutalist-form-root');
    const button = document.createElement(`brutalist-form-${action}`);
    root.append(button);
    document.body.append(root);
    cleanups.push(async () => {
      root.remove();
      await flush();
    });
    await flush();
    let count = 0;
    root.addEventListener(action, () => count++);
    button.click();
    await flush();
    expect(count).toBe(1);
    setElementProps(root, { disabled: true });
    await flush();
    button.click();
    await flush();
    expect(count).toBe(1);
    setElementProps(button, { disabled: true });
    setElementProps(root, { disabled: false });
    await flush();
    button.click();
    await flush();
    expect(count).toBe(1);
    setElementProps(button, { disabled: false });
    await flush();
    button.click();
    await flush();
    expect(count).toBe(2);
  });
}
