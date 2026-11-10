import { describe, expect, it } from 'vitest';
import {
  definePrototype,
  type FocusEntryConfig,
  type FocusEntryHandle,
  type FocusableHandle,
  type FocusScopeHandle,
  type FocusRequestOptions,
  type FocusScopeConfigPatch,
} from '@proto.ui/core';
import { asFocusEntry, asFocusable, asFocusScope } from '@proto.ui/hooks';
import { createRuntimeSession } from '@proto.ui/runtime';
import { EVENT_ROOT_TARGET_CAP, EVENT_GLOBAL_TARGET_CAP } from '@proto.ui/module-event';
import {
  FOCUS_ROOT_TARGET_CAP,
  FOCUS_REQUEST_FOCUS_CAP,
  FOCUS_BLUR_CAP,
  FOCUS_TARGET_READY_CAP,
  FOCUS_INSTANCE_TOKEN_CAP,
  FOCUS_PARENT_CAP,
  FOCUS_RESOLVE_ENTRY_TARGET_CAP,
  FOCUS_RUN_IN_CALLBACK_CAP,
  FOCUS_RELEASE_PENDING_CAP,
  type FocusPort,
  type FocusRequestKind,
} from '@proto.ui/module-focus';
import { resolveWebFocusEntryTarget } from '../../../adapters/base/src/platform/focus-entry';

let identity = 0;
async function fixture(
  dual = false,
  options: {
    bridgeHostEvents?: boolean;
    selfEntry?: boolean;
    entryDeclared?: boolean;
    scope?: FocusScopeConfigPatch;
  } = {}
) {
  let entry!: FocusEntryHandle;
  let scope: FocusScopeHandle | undefined;
  let focusable: FocusableHandle | undefined;
  let onActive: ((active: boolean) => void) | undefined;
  let onRequest: (() => void) | undefined;
  let onRelease: (() => void) | undefined;
  let onRoot: (() => void) | undefined;
  let onResolve: (() => void) | undefined;
  let releases = 0;
  const token = {},
    kinds: FocusRequestKind[] = [];
  const initialRoot = document.createElement('div');
  initialRoot.tabIndex = 0;
  const first = document.createElement('button');
  first.textContent = 'old';
  initialRoot.append(first);
  document.body.append(initialRoot);
  if (options.bridgeHostEvents) {
    // Controlled host translation: physical DOM focus/blur enters Runtime's
    // logical host events. This is not a native-browser proof.
    initialRoot.addEventListener('focus', () => initialRoot.dispatchEvent(new Event('host:focus')));
    initialRoot.addEventListener('blur', () => initialRoot.dispatchEvent(new Event('host:blur')));
  }
  let currentRoot: HTMLElement | null = initialRoot;
  let accept = false;
  const listeners = new Set<() => void>();
  const attempts: Array<{ target: HTMLElement; options: FocusRequestOptions | undefined }> = [];
  const applied: Array<{ target: HTMLElement; options: FocusRequestOptions | undefined }> = [];
  const blurred: HTMLElement[] = [];
  const proto = definePrototype({
    name: `entry-pending-${++identity}`,
    setup() {
      if (options.entryDeclared !== false) {
        entry = asFocusEntry();
        entry.configure(
          options.selfEntry
            ? { strategy: 'self', fallback: 'self' }
            : { strategy: 'descendant-first', fallback: 'none' }
        );
      }
      if (dual) focusable = asFocusable();
      if (options.scope) {
        scope = asFocusScope();
        scope.configure(options.scope);
        scope.active.watch((_run, event) => {
          if (event.type === 'next') onActive?.(event.next);
        });
      }
      return (r) => r.el('div');
    },
  });
  let session: ReturnType<typeof createRuntimeSession>;
  session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: () => ({}),
    schedule: (fn) => fn(),
    commit: (_children, signal) => signal?.done(),
    onRuntimeReady(wiring) {
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => initialRoot],
        [EVENT_GLOBAL_TARGET_CAP, () => window],
      ]);
      wiring.attach('focus', [
        [FOCUS_INSTANCE_TOKEN_CAP, token],
        [FOCUS_PARENT_CAP, () => null],
        [
          FOCUS_ROOT_TARGET_CAP,
          () => {
            onRoot?.();
            return currentRoot;
          },
        ],
        [
          FOCUS_BLUR_CAP,
          (target: HTMLElement) => {
            blurred.push(target);
            target.blur();
          },
        ],
        [
          FOCUS_RESOLVE_ENTRY_TARGET_CAP,
          (root: HTMLElement, config: FocusEntryConfig) => {
            onResolve?.();
            return resolveWebFocusEntryTarget(root, config, (el) => el.tagName === 'BUTTON');
          },
        ],
        [
          FOCUS_REQUEST_FOCUS_CAP,
          (target: HTMLElement, options?: FocusRequestOptions, kind?: FocusRequestKind) => {
            attempts.push({ target, options });
            kinds.push(kind ?? 'programmatic');
            onRequest?.();
            if (!accept) return false;
            applied.push({ target, options });
            target.focus();
            return true;
          },
        ],
        [
          FOCUS_RELEASE_PENDING_CAP,
          () => {
            releases += 1;
            onRelease?.();
          },
        ],
        [
          FOCUS_TARGET_READY_CAP,
          (fn: () => void) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
          },
        ],
        [FOCUS_RUN_IN_CALLBACK_CAP, (fn: () => void) => session.invokeInCallbackScope(fn)],
      ]);
    },
  });
  await session.mount();
  const ready = () => {
    for (const fn of [...listeners]) fn();
  };
  return {
    entry,
    scope,
    token,
    focusable,
    session,
    initialRoot,
    first,
    attempts,
    applied,
    blurred,
    kinds,
    listeners,
    ready,
    setAccept: (value: boolean) => (accept = value),
    setRoot: (root: HTMLElement | null) => (currentRoot = root),
    setOnActive: (fn: ((active: boolean) => void) | undefined) => (onActive = fn),
    setOnRequest: (fn: (() => void) | undefined) => (onRequest = fn),
    setOnRelease: (fn: (() => void) | undefined) => (onRelease = fn),
    setOnRoot: (fn: (() => void) | undefined) => (onRoot = fn),
    setOnResolve: (fn: (() => void) | undefined) => (onResolve = fn),
    getReleases: () => releases,
    port: session.caps.getPort<FocusPort>('focus')!,
    async cleanup() {
      await session.dispose();
      initialRoot.remove();
      currentRoot?.remove();
    },
  };
}

describe('entry pending lifecycle boundaries', () => {
  it.each([
    ['target', 'target disable', false],
    ['target', 'entry disable', true],
    ['target', 'explicit blur', false],
    ['target-self', 'target disable', false],
    ['target-self', 'entry disable', true],
    ['target-self', 'explicit blur', false],
    ['entry', 'target disable', true],
    ['entry', 'entry disable', false],
    ['entry', 'explicit blur', false],
  ] as const)(
    'pending %s followed by %s preserves intent: %s',
    async (request, cancel, preserved) => {
      const f = await fixture(true);
      try {
        const options = { reason: 'keyboard', preventScroll: true } as const;
        if (request === 'entry') f.entry.focus(options);
        else if (request === 'target-self') f.focusable!.focusSelf(options);
        else f.focusable!.focus(options);
        expect(f.attempts).toHaveLength(1);
        expect(f.applied).toHaveLength(0);

        if (cancel === 'target disable') f.focusable!.setDisabled(true);
        else if (cancel === 'entry disable') f.entry.setDisabled(true);
        else f.focusable!.blur();
        if (!preserved) {
          // Re-enable before readiness so rejection cannot hide a stale slot.
          f.focusable!.setDisabled(false);
          f.entry.setDisabled(false);
        }
        f.setAccept(true);
        f.ready();
        expect(f.applied).toEqual(
          preserved ? [{ target: request === 'entry' ? f.first : f.initialRoot, options }] : []
        );
        if (preserved) {
          expect(document.activeElement).toBe(request === 'entry' ? f.first : f.initialRoot);
        } else {
          // Re-enabling eligibility cannot recreate a cancelled request.
          f.focusable!.setDisabled(false);
          f.entry.setDisabled(false);
          f.ready();
          expect(f.applied).toHaveLength(0);
        }
        if (request === 'entry') {
          expect(f.port.getFacts()).toMatchObject({
            focused: false,
            focusVisible: false,
            active: false,
          });
          f.ready();
          expect(f.applied).toHaveLength(preserved ? 1 : 0);
        }
      } finally {
        await f.cleanup();
      }
    }
  );

  it.each(['preserve', 'entry disable', 'explicit blur', 'new entry'] as const)(
    'target disable respects synchronous native blur observers: %s',
    async (action) => {
      const f = await fixture(true);
      try {
        f.setAccept(true);
        f.focusable!.focus({ reason: 'keyboard' });
        expect(document.activeElement).toBe(f.initialRoot);
        expect(f.focusable!.focused.get()).toBe(true);
        f.setAccept(false);
        f.entry.focus({ reason: 'keyboard', preventScroll: true });

        let blurEvents = 0;
        f.initialRoot.addEventListener(
          'blur',
          () => {
            blurEvents++;
            if (action === 'entry disable') f.entry.setDisabled(true);
            else if (action === 'explicit blur') f.focusable!.blur();
            else if (action === 'new entry')
              f.entry.focus({ reason: 'pointer', preventScroll: false });
          },
          { once: true }
        );
        f.focusable!.setDisabled(true);
        expect(blurEvents).toBe(1);
        expect(f.blurred[0]).toBe(f.initialRoot);
        expect(document.activeElement).not.toBe(f.initialRoot);
        expect(f.port.getFacts()).toMatchObject({
          focused: false,
          focusVisible: false,
          active: false,
        });

        const replacement = document.createElement('button');
        f.first.replaceWith(replacement);
        // Cancellation must survive re-enable before the first replay attempt.
        f.entry.setDisabled(false);
        f.setAccept(true);
        f.ready();
        f.ready();
        const replays = f.applied.slice(1);
        expect(replays).toEqual(
          action === 'preserve' || action === 'new entry'
            ? [
                {
                  target: replacement,
                  options:
                    action === 'new entry'
                      ? { reason: 'pointer', preventScroll: false }
                      : { reason: 'keyboard', preventScroll: true },
                },
              ]
            : []
        );
        expect(f.focusable!.focused.get()).toBe(false);
      } finally {
        await f.cleanup();
      }
    }
  );

  it('retries only the latest rejected entry intent and does not fabricate region facts', async () => {
    const f = await fixture();
    try {
      f.entry.focus({ reason: 'keyboard', preventScroll: true });
      f.entry.focus({ reason: 'pointer', preventScroll: false });
      expect(f.applied).toHaveLength(0);
      f.setAccept(true);
      f.ready();
      expect(f.applied).toEqual([
        { target: f.first, options: { reason: 'pointer', preventScroll: false } },
      ]);
      expect(f.port.getFacts()).toMatchObject({
        focused: false,
        focusVisible: false,
        active: false,
        hasFocused: false,
      });
      f.ready();
      expect(f.applied).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });
  it('disabling entry cancels rejected intent, and reenable alone cannot resurrect it', async () => {
    const f = await fixture();
    try {
      f.entry.focus();
      f.entry.setDisabled(true);
      f.setAccept(true);
      f.ready();
      f.entry.setDisabled(false);
      f.ready();
      expect(f.applied).toHaveLength(0);
      f.entry.focus();
      expect(f.applied).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });
  it('reresolves replacement descendants rather than focusing the rejected old node', async () => {
    const f = await fixture();
    try {
      f.entry.focus({ preventScroll: true });
      const replacement = document.createElement('button');
      replacement.textContent = 'new';
      f.first.replaceWith(replacement);
      f.setAccept(true);
      f.ready();
      expect(f.applied).toEqual([{ target: replacement, options: { preventScroll: true } }]);
      expect(document.activeElement).toBe(replacement);
    } finally {
      await f.cleanup();
    }
  });
  it('retained detach preserves rejected entry intent until a replacement view mounts', async () => {
    const f = await fixture();
    try {
      f.entry.focus({ reason: 'keyboard' });
      await f.session.unmount();
      f.setRoot(null);
      f.ready();
      expect(f.applied).toHaveLength(0);
      const replacementRoot = document.createElement('div');
      const replacement = document.createElement('button');
      replacement.textContent = 'new epoch';
      replacementRoot.append(replacement);
      document.body.append(replacementRoot);
      f.setRoot(replacementRoot);
      f.setAccept(true);
      await f.session.mount();
      f.ready();
      expect(f.applied).toEqual([{ target: replacement, options: { reason: 'keyboard' } }]);
    } finally {
      await f.cleanup();
    }
  });
  it('terminal disposal removes readiness subscription and never replays rejected entry', async () => {
    const f = await fixture();
    try {
      f.entry.focus();
      expect(f.listeners.size).toBe(1);
      await f.session.dispose();
      expect(f.listeners.size).toBe(0);
      f.setAccept(true);
      f.ready();
      expect(f.applied).toHaveLength(0);
    } finally {
      await f.cleanup();
    }
  });
  it('a later no-target policy result ends earlier rejected entry intent', async () => {
    const f = await fixture();
    try {
      f.entry.focus();
      f.first.remove();
      f.entry.focus();
      f.initialRoot.append(f.first);
      f.setAccept(true);
      f.ready();
      expect(f.applied).toHaveLength(0);
    } finally {
      await f.cleanup();
    }
  });
  it('entry disable does not cancel a pending target request on a dual-role instance', async () => {
    const f = await fixture(true);
    try {
      f.focusable!.focus({ reason: 'keyboard' });
      f.entry.setDisabled(true);
      f.setAccept(true);
      f.ready();
      expect(f.applied.map((x) => x.target)).toEqual([f.initialRoot]);
      expect(f.focusable!.focused.get()).toBe(true);
    } finally {
      await f.cleanup();
    }
  });
  it('a newer entry request replaces pending target acquisition on a dual-role instance', async () => {
    const f = await fixture(true);
    try {
      f.focusable!.focus({ reason: 'keyboard' });
      f.entry.focus({ reason: 'pointer' });
      f.setAccept(true);
      f.ready();
      expect(f.applied.map((x) => x.target)).toEqual([f.first]);
      expect(f.focusable!.focused.get()).toBe(false);
    } finally {
      await f.cleanup();
    }
  });
});
it('a newer target request replaces rejected entry acquisition on a dual-role instance', async () => {
  const f = await fixture(true);
  try {
    f.entry.focus({ reason: 'pointer' });
    f.focusable!.focus({ reason: 'keyboard' });
    f.setAccept(true);
    f.ready();
    expect(f.applied.map((x) => x.target)).toEqual([f.initialRoot]);
    expect(f.focusable!.focused.get()).toBe(true);
  } finally {
    await f.cleanup();
  }
});
it('explicit blur cancels a rejected entry acquisition on a dual-role instance', async () => {
  const f = await fixture(true);
  try {
    f.entry.focus();
    f.focusable!.blur();
    f.setAccept(true);
    f.ready();
    expect(f.applied).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});
it('a newer entry request during retained detach supersedes the previous rejected entry options', async () => {
  const f = await fixture();
  try {
    f.entry.focus({ reason: 'keyboard', preventScroll: true });
    await f.session.unmount();
    f.setRoot(null);
    f.entry.focus({ reason: 'pointer', preventScroll: false });
    f.setRoot(f.initialRoot);
    f.setAccept(true);
    await f.session.mount();
    f.ready();
    expect(f.applied).toEqual([
      { target: f.first, options: { reason: 'pointer', preventScroll: false } },
    ]);
  } finally {
    await f.cleanup();
  }
});
it('does not introduce a pending entry for a first request with no current root', async () => {
  const f = await fixture();
  try {
    f.setRoot(null);
    f.entry.focus({ reason: 'keyboard' });
    f.setRoot(f.initialRoot);
    f.setAccept(true);
    f.ready();
    expect(f.applied).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

it.each(['programmatic', 'native'] as const)(
  'a first no-root entry is a no-op over an existing pending %s target request',
  async (kind) => {
    const f = await fixture(true, { bridgeHostEvents: true });
    try {
      f.setRoot(null);
      if (kind === 'native') f.focusable!.focusSelf({ reason: 'keyboard', preventScroll: true });
      else f.focusable!.focus({ reason: 'keyboard', preventScroll: true });
      f.entry.focus({ reason: 'pointer', preventScroll: false });
      expect(f.attempts).toHaveLength(0);
      f.setRoot(f.initialRoot);
      f.setAccept(true);
      f.ready();
      expect(f.applied).toEqual([
        { target: f.initialRoot, options: { reason: 'keyboard', preventScroll: true } },
      ]);
      expect(document.activeElement).toBe(f.initialRoot);
      expect(f.focusable!.focused.get()).toBe(true);
    } finally {
      await f.cleanup();
    }
  }
);

it.each([
  ['disable', 'programmatic'],
  ['disable', 'native'],
  ['disable', 'entry'],
  ['blur', 'programmatic'],
  ['blur', 'native'],
  ['blur', 'entry'],
] as const)(
  '%s preserves facts from a synchronous newer %s request in its blur observer',
  async (operation, kind) => {
    const f = await fixture(true, { bridgeHostEvents: true, selfEntry: true });
    try {
      f.setAccept(true);
      f.focusable!.focus({ reason: 'keyboard' });
      expect(f.focusable!.focused.get()).toBe(true);
      let observations = 0;
      f.initialRoot.addEventListener(
        'blur',
        () => {
          observations++;
          f.focusable!.setDisabled(false);
          if (kind === 'entry') f.entry.focus({ reason: 'keyboard' });
          else if (kind === 'native') f.focusable!.focusSelf({ reason: 'keyboard' });
          else f.focusable!.focus({ reason: 'keyboard' });
          expect(document.activeElement).toBe(f.initialRoot);
          expect(f.focusable!.focused.get()).toBe(true);
        },
        { once: true }
      );
      if (operation === 'disable') f.focusable!.setDisabled(true);
      else f.focusable!.blur();
      expect(observations).toBe(1);
      expect(document.activeElement).toBe(f.initialRoot);
      expect(f.port.getFacts()).toMatchObject({ focused: true, active: true, hasFocused: true });
    } finally {
      await f.cleanup();
    }
  }
);

it.each([
  'replay gap',
  'explicit no target',
  'disable',
  'blur',
  'terminal',
  'new resolved request',
] as const)(
  'distinguishes a retained replay gap from a newer cancellation boundary: %s',
  async (boundary) => {
    const f = await fixture(true);
    try {
      f.entry.focus({ reason: 'keyboard', preventScroll: true });
      f.first.remove();
      f.ready();
      if (boundary === 'explicit no target') f.entry.focus({ reason: 'pointer' });
      else if (boundary === 'disable') {
        f.entry.setDisabled(true);
        f.entry.setDisabled(false);
      } else if (boundary === 'blur') f.focusable!.blur();
      else if (boundary === 'terminal') await f.session.dispose();
      const replacement = document.createElement('button');
      f.initialRoot.append(replacement);
      if (boundary === 'new resolved request')
        f.entry.focus({ reason: 'pointer', preventScroll: false });
      f.setAccept(true);
      f.ready();
      f.ready();
      expect(f.applied).toEqual(
        boundary === 'replay gap' || boundary === 'new resolved request'
          ? [
              {
                target: replacement,
                options:
                  boundary === 'replay gap'
                    ? { reason: 'keyboard', preventScroll: true }
                    : { reason: 'pointer', preventScroll: false },
              },
            ]
          : []
      );
    } finally {
      await f.cleanup();
    }
  }
);

it('a first explicit no-target entry does not acquire a future descendant', async () => {
  const f = await fixture();
  try {
    f.first.remove();
    f.entry.focus();
    const replacement = document.createElement('button');
    f.initialRoot.append(replacement);
    f.setAccept(true);
    f.ready();
    expect(f.applied).toEqual([]);
  } finally {
    await f.cleanup();
  }
});

async function pendingScopeChild(
  parent: { token: object; initialRoot: HTMLElement },
  projected: boolean
) {
  const token = {},
    root = document.createElement('button'),
    attempts: FocusRequestOptions[] = [];
  parent.initialRoot.append(root);
  const proto = definePrototype({
    name: `scope-pending-child-${++identity}`,
    setup() {
      asFocusable();
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
        [FOCUS_INSTANCE_TOKEN_CAP, token],
        [FOCUS_PARENT_CAP, (candidate: unknown) => (candidate === token ? parent.token : null)],
        [FOCUS_ROOT_TARGET_CAP, () => (projected ? root : null)],
        [
          FOCUS_REQUEST_FOCUS_CAP,
          (_target: HTMLElement, options?: FocusRequestOptions) => {
            attempts.push(options ?? {});
            return false;
          },
        ],
      ]);
    },
  });
  await session.mount();
  return {
    attempts,
    async cleanup() {
      await session.dispose();
      root.remove();
    },
  };
}

// C-AS-FOCUS-SCOPE-0002 L/M, C-AS-FOCUS-ENTRY-0001 I, M-FOCUS-0001 H.
// Controlled Module/Runtime capabilities; these assertions are not native-host receipts.
describe('Scope activation-owned Entry fallback', () => {
  it.each([false, true])(
    'logical child selection wins while projected=%s, including host rejection',
    async (projected) => {
      const f = await fixture(false, { scope: { entryFallback: 'entry' } });
      const child = await pendingScopeChild(f, projected);
      try {
        f.scope!.activate({ reason: 'keyboard', preventScroll: true });
        expect(f.attempts).toEqual([]);
        expect(child.attempts).toEqual(
          projected ? [{ reason: 'keyboard', preventScroll: true }] : []
        );
        f.setAccept(true);
        f.ready();
        expect(f.applied).toEqual([]);
      } finally {
        await child.cleanup();
        await f.cleanup();
      }
    }
  );

  it('uses separately declared Entry with exact request options without declaring a Focusable', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry' } });
    try {
      f.setAccept(true);
      f.scope!.activate({ entry: 'configured', reason: 'keyboard', preventScroll: true });
      expect(f.kinds).toEqual(['entry']);
      expect(f.applied).toEqual([
        { target: f.first, options: { reason: 'keyboard', preventScroll: true } },
      ]);
      expect(f.scope!.isActive()).toBe(false); // emptyPolicy:none is still authoritative.
      expect(f.port.getFacts()).toMatchObject({
        focusable: false,
        focused: false,
        focusVisible: false,
      });
      f.ready();
      f.ready();
      expect(f.applied).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });

  it.each([
    'default',
    'configured manual',
    'activation manual',
    'disabled Entry',
    'undeclared Entry',
  ] as const)('%s suppresses automatic Entry', async (mode) => {
    const f = await fixture(false, {
      entryDeclared: mode !== 'undeclared Entry',
      scope:
        mode === 'default'
          ? {}
          : {
              entryFallback: 'entry',
              entry: mode === 'configured manual' ? 'manual' : 'first',
            },
    });
    try {
      if (mode === 'disabled Entry') f.entry.setDisabled(true);
      f.scope!.activate(mode === 'activation manual' ? { entry: 'manual' } : undefined);
      f.setAccept(true);
      f.ready();
      expect(f.attempts).toEqual([]);
    } finally {
      await f.cleanup();
    }
  });

  it('owns an initially unresolved entry while an independent first unresolved Entry remains a no-op', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry' } });
    try {
      f.setRoot(null);
      f.entry.focus({ reason: 'pointer' });
      f.setRoot(f.initialRoot);
      f.setAccept(true);
      f.ready();
      expect(f.attempts).toEqual([]);
      f.setRoot(null);
      f.scope!.activate({ reason: 'keyboard', preventScroll: true });
      f.setRoot(f.initialRoot);
      f.ready();
      f.ready();
      expect(f.kinds).toEqual(['entry']);
      expect(f.applied).toEqual([
        { target: f.first, options: { reason: 'keyboard', preventScroll: true } },
      ]);
    } finally {
      await f.cleanup();
    }
  });

  it('resolves the current view after a retained detach without repeating Scope selection', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry' } });
    try {
      f.scope!.activate({ reason: 'keyboard', preventScroll: true });
      await f.session.unmount();
      f.setRoot(null);
      const replacementRoot = document.createElement('div'),
        replacement = document.createElement('button');
      replacementRoot.append(replacement);
      document.body.append(replacementRoot);
      f.setRoot(replacementRoot);
      f.setAccept(true);
      await f.session.mount();
      f.ready();
      expect(f.applied).toEqual([
        { target: replacement, options: { reason: 'keyboard', preventScroll: true } },
      ]);
      expect(f.kinds).toEqual(['entry', 'entry']);
      f.ready();
      expect(f.applied).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });

  it.each(['none', 'container'] as const)(
    'deactivate cancels owned intent while the %s boundary is detached or already inactive',
    async (emptyPolicy) => {
      const f = await fixture(false, {
        scope: { entryFallback: 'entry', emptyPolicy, restore: 'none' },
      });
      try {
        f.scope!.activate({ reason: 'keyboard' });
        await f.session.unmount();
        f.setRoot(null);
        f.scope!.deactivate();
        f.setRoot(f.initialRoot);
        f.setAccept(true);
        await f.session.mount();
        f.ready();
        expect(f.applied).toEqual([]);
      } finally {
        await f.cleanup();
      }
    }
  );

  it('retires before inactive observers, preserving a new independent Entry from that observer', async () => {
    const f = await fixture(false, {
      scope: { entryFallback: 'entry', emptyPolicy: 'container', restore: 'none' },
    });
    try {
      f.scope!.activate({ reason: 'keyboard' });
      const releases = f.getReleases();
      f.setOnActive((active) => {
        if (active) return;
        expect(f.getReleases()).toBeGreaterThan(releases);
        f.entry.focus({ reason: 'pointer', preventScroll: false });
      });
      f.scope!.deactivate();
      f.setAccept(true);
      f.ready();
      expect(f.applied).toEqual([
        { target: f.first, options: { reason: 'pointer', preventScroll: false } },
      ]);
    } finally {
      f.setOnActive(undefined);
      await f.cleanup();
    }
  });

  it.each(['Entry disable', 'blur', 'terminal'] as const)(
    '%s ends ownership permanently; readiness cannot resurrect it',
    async (cancel) => {
      const f = await fixture(true, { scope: { entryFallback: 'entry' } });
      try {
        f.scope!.activate();
        if (cancel === 'Entry disable') {
          f.entry.setDisabled(true);
          f.entry.setDisabled(false);
        } else if (cancel === 'blur') f.focusable!.blur();
        else await f.session.dispose();
        f.setAccept(true);
        f.ready();
        expect(f.applied).toEqual([]);
      } finally {
        await f.cleanup();
      }
    }
  );

  it('Focusable disable preserves the separately owned Entry intent on a dual-role scope', async () => {
    const f = await fixture(true, { scope: { entryFallback: 'entry' } });
    try {
      f.scope!.activate();
      f.focusable!.setDisabled(true);
      f.setAccept(true);
      f.ready();
      expect(f.kinds).toEqual(['entry', 'entry']);
      expect(f.applied).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });

  it.each(['Entry', 'target'] as const)(
    'a newer independent %s supersedes the owned continuation across owners',
    async (kind) => {
      const f = await fixture(false, { scope: { entryFallback: 'entry' } }),
        other = await fixture(true);
      try {
        f.scope!.activate({ reason: 'keyboard' });
        if (kind === 'Entry') other.entry.focus({ reason: 'pointer' });
        else other.focusable!.focus({ reason: 'pointer' });
        f.setAccept(true);
        other.setAccept(true);
        f.ready();
        other.ready();
        expect(f.applied).toEqual([]);
        expect(other.applied).toHaveLength(1);
      } finally {
        await other.cleanup();
        await f.cleanup();
      }
    }
  );

  it('a reentrant newer Entry cannot be overwritten when the old host returns rejection', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry' } }),
      other = await fixture();
    try {
      f.setOnRequest(() => {
        f.setOnRequest(undefined);
        other.entry.focus({ reason: 'pointer' });
      });
      f.scope!.activate({ reason: 'keyboard' });
      f.setAccept(true);
      other.setAccept(true);
      f.ready();
      other.ready();
      expect(f.applied).toEqual([]);
      expect(other.applied).toEqual([{ target: other.first, options: { reason: 'pointer' } }]);
    } finally {
      await other.cleanup();
      await f.cleanup();
    }
  });

  it('repeated activation owns only its latest request and retained readiness budget', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry' } });
    try {
      f.scope!.activate({ reason: 'keyboard', preventScroll: true });
      f.scope!.activate({ reason: 'pointer', preventScroll: false });
      f.setAccept(true);
      f.ready();
      f.ready();
      expect(f.applied).toEqual([
        { target: f.first, options: { reason: 'pointer', preventScroll: false } },
      ]);
    } finally {
      await f.cleanup();
    }
  });

  it.each(['Root getter', 'Entry resolver'] as const)(
    'a newer independent Entry during %s stops old scoped preflight',
    async (boundary) => {
      const f = await fixture(false, { scope: { entryFallback: 'entry' } }),
        other = await fixture();
      try {
        const nested = () => {
          f.setOnRoot(undefined);
          f.setOnResolve(undefined);
          other.entry.focus({ reason: 'pointer', preventScroll: false });
        };
        if (boundary === 'Root getter') f.setOnRoot(nested);
        else f.setOnResolve(nested);
        f.scope!.activate({ reason: 'keyboard', preventScroll: true });
        f.setAccept(true);
        other.setAccept(true);
        f.ready();
        other.ready();
        expect(f.attempts).toEqual([]);
        expect(other.applied).toEqual([
          { target: other.first, options: { reason: 'pointer', preventScroll: false } },
        ]);
      } finally {
        f.setOnRoot(undefined);
        f.setOnResolve(undefined);
        await other.cleanup();
        await f.cleanup();
      }
    }
  );

  it('coalesces readiness emitted by an owned host attempt without reacquiring after success', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry' } });
    try {
      f.setOnRequest(() => {
        f.setOnRequest(undefined);
        f.ready();
        f.ready();
        f.ready();
      });
      f.scope!.activate({ reason: 'keyboard', preventScroll: true });
      expect(f.attempts).toHaveLength(2);
      f.setAccept(true);
      f.ready();
      f.ready();
      expect(f.applied).toHaveLength(1);
      expect(f.applied[0]?.options).toEqual({ reason: 'keyboard', preventScroll: true });
    } finally {
      await f.cleanup();
    }
  });

  it('deactivation from the active observer prevents a not-yet-started fallback', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry', emptyPolicy: 'container' } });
    try {
      f.setOnActive((active) => {
        if (active) f.scope!.deactivate();
      });
      f.scope!.activate();
      f.setAccept(true);
      f.ready();
      expect(f.attempts).toEqual([]);
      expect(f.scope!.isActive()).toBe(false);
    } finally {
      f.setOnActive(undefined);
      await f.cleanup();
    }
  });

  it('a newer request in activation option getters prevents the older fallback from starting', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry' } }),
      other = await fixture();
    try {
      f.scope!.activate({
        get reason() {
          other.entry.focus({ reason: 'pointer' });
          return 'keyboard' as const;
        },
      });
      f.setAccept(true);
      f.ready();
      expect(f.attempts).toEqual([]);
    } finally {
      await other.cleanup();
      await f.cleanup();
    }
  });

  it('an owned-entry options snapshot preserves the newer same-owner independent Entry', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry' } });
    try {
      let reads = 0;
      f.scope!.activate({
        get reason() {
          reads += 1;
          f.entry.focus({ reason: 'pointer', preventScroll: false });
          return 'keyboard' as const;
        },
        preventScroll: true,
      });
      expect(reads).toBe(1);
      expect(f.attempts).toEqual([
        { target: f.first, options: { reason: 'pointer', preventScroll: false } },
      ]);
      const latest = f.attempts[0].options;
      f.setAccept(true);
      f.ready();
      expect(f.applied).toEqual([
        { target: f.first, options: { reason: 'pointer', preventScroll: false } },
      ]);
      expect(f.applied[0].options).toBe(latest);
    } finally {
      await f.cleanup();
    }
  });

  it('a throwing owned-entry snapshot keeps its primary error when deferred old readiness also throws', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry' } });
    try {
      f.entry.focus({ reason: 'pointer', preventScroll: true });
      const old = f.attempts[0].options;
      const primary = new Error('scope options failed');
      const secondary = new Error('old readiness replay failed');
      f.setOnRequest(() => {
        throw secondary;
      });
      expect(() =>
        f.scope!.activate({
          get reason(): never {
            f.ready();
            throw primary;
          },
        })
      ).toThrow(primary);
      expect(f.attempts).toHaveLength(2);
      expect(f.attempts[1].options).toBe(old);
      expect(f.port.getFacts()).toMatchObject({ focused: false, focusVisible: false });
    } finally {
      f.setOnRequest(undefined);
      await f.cleanup();
    }
  });

  it('deactivation from owned-entry option getters cancels the not-yet-applied fallback', async () => {
    const f = await fixture(false, {
      scope: { entryFallback: 'entry', emptyPolicy: 'container', restore: 'none' },
    });
    try {
      f.scope!.activate({
        get reason() {
          f.scope!.deactivate();
          return 'keyboard' as const;
        },
      });
      f.setAccept(true);
      f.ready();
      expect(f.attempts).toEqual([]);
      expect(f.scope!.isActive()).toBe(false);
    } finally {
      await f.cleanup();
    }
  });

  it('a newer request from host retirement suppresses old automatic restoration', async () => {
    const f = await fixture(false, { scope: { entryFallback: 'entry', emptyPolicy: 'container' } }),
      other = await fixture(true);
    try {
      other.setAccept(true);
      other.focusable!.focus({ reason: 'programmatic' });
      f.scope!.activate();
      f.setOnRelease(() => {
        f.setOnRelease(undefined);
        // A materialized outside target is still gated by the closing scope.
        // Retain a genuinely admitted pre-projection request, then make it
        // ready after deactivation so old restoration cannot hide its loss.
        other.setRoot(null);
        other.focusable!.focus({ reason: 'pointer' });
      });
      f.scope!.deactivate();
      expect(other.applied.map((attempt) => attempt.options)).toEqual([{ reason: 'programmatic' }]);
      other.setRoot(other.initialRoot);
      other.ready();
      expect(other.applied.map((attempt) => attempt.options)).toEqual([
        { reason: 'programmatic' },
        { reason: 'pointer' },
      ]);
      f.setAccept(true);
      f.ready();
      expect(f.applied).toEqual([]);
    } finally {
      await other.cleanup();
      await f.cleanup();
    }
  });
});
