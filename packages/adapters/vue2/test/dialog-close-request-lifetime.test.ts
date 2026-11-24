import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as base from '../../../prototypes/base/src/dialog';
import * as bootstrap from '../../../prototypes/bootstrap-2-3-2/src/dialog';
import {
  DIALOG_CONTEXT,
  requestDialogOpen,
  type DialogContextValue,
} from '../../../prototypes/base/src/dialog/shared';
import { createVue2Adapter } from '../src/adapt';
import { flushVue2, Vue2Any, Vue2RuntimeAny } from './utils/vue2';

type Mode = 'reduced' | 'unknown' | 'zero-duration';
type Request = { open: boolean; reason: string; focusReason: string | null };
const preference = (mode: Mode) =>
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches:
          mode === 'reduced'
            ? query.includes(': reduce)')
            : mode === 'zero-duration' && query.includes(': no-preference)'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as any
  );

beforeEach(() => {
  vi.spyOn(window, 'matchMedia');
  preference('reduced');
});
afterEach(() => vi.restoreAllMocks());

const settle = async () => {
  await flushVue2();
  await flushVue2();
};

async function mount(controlled: boolean, mode: Mode = 'reduced') {
  preference(mode);
  // Bootstrap owns fixed 300/150 ms durations. Zero-duration coverage uses the
  // Base authoring entry; this fixture does not override family motion policy.
  const source = mode === 'zero-duration' ? base : bootstrap;
  const adapt = createVue2Adapter(Vue2RuntimeAny);
  let onDetach: (() => void) | undefined;
  let onRequest: (() => void) | undefined;
  const lifecycle: Array<{ type: string; phase?: string }> = [];
  const Root = adapt(source.dialogRoot);
  const Trigger = adapt(source.dialogTrigger);
  const Mask = adapt(source.dialogMask);
  const Content = adapt(source.dialogContent, {
    diagnostics: {
      onLifecycleEvent(event) {
        lifecycle.push({
          type: event.type,
          ...(event.type === 'mount.phase' ? { phase: event.phase } : {}),
        });
        if (event.type !== 'unmount.done' || !onDetach) return;
        const callback = onDetach;
        onDetach = undefined;
        callback();
      },
    },
  });
  const Close = adapt(source.dialogClose);
  const accepted = Vue2Any.observable({ open: false });
  const requests: Request[] = [];
  let refusing = false;
  let destroyed = false;
  const ownerReply = (request: Request) => {
    requests.push(request);
    if (controlled && !refusing) accepted.open = request.open;
    if (request.reason === 'escape' && onRequest) {
      const callback = onRequest;
      onRequest = undefined;
      callback();
    }
  };
  const App = Vue2Any.extend({
    render(h: any) {
      return h(
        Root,
        {
          ref: 'root',
          attrs: {
            ...(controlled ? { open: accepted.open } : { defaultOpen: false }),
            onOpenChange: ownerReply,
          },
        },
        [
          h(Trigger, { ref: 'trigger' }, ['Open']),
          h(Mask, {
            ref: 'mask',
            attrs: mode === 'zero-duration' ? { enterDuration: 0, leaveDuration: 0 } : {},
          }),
          h(
            Content,
            {
              ref: 'content',
              attrs: mode === 'zero-duration' ? { enterDuration: 0, leaveDuration: 0 } : {},
            },
            [h(Close, { ref: 'close' }, ['Close'])]
          ),
        ]
      );
    },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const vm = new App().$mount();
  host.append(vm.$el);
  await settle();
  const refs = vm.$refs as Record<string, any>;
  const disposeNow = () => {
    if (destroyed) return;
    destroyed = true;
    vm.$destroy();
    host.remove();
  };
  const settlePresence = async () => {
    await settle();
    if (mode !== 'zero-duration') return;
    // Base's timer completion is asynchronous even at 0 ms. Happy DOM RAF
    // uses a different queue; execute the real timer turn before observing it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settle();
  };
  return {
    refs,
    requests,
    inspect() {
      const content = refs.content;
      const state = content.__pui;
      const root = content.$refs?.__puiRoot ?? content.$el;
      return {
        lifecycle: [...lifecycle],
        requests: [...requests],
        shouldExist: content.__puiShouldExist,
        viewReady: state.viewReady,
        hasView: state.owner.hasView,
        rootMatchesLastInit: root === state.lastInitRoot,
        rootConnected: root?.isConnected,
        viewGeneration: state.viewGeneration,
        terminalDisposed: state.terminalDisposed,
        transitionState: content.getExposes().transitionState.get(),
      };
    },
    refuse() {
      refusing = true;
    },
    atDetach(callback: () => void) {
      onDetach = callback;
    },
    duringRequest(callback: () => void) {
      onRequest = callback;
    },
    isDestroyed: () => destroyed,
    disposeNow,
    async open() {
      refs.trigger.$el.focus();
      refs.trigger.$el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settlePresence();
    },
    async escape() {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settlePresence();
    },
    async dispose() {
      disposeNow();
      await settle();
    },
  };
}

describe('Vue2 Dialog semantic Escape across immediate view retirement', () => {
  it('preserves a new Root open requested by a Content open notification', async () => {
    const fixture = await mount(false);
    let off: (() => void) | undefined;
    try {
      await fixture.open();
      let armed = true;
      const observations: unknown[] = [];
      off = fixture.refs.content.getExposes().open.subscribe((event: any) => {
        if (event.type !== 'next' || event.next || !armed) return;
        armed = false;
        observations.push({ beforeReopen: fixture.inspect() });
        fixture.refs.root.getExposes().openDialog();
        observations.push({ afterReopen: fixture.inspect() });
      });
      await fixture.escape();
      const observed = JSON.stringify({ observations, settled: fixture.inspect() });
      expect(armed).toBe(false);
      expect(fixture.refs.root.getExposes().open.get(), observed).toBe(true);
      expect(fixture.refs.content.getExposes().open.get(), observed).toBe(true);
      expect(fixture.refs.content.getExposes().transitionState.get(), observed).toBe('entered');
      expect(fixture.refs.mask.getExposes().transitionState.get(), observed).toBe('entered');
    } finally {
      off?.();
      await fixture.dispose();
    }
  });

  it.each(
    (['reduced', 'unknown', 'zero-duration'] as const).flatMap((mode) =>
      [false, true].map((controlled) => ({ mode, controlled }))
    )
  )(
    'delivers exactly one close per opening with $mode (controlled=$controlled)',
    async ({ mode, controlled }) => {
      const fixture = await mount(controlled, mode);
      try {
        for (let opening = 1; opening <= 2; opening++) {
          await fixture.open();
          expect(fixture.refs.root.getExposes().open.get()).toBe(true);
          expect(fixture.refs.content.getExposes().transitionState.get()).toBe('entered');
          await fixture.escape();
          expect(fixture.requests.filter((request) => request.reason === 'escape')).toHaveLength(
            opening
          );
          expect(fixture.requests.at(-1)).toMatchObject({
            open: false,
            reason: 'escape',
            focusReason: 'keyboard',
          });
          expect(fixture.refs.root.getExposes().open.get()).toBe(false);
          expect(fixture.refs.content.getExposes().transitionState.get()).toBe('closed');
          expect(fixture.refs.mask.getExposes().transitionState.get()).toBe('closed');
          expect(fixture.refs.trigger.$el.getAttribute('aria-expanded')).toBe('false');
          expect(document.activeElement).toBe(fixture.refs.trigger.$el);
        }
      } finally {
        await fixture.dispose();
      }
    }
  );

  it.each(['reduced', 'unknown'] as const)(
    'keeps a refusing controlled owner open through %s completion',
    async (mode) => {
      const fixture = await mount(true, mode);
      try {
        await fixture.open();
        fixture.refuse();
        await fixture.escape();
        expect(fixture.requests.filter((request) => request.reason === 'escape')).toEqual([
          expect.objectContaining({ open: false, reason: 'escape' }),
        ]);
        expect(fixture.refs.root.getExposes().open.get()).toBe(true);
        expect(fixture.refs.content.getExposes().transitionState.get()).toBe('entered');
        expect(fixture.refs.mask.getExposes().transitionState.get()).toBe('entered');
        expect(fixture.refs.trigger.$el.getAttribute('aria-expanded')).toBe('true');
        expect(fixture.refs.content.$el.contains(document.activeElement)).toBe(true);
      } finally {
        await fixture.dispose();
      }
    }
  );

  it('does not apply the old Escape after a newer semantic open during view retirement', async () => {
    const fixture = await mount(true);
    try {
      await fixture.open();
      // Deliberate synchronous host-callback reentry, not native-input evidence.
      const observations: unknown[] = [];
      fixture.atDetach(() => {
        observations.push({ beforeReopen: fixture.inspect() });
        fixture.refs.root.getExposes().openDialog();
        observations.push({ afterReopen: fixture.inspect() });
      });
      await fixture.escape();
      expect(fixture.requests.filter((request) => request.reason === 'escape')).toEqual([]);
      expect(fixture.refs.root.getExposes().open.get()).toBe(true);
      expect(
        fixture.refs.content.getExposes().transitionState.get(),
        JSON.stringify({ observations, settled: fixture.inspect() })
      ).toBe('entered');
      expect(fixture.refs.mask.getExposes().transitionState.get()).toBe('entered');
    } finally {
      await fixture.dispose();
    }
  });

  it('retires the semantic callback when the instance is disposed during view retirement', async () => {
    const fixture = await mount(true);
    try {
      await fixture.open();
      fixture.atDetach(fixture.disposeNow);
      await fixture.escape();
      expect(fixture.isDestroyed()).toBe(true);
      expect(fixture.requests.filter((request) => request.reason === 'escape')).toEqual([]);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      await fixture.dispose();
    }
  });

  it('cannot reopen a disposed owner after its controlled Escape callback returns', async () => {
    const fixture = await mount(true);
    try {
      await fixture.open();
      fixture.refuse();
      fixture.duringRequest(fixture.disposeNow);
      await fixture.escape();
      expect(fixture.requests.filter((request) => request.reason === 'escape')).toHaveLength(1);
      expect(fixture.isDestroyed()).toBe(true);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      await fixture.dispose();
    }
  });
});

describe('Dialog request identity at the Context publication boundary', () => {
  const context = (rootId: string): DialogContextValue => ({
    rootId,
    open: true,
    openFocusReason: 'pointer',
    returnFocusReason: null,
    controlled: true,
    disabled: false,
    alert: false,
    a11yLabel: '',
    requestedOpen: true,
    requestReason: null,
    requestFocusReason: null,
    requestVersion: 4,
  });

  it('does not deliver a retained close to a replacement Root', () => {
    const replacement = context('replacement-root');
    let published = replacement;
    const run = {
      context: {
        update(key: unknown, update: (value: DialogContextValue) => DialogContextValue) {
          expect(key).toBe(DIALOG_CONTEXT);
          // A fresh provider is resolved at update time, after the caller's read.
          published = update(replacement);
        },
      },
    };
    expect(requestDialogOpen(run, false, 'escape', 'keyboard', 'original-root')).toBe(false);
    expect(published).toBe(replacement);
    expect(published.requestVersion).toBe(4);
  });

  it('preserves controlled ownership while requesting the matching Root', () => {
    let published = context('same-root');
    const run = {
      context: {
        update(_key: unknown, update: (value: DialogContextValue) => DialogContextValue) {
          published = update(published);
        },
      },
    };
    expect(requestDialogOpen(run, false, 'escape', 'keyboard', 'same-root')).toBe(true);
    expect(published).toMatchObject({
      rootId: 'same-root',
      open: true,
      requestedOpen: false,
      requestReason: 'escape',
      requestFocusReason: 'keyboard',
      requestVersion: 5,
    });
  });
});
