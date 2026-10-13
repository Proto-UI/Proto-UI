import { isWebFocusTargetActive } from '@proto.ui/adapter-base';
import { FOCUS_CENTER } from '../../../../modules/focus/src/center';
import * as ReactFocusTree from '../../../react/src/platform/instance-tree';
import * as VueFocusTree from '../../../vue/src/platform/instance-tree';
import * as Vue2FocusTree from '../../../vue2/src/platform/instance-tree';
import * as WCFocusTree from '../../../web-component/src/platform/instance-tree';
import { definePrototype, type Prototype } from '@proto.ui/core';
import { asFocusEntry, asFocusable, asTextControl } from '@proto.ui/hooks';
import { declareTextControl } from '@proto.ui/module-text-control';
import { mountNativeFocusIntentReact } from '../../../react/test/fixtures/focus-intent-mount-native';
import { createMountedVueAdapter, flushVue } from '../../../vue/test/utils/vue';
import { createMountedVue2Adapter, flushVue2 } from '../../../vue2/test/utils/vue2';
import { AdaptToWebComponent } from '../../../web-component/src';

export type Runtime = 'react' | 'vue' | 'vue2' | 'wc';
type Kind = 'programmatic' | 'native' | 'entry';
const frames = async (count: number) => {
  for (let i = 0; i < count; i++)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};
const microtasks = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

// These mount helpers use each Adapter's actual installed framework. No focus,
// event-gate, frame, or eligibility API is replaced or patched by this fixture.
async function mount(runtime: Runtime, proto: Prototype<any, any>, shadow = false) {
  if (runtime === 'react') return mountNativeFocusIntentReact(proto);
  if (runtime === 'vue') {
    const mounted = createMountedVueAdapter(proto);
    await flushVue();
    await flushVue();
    return {
      get root() {
        return mounted.host.firstElementChild as HTMLElement;
      },
      getExposes: () => mounted.vm.getExposes(),
      act: async (callback: () => void) => {
        callback();
        await flushVue();
        await flushVue();
      },
      unmount: async () => mounted.unmount(),
    };
  }
  if (runtime === 'vue2') {
    const mounted = createMountedVue2Adapter(proto);
    await flushVue2();
    return {
      get root() {
        return mounted.host.firstElementChild as HTMLElement;
      },
      getExposes: () => mounted.vm.getExposes(),
      act: async (callback: () => void) => {
        callback();
        await flushVue2();
      },
      unmount: async () => mounted.unmount(),
    };
  }
  AdaptToWebComponent(proto, { shadow });
  const root = document.createElement(proto.name) as HTMLElement & { getExposes(): any };
  document.body.append(root);
  await microtasks();
  return {
    root,
    getExposes: () => root.getExposes(),
    act: async (callback: () => void) => {
      callback();
      await microtasks();
    },
    unmount: async () => {
      root.remove();
      await microtasks();
    },
  };
}

export async function observeIntentBudget(runtime: Runtime, kind: Kind) {
  const reusedOptions = Object.freeze({ preventScroll: true });
  const proto = definePrototype({
    name: `native-intent-${runtime}-${kind}`,
    setup(def) {
      if (kind === 'entry') {
        const entry = asFocusEntry();
        // Self policy resolves before the UA rejects hidden focus. A hidden
        // descendant is correctly excluded by entry policy and creates no retry.
        entry.configure({ strategy: 'self', fallback: 'self' });
        def.expose.method('request', (reused: boolean) =>
          entry.focus(reused ? reusedOptions : undefined)
        );
      } else {
        const target = asFocusable();
        def.expose.state('focused', target.focused);
        def.expose.method('request', (reused: boolean) => {
          const options = reused ? reusedOptions : undefined;
          if (kind === 'native') target.focusSelf(options);
          else target.focus(options);
        });
      }
      return (r) => r.el('button', 'Native retry target');
    },
  });
  const mounted = await mount(runtime, proto);
  try {
    await frames(3);
    const target = mounted.root;
    let trustedFocusEvents = 0;
    target.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedFocusEvents++;
    });
    const cycles: Array<{
      options: string;
      rejected: boolean;
      exhaustedAfterReveal: boolean;
      newRejected: boolean;
      recovered: boolean;
    }> = [];
    for (const reused of [false, true]) {
      await mounted.act(() => target.blur());
      // Authored CSS makes an otherwise connected resolved target reject focus.
      // Three bounded retries each cross two genuine animation frames.
      target.style.display = 'none';
      await mounted.act(() => mounted.getExposes().request(reused));
      const rejected = document.activeElement !== target;
      await frames(8);
      target.style.removeProperty('display');
      await frames(3);
      const exhaustedAfterReveal = document.activeElement !== target;
      target.style.display = 'none';
      await mounted.act(() => mounted.getExposes().request(reused));
      const newRejected = document.activeElement !== target;
      target.style.removeProperty('display');
      await frames(3);
      const recovered = document.activeElement === target;
      cycles.push({
        options: reused ? 'reused' : 'omitted',
        rejected,
        exhaustedAfterReveal,
        newRejected,
        recovered,
      });
    }
    return { cycles, trustedFocusEvents };
  } finally {
    await mounted.unmount();
  }
}

export async function observeFocusedRootBudget(runtime: Runtime) {
  let run: any;
  let descendantPresent = false;
  const proto = definePrototype({
    name: `native-intent-${runtime}-focused-root`,
    setup(def) {
      const target = asFocusable();
      const entry = asFocusEntry();
      entry.configure({ strategy: 'descendant-first', fallback: 'self' });
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.expose.state('focused', target.focused);
      def.expose.method('focusRoot', () => target.focus());
      def.expose.method('enter', () => entry.focus());
      def.expose.method('addDescendant', () => {
        descendantPresent = true;
        run.update();
      });
      return (r) =>
        descendantPresent ? r.el('button', 'Rejecting descendant') : 'Initial focusable fallback';
    },
  });
  const mounted = await mount(runtime, proto);
  try {
    await frames(3);
    // Establish the root while entry self-fallback is eligible, then author a
    // descendant. Removing its Tab stop must not manufacture a blur/focus.
    await mounted.act(() => mounted.getExposes().focusRoot());
    const initialRootActive = document.activeElement === mounted.root;
    await mounted.act(() => mounted.getExposes().addDescendant());
    await frames(3);
    const target = mounted.root.querySelector('button')!;
    let trustedDescendantFocusEvents = 0;
    target.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedDescendantFocusEvents++;
    });
    target.style.display = 'none';
    await mounted.act(() => mounted.getExposes().enter());
    await frames(8);
    target.style.removeProperty('display');
    await frames(3);
    const afterBudget = {
      rootActive: document.activeElement === mounted.root,
      rootFocused: mounted.getExposes().focused.get(),
      descendantActive: document.activeElement === target,
      trustedDescendantFocusEvents,
    };
    await mounted.act(() => mounted.getExposes().enter());
    return {
      initialRootActive,
      afterBudget,
      explicitRecovery: document.activeElement === target,
      trustedDescendantFocusEvents,
    };
  } finally {
    await mounted.unmount();
  }
}

export async function observeSameViewCommitBudget(runtime: Runtime, kind: Kind) {
  let run: any;
  const proto = definePrototype({
    name: `native-same-view-budget-${runtime}-${kind}`,
    setup(def) {
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.expose.method('update', () => run.update());
      if (kind === 'entry') {
        const entry = asFocusEntry();
        entry.configure({ strategy: 'self', fallback: 'self' });
        def.expose.method('request', () => entry.focus());
      } else {
        const target = asFocusable();
        def.expose.state('focused', target.focused);
        def.expose.method('request', () =>
          kind === 'native' ? target.focusSelf() : target.focus()
        );
      }
      return (r) => r.el('button', 'Rejected across unrelated updates');
    },
  });
  const mounted = await mount(runtime, proto);
  const initialRoot = mounted.root;
  const target = () => mounted.root;
  const rejectionStyle = document.createElement('style');
  rejectionStyle.textContent = 'body[data-focus-intent-reject] { display: none !important; }';
  document.head.append(rejectionStyle);
  let trustedFocusEvents = 0;
  const observe = (event: FocusEvent) => {
    if (event.isTrusted && event.target === target()) trustedFocusEvents++;
  };
  document.addEventListener('focus', observe, true);
  try {
    await frames(3);
    // The fixture owns this body attribute. Framework commits cannot erase the
    // CSS rejection, including when an Adapter replaces its physical Root.
    document.body.setAttribute('data-focus-intent-reject', '');
    await mounted.act(() => mounted.getExposes().request());
    const rejected = document.activeElement !== target();
    await frames(8);
    const commitsStillPending: boolean[] = [];
    for (let commit = 0; commit < 2; commit++) {
      await mounted.act(() => mounted.getExposes().update());
      document.body.removeAttribute('data-focus-intent-reject');
      await frames(3);
      commitsStillPending.push(document.activeElement !== target());
      document.body.setAttribute('data-focus-intent-reject', '');
    }
    await mounted.act(() => mounted.getExposes().request());
    document.body.removeAttribute('data-focus-intent-reject');
    await frames(3);
    return {
      sameRoot: mounted.root === initialRoot,
      rejected,
      commitsStillPending,
      freshAcquired: document.activeElement === target(),
      focused: kind === 'entry' ? null : mounted.getExposes().focused.get(),
      trustedFocusEvents,
    };
  } finally {
    document.removeEventListener('focus', observe, true);
    document.body.removeAttribute('data-focus-intent-reject');
    rejectionStyle.remove();
    await mounted.unmount();
  }
}

export async function observeNewTeardownRequest(runtime: 'vue2' | 'wc', kind: Kind) {
  let run: any;
  let request = false;
  let oldTarget: HTMLElement;
  const during: Array<{ connected: boolean; active: boolean; focused: boolean }> = [];
  const proto = definePrototype({
    name: `native-new-teardown-${runtime}-${kind}`,
    modules:
      runtime === 'wc'
        ? [declareTextControl({ content: 'plain-text', lineMode: 'multiline', engine: 'host' })]
        : undefined,
    setup(def) {
      if (runtime === 'wc') asTextControl();
      const target = asFocusable();
      const entry = asFocusEntry();
      entry.configure({ strategy: 'self', fallback: 'self' });
      def.expose.state('focused', target.focused);
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.expose('view', {
        hide: () => run.lifecycle.setPresent(false),
        show: () => run.lifecycle.setPresent(true),
      });
      def.lifecycle.onUnmounted(() => {
        if (!request) return;
        request = false;
        if (kind === 'programmatic') target.focus();
        else if (kind === 'native') target.focusSelf();
        else entry.focus();
        during.push({
          connected: oldTarget.isConnected,
          active: document.activeElement === oldTarget,
          focused: target.focused.get(),
        });
      });
      return () => (runtime === 'wc' ? null : 'Connected Vue2 teardown target');
    },
  });
  const mounted = await mount(runtime, proto);
  const target = () =>
    runtime === 'wc' ? mounted.root.querySelector<HTMLElement>('textarea')! : mounted.root;
  let trustedReadyFocusEvents = 0;
  const observe = (event: FocusEvent) => {
    if (event.isTrusted && event.target === target()) trustedReadyFocusEvents++;
  };
  try {
    await frames(3);
    oldTarget = target();
    request = true;
    await mounted.act(() => mounted.getExposes().view.hide());
    document.addEventListener('focus', observe, true);
    await mounted.act(() => mounted.getExposes().view.show());
    await frames(3);
    return {
      during,
      after: {
        active: document.activeElement === target(),
        focused: mounted.getExposes().focused.get(),
      },
      trustedReadyFocusEvents,
    };
  } finally {
    request = false;
    document.removeEventListener('focus', observe, true);
    await mounted.unmount();
  }
}

// Exercise the native blur stack itself: re-enable and programmatic focus are
// issued synchronously by an actual DOM listener, through public test exposes.
export async function observeBlurReentry(runtime: Runtime) {
  const proto = definePrototype({
    name: `native-blur-reentry-${runtime}`,
    setup(def) {
      const target = asFocusable();
      def.expose.state('focused', target.focused);
      def.expose.state('focusable', target.focusable);
      def.expose.method('request', () => target.focus());
      def.expose.method('disable', () => target.setDisabled(true));
      def.expose.method('restore', () => {
        target.setDisabled(false);
        target.focus();
      });
      return () => 'Native blur reentry';
    },
  });
  const mounted = await mount(runtime, proto);
  let trustedBlurEvents = 0,
    trustedFocusEvents = 0;
  const during: Array<{ active: boolean; focused: boolean; focusable: boolean }> = [];
  const root = mounted.root;
  const snapshot = () => ({
    active: document.activeElement === root,
    focused: mounted.getExposes().focused.get(),
    focusable: mounted.getExposes().focusable.get(),
  });
  const onFocus = (event: FocusEvent) => {
    if (event.isTrusted) trustedFocusEvents++;
  };
  const onBlur = (event: FocusEvent) => {
    if (event.isTrusted) trustedBlurEvents++;
    mounted.getExposes().restore();
    during.push(snapshot());
  };
  root.addEventListener('focus', onFocus);
  try {
    await mounted.act(() => mounted.getExposes().request());
    const initial = snapshot();
    root.addEventListener('blur', onBlur, { once: true });
    await mounted.act(() => mounted.getExposes().disable());
    const after = snapshot();
    await frames(3);
    return { initial, during, after, settled: snapshot(), trustedBlurEvents, trustedFocusEvents };
  } finally {
    root.removeEventListener('focus', onFocus);
    root.removeEventListener('blur', onBlur);
    await mounted.unmount();
  }
}

export async function observeRetainedViewBudget(runtime: Runtime, kind: Kind) {
  let run: any;
  const proto = definePrototype({
    name: `native-retained-view-budget-${runtime}-${kind}`,
    setup(def) {
      def.lifecycle.onCreated((value) => {
        run = value;
      });
      def.expose('view', {
        hide: () => run.lifecycle.setPresent(false),
        show: () => run.lifecycle.setPresent(true),
      });
      if (kind === 'entry') {
        const entry = asFocusEntry();
        entry.configure({ strategy: 'self', fallback: 'self' });
        def.expose.method('request', () => entry.focus());
      } else {
        const target = asFocusable();
        def.expose.state('focused', target.focused);
        def.expose.method('request', () =>
          kind === 'native' ? target.focusSelf() : target.focus()
        );
      }
      return (r) => r.el('button', 'Rejected across retained replacements');
    },
  });
  const mounted = await mount(runtime, proto);
  const target = () => mounted.root;
  const rejectionStyle = document.createElement('style');
  rejectionStyle.textContent = 'body[data-focus-intent-reject] { display: none !important; }';
  document.head.append(rejectionStyle);
  let trustedFocusEvents = 0;
  const observe = (event: FocusEvent) => {
    if (event.isTrusted && event.target === target()) trustedFocusEvents++;
  };
  document.addEventListener('focus', observe, true);
  try {
    await frames(3);
    // The fixture owns this body attribute. Framework commits cannot erase the
    // CSS rejection, including when an Adapter replaces its physical Root.
    document.body.setAttribute('data-focus-intent-reject', '');
    await mounted.act(() => mounted.getExposes().request());
    const rejected = document.activeElement !== target();
    await frames(8);
    const replacementsStillPending: boolean[] = [];
    const retainedViewsReady: boolean[] = [];
    for (let commit = 0; commit < 2; commit++) {
      await mounted.act(() => mounted.getExposes().view.hide());
      await mounted.act(() => mounted.getExposes().view.show());
      // Drain framework commit/microtask work before lifting the independently
      // owned CSS rejection; do not issue a newer request to make it ready.
      await mounted.act(() => {});
      retainedViewsReady.push(
        mounted.root.isConnected &&
          !mounted.root.hasAttribute('data-pui-view-pending') &&
          !mounted.root.hasAttribute('data-pui-view-detached')
      );
      document.body.removeAttribute('data-focus-intent-reject');
      await frames(3);
      replacementsStillPending.push(document.activeElement !== target());
      document.body.setAttribute('data-focus-intent-reject', '');
    }
    await mounted.act(() => mounted.getExposes().request());
    document.body.removeAttribute('data-focus-intent-reject');
    await frames(3);
    return {
      rejected,
      retainedViewsReady,
      replacementsStillPending,
      freshAcquired: document.activeElement === target(),
      focused: kind === 'entry' ? null : mounted.getExposes().focused.get(),
      trustedFocusEvents,
    };
  } finally {
    document.removeEventListener('focus', observe, true);
    document.body.removeAttribute('data-focus-intent-reject');
    rejectionStyle.remove();
    await mounted.unmount();
  }
}

// Native-browser controls: no focus/frame APIs are patched. A target reference
// only reads the active element of its own tree, including an owned closed root.
export async function observeShadowAcquisition(
  runtime: Runtime,
  mode: 'open' | 'closed' | 'nested' | 'own-control',
  kind: Kind
) {
  const ownControl = mode === 'own-control';
  const proto = definePrototype({
    name: `native-shadow-focus-${runtime}-${mode}-${kind}`,
    ...(ownControl
      ? {
          modules: [
            declareTextControl({ content: 'plain-text', lineMode: 'single', engine: 'host' }),
          ],
        }
      : {}),
    setup(def) {
      if (ownControl) asTextControl();
      const target = asFocusable(),
        entry = asFocusEntry();
      entry.configure({ strategy: 'self', fallback: 'self' });
      def.expose.state('focused', target.focused);
      def.expose.method('request', () => {
        const options = { reason: 'keyboard' as const, preventScroll: true };
        if (kind === 'entry') entry.focus(options);
        else if (kind === 'native') target.focusSelf(options);
        else target.focus(options);
      });
      return () => null;
    },
  });
  const mounted = await mount(runtime, proto, ownControl);
  const host = document.createElement('div');
  document.body.append(host);
  try {
    if (!ownControl) {
      let root = host.attachShadow({ mode: mode === 'closed' ? 'closed' : 'open' });
      if (mode === 'nested') {
        const inner = document.createElement('div');
        root.append(inner);
        root = inner.attachShadow({ mode: 'closed' });
      }
      root.append(runtime === 'wc' ? mounted.root : mounted.root.parentElement!);
    }
    await frames(3);
    const target = ownControl ? mounted.root.shadowRoot!.querySelector('input')! : mounted.root;
    let trustedFocusEvents = 0;
    target.addEventListener('focus', (event) => {
      if (event.isTrusted) trustedFocusEvents++;
    });
    await mounted.act(() => mounted.getExposes().request());
    await frames(8);
    const tree = { react: ReactFocusTree, vue: VueFocusTree, vue2: Vue2FocusTree, wc: WCFocusTree }[
      runtime
    ];
    const token = tree.getLogicalEventRouteSurfaceForTarget(target);
    const entry = (FOCUS_CENTER as any).entries.get(token);
    return {
      retargeted: document.activeElement === (ownControl ? mounted.root : host),
      activeInOwnRoot: (target.getRootNode() as Document | ShadowRoot).activeElement === target,
      knownOwner: !!entry,
      pending: entry?.hasPendingFocus() ?? null,
      focused: mounted.getExposes().focused.get(),
      trustedFocusEvents,
    };
  } finally {
    await mounted.unmount();
    host.remove();
  }
}

export function observeDelegatedShadowFocus() {
  const host = document.createElement('div');
  host.tabIndex = 0;
  const root = host.attachShadow({ mode: 'closed', delegatesFocus: true });
  const first = document.createElement('button'),
    second = document.createElement('button');
  root.append(first, second);
  document.body.append(host);
  try {
    host.focus();
    const delegated = {
      hostRetargeted: document.activeElement === host,
      firstActive: isWebFocusTargetActive(first),
      secondActive: isWebFocusTargetActive(second),
    };
    second.focus();
    const moved = {
      firstActive: isWebFocusTargetActive(first),
      secondActive: isWebFocusTargetActive(second),
    };
    second.blur();
    const blurred = isWebFocusTargetActive(second);
    first.focus();
    host.remove();
    return { delegated, moved, blurred, detached: isWebFocusTargetActive(first) };
  } finally {
    host.remove();
  }
}
