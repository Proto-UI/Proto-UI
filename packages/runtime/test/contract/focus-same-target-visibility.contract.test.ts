import { describe, expect, it } from 'vitest';
import { definePrototype, type FocusRequestOptions } from '@proto.ui/core';
import { asFocusable } from '@proto.ui/hooks';
import { createRuntimeSession } from '@proto.ui/runtime';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import {
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_TARGET_READY_CAP,
  type FocusPort,
  type FocusRequestKind,
} from '@proto.ui/module-focus';

let identity = 0;
async function fixture() {
  let focusable!: ReturnType<typeof asFocusable>;
  const root = document.createElement('button');
  document.body.append(root);
  let target: HTMLElement | null = root;
  let query: () => boolean = () => true;
  let samples = 0;
  let apply: () => boolean = () => true;
  const listeners = new Set<() => void>();
  const attempts: Array<{
    target: HTMLElement;
    options: FocusRequestOptions | undefined;
    kind: FocusRequestKind;
  }> = [];
  const originalMatches = root.matches;
  const installQuery = () => {
    Object.defineProperty(root, 'matches', {
      configurable: true,
      value(selector: string) {
        if (selector !== ':focus-visible') return originalMatches.call(root, selector);
        samples += 1;
        return query();
      },
    });
  };
  installQuery();
  const proto = definePrototype({
    name: `focus-same-target-visibility-${++identity}`,
    setup() {
      focusable = asFocusable();
      return (r) => r.el('button');
    },
  });
  const session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => ({}),
    schedule: (fn) => fn(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => root],
        [EVENT_GLOBAL_TARGET_CAP, () => window],
      ]);
      wiring.attach('focus', [
        [FOCUS_INSTANCE_TOKEN_CAP, {}],
        [FOCUS_PARENT_CAP, () => null],
        [FOCUS_ROOT_TARGET_CAP, () => target],
        [
          FOCUS_REQUEST_FOCUS_CAP,
          (
            nextTarget: HTMLElement,
            options: FocusRequestOptions | undefined,
            kind: FocusRequestKind
          ) => {
            attempts.push({ target: nextTarget, options, kind });
            // Intentionally no host:focus emission. Same-target native focus can
            // succeed without another event. This capability is a controlled seam.
            return apply();
          },
        ],
        [
          FOCUS_TARGET_READY_CAP,
          (listener: () => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        ],
      ]);
    },
  });
  await session.mount();
  return {
    root,
    focusable,
    attempts,
    port: session.caps.getPort<FocusPort>('focus')!,
    samples: () => samples,
    observe() {
      root.dispatchEvent(new Event('host:focus'));
    },
    setQuery(next: typeof query) {
      query = next;
      installQuery();
    },
    unsupported() {
      Object.defineProperty(root, 'matches', { configurable: true, value: undefined });
    },
    setApply(next: typeof apply) {
      apply = next;
    },
    setTarget(next: HTMLElement | null) {
      target = next;
    },
    ready() {
      for (const listener of [...listeners]) listener();
    },
    async cleanup() {
      await session.dispose();
      root.remove();
    },
  };
}

// Actual Runtime + Focus/Center, controlled host/query boundaries. Not native
// browser, host-effect deduplication, or four-Adapter/compiled acceptance.
describe('same observed target native visibility refresh', () => {
  it('preserves a true native result during repeated pointer requests', async () => {
    const f = await fixture();
    try {
      f.observe();
      const before = f.samples();
      for (let i = 0; i < 3; i++) f.focusable.focusSelf({ reason: 'pointer', preventScroll: true });
      expect(f.samples()).toBe(before + 3);
      expect(f.focusable.focusVisible.get()).toBe(true);
      expect(f.port.getFacts()).toMatchObject({ focused: true, active: true });
      expect(f.attempts.map(({ options, kind }) => ({ options, kind }))).toEqual(
        Array.from({ length: 3 }, () => ({
          options: { reason: 'pointer', preventScroll: true },
          kind: 'native',
        }))
      );
      // No exact-native-target certificate: necessary host calls are retained.
    } finally {
      await f.cleanup();
    }
  });

  it('refreshes a false native result without a second host focus event', async () => {
    const f = await fixture();
    try {
      f.observe();
      f.setQuery(() => false);
      f.focusable.focusSelf({ reason: 'pointer' });
      expect(f.port.getFacts()).toMatchObject({ focused: true, active: true, focusVisible: false });
    } finally {
      await f.cleanup();
    }
  });

  it('refreshes keyboard visibility only according to the native query', async () => {
    const f = await fixture();
    try {
      f.setQuery(() => false);
      f.observe();
      f.focusable.focusSelf({ reason: 'keyboard' });
      expect(f.focusable.focusVisible.get()).toBe(false);
      f.setQuery(() => true);
      f.focusable.focusSelf({ reason: 'keyboard' });
      expect(f.focusable.focusVisible.get()).toBe(true);
    } finally {
      await f.cleanup();
    }
  });

  for (const mode of ['unavailable', 'throwing'] as const) {
    it(`refreshes fallback modality in both directions when the native query is ${mode}`, async () => {
      const f = await fixture();
      try {
        f.observe();
        if (mode === 'unavailable') f.unsupported();
        else
          f.setQuery(() => {
            throw new Error('controlled unsupported selector');
          });
        f.focusable.focusSelf({ reason: 'pointer' });
        expect(f.focusable.focusVisible.get()).toBe(false);
        f.focusable.focusSelf({ reason: 'keyboard' });
        expect(f.focusable.focusVisible.get()).toBe(true);
        expect(f.port.getFacts()).toMatchObject({ focused: true, active: true });
      } finally {
        await f.cleanup();
      }
    });
  }

  it('does not manufacture owner facts for an unobserved successful target', async () => {
    const f = await fixture();
    try {
      f.focusable.focusSelf({ reason: 'keyboard' });
      expect(f.attempts).toHaveLength(1);
      expect(f.samples()).toBe(0);
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
    } finally {
      await f.cleanup();
    }
  });

  it('keeps a rejected native request pending without refreshing existing facts', async () => {
    const f = await fixture();
    try {
      f.observe();
      const before = f.samples();
      f.setQuery(() => false);
      f.setApply(() => false);
      f.focusable.focusSelf({ reason: 'pointer' });
      expect(f.samples()).toBe(before);
      expect(f.focusable.focusVisible.get()).toBe(true);
      f.setApply(() => true);
      f.ready();
      expect(f.samples()).toBe(before + 1);
      expect(f.focusable.focusVisible.get()).toBe(false);
      expect(f.attempts).toHaveLength(2);
    } finally {
      await f.cleanup();
    }
  });

  it('preserves a thrown host error without refreshing facts', async () => {
    const f = await fixture();
    try {
      f.observe();
      const before = f.samples();
      const error = new Error('controlled host error');
      f.setQuery(() => false);
      f.setApply(() => {
        throw error;
      });
      expect(() => f.focusable.focusSelf({ reason: 'pointer' })).toThrow(error);
      expect(f.samples()).toBe(before);
      expect(f.focusable.focusVisible.get()).toBe(true);
    } finally {
      await f.cleanup();
    }
  });

  it('does not refresh an old observed target after the request target is replaced', async () => {
    const f = await fixture();
    const replacement = document.createElement('button');
    document.body.append(replacement);
    try {
      f.observe();
      const before = f.samples();
      f.setQuery(() => false);
      f.setTarget(replacement);
      f.focusable.focusSelf({ reason: 'pointer' });
      expect(f.attempts.at(-1)?.target).toBe(replacement);
      expect(f.samples()).toBe(before);
      expect(f.focusable.focusVisible.get()).toBe(true);
    } finally {
      await f.cleanup();
      replacement.remove();
    }
  });

  it('cannot write an obsolete sample over a newer same-target native request', async () => {
    const f = await fixture();
    try {
      f.setQuery(() => false);
      f.observe();
      let nested = false;
      f.setQuery(() => {
        if (!nested) {
          nested = true;
          f.focusable.focusSelf({ reason: 'keyboard' });
          return false;
        }
        return true;
      });
      f.focusable.focusSelf({ reason: 'pointer' });
      expect(f.attempts.map(({ options }) => options?.reason)).toEqual(['pointer', 'keyboard']);
      expect(f.port.getFacts()).toMatchObject({ focused: true, active: true, focusVisible: true });
    } finally {
      await f.cleanup();
    }
  });

  for (const action of ['blur', 'disable'] as const) {
    it(`cannot revive visibility when sampling triggers ${action}`, async () => {
      const f = await fixture();
      try {
        f.observe();
        f.setQuery(() => {
          if (action === 'blur') f.focusable.blur();
          else f.focusable.setDisabled(true);
          return true;
        });
        f.focusable.focusSelf({ reason: 'pointer' });
        expect(f.port.getFacts()).toMatchObject({
          focused: false,
          active: false,
          focusVisible: false,
        });
      } finally {
        await f.cleanup();
      }
    });
  }

  it('cannot restore visibility after a different owner is observed during sampling', async () => {
    const f = await fixture();
    const other = await fixture();
    try {
      f.observe();
      f.setQuery(() => {
        other.observe();
        return true;
      });
      f.focusable.focusSelf({ reason: 'pointer' });
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
      expect(other.port.getFacts()).toMatchObject({
        focused: true,
        active: true,
        focusVisible: true,
      });
    } finally {
      await f.cleanup();
      await other.cleanup();
    }
  });

  it('does not apply or sample a disabled target', async () => {
    const f = await fixture();
    try {
      f.observe();
      f.focusable.setDisabled(true);
      const before = f.samples();
      f.focusable.focusSelf({ reason: 'keyboard' });
      expect(f.samples()).toBe(before);
      expect(f.attempts).toHaveLength(0);
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        active: false,
        focusVisible: false,
      });
    } finally {
      await f.cleanup();
    }
  });
});
