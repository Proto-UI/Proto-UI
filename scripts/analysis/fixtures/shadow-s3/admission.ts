import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { definePrototype, tw } from '@proto.ui/core';
import { asAccessible } from '@proto.ui/hooks';
import { tabsRoot, tabsList, tabsTrigger, tabsContent } from '@proto.ui/prototypes-shadcn/tabs';
import { protoShadowStyleArtifact } from '../../../../apps/www/src/styles/proto-ui-shadow-style.generated.js';

// Complete public prototypes only. No token deletion, classifier override,
// guessed hidden routing, or CSS substitute for a missing split recipe.
export function mount(
  mode: string,
  keepMounted: boolean,
  echo: 'none' | 'sync' | 'microtask' = 'none'
) {
  const errors: string[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.error?.message ?? event.message);
    event.preventDefault(); // Native CE reaction failures are asserted by the runner.
  };
  window.addEventListener('error', onError);
  const events: Record<string, Array<{ type: string; epoch?: number }>> = {};
  const subscriptions = new Set<() => void>();
  const source = {
    get: () => 'light' as const,
    subscribe(callback: () => void) {
      subscriptions.add(callback);
      return () => subscriptions.delete(callback);
    },
  };
  const make = (
    key: string,
    kind: string,
    proto: typeof tabsRoot | typeof tabsList | typeof tabsTrigger | typeof tabsContent
  ) => {
    events[key] = [];
    const split = mode === 'full' || mode === kind;
    const C = AdaptToWebComponent(proto, {
      registerAs: `s3-audit-${key}`,
      shadow: split
        ? {
            mode: 'open',
            presentation: 'split',
            styleArtifact: protoShadowStyleArtifact,
            colorSchemeSource: source,
          }
        : mode === 'direct',
      diagnostics: {
        onLifecycleEvent(event) {
          events[key].push(event);
        },
      },
    });
    const el = new C();
    el.dataset.s3 = key;
    return el;
  };
  const root = make('root', 'root', tabsRoot);
  setElementProps(root, echo === 'none' ? { defaultValue: 'a' } : { value: 'a' });
  const list = make('list', 'list', tabsList);
  const a = make('trigger-a', 'trigger', tabsTrigger);
  const b = make('trigger-b', 'trigger', tabsTrigger);
  setElementProps(a, { value: 'a' });
  setElementProps(b, { value: 'b' });
  a.textContent = 'Account';
  b.textContent = 'Preferences';
  list.append(a, b);
  const panels = ['a', 'b'].map((value) => {
    const panel = make(`content-${value}`, 'content', tabsContent);
    setElementProps(panel, { value, keepMounted });
    const child = document.createElement('button');
    child.textContent = `Panel ${value}`;
    panel.append(child);
    return panel;
  });
  root.append(list, ...panels);
  document.body.append(root);
  let changes = 0;
  root.addEventListener('valueChange', (event) => {
    changes++;
    if (echo === 'none') return;
    const value = (event as CustomEvent<{ value: string }>).detail.value;
    const apply = () => setElementProps(root, { value });
    if (echo === 'sync') apply();
    else queueMicrotask(apply);
  });
  const hosts = [root, list, a, b, ...panels];
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  const sample = () => ({
    errors: [...errors],
    changes,
    rootValue: (root as any).getExposes?.().value?.get(),
    subscriptions: subscriptions.size,
    parts: hosts.map((el) => {
      const key = el.dataset.s3!;
      const rect = el.getBoundingClientRect();
      return {
        key,
        display: getComputedStyle(el).display,
        size: [rect.width, rect.height],
        selected: el.getAttribute('aria-selected'),
        hidden: el.hasAttribute('hidden'),
        ariaHidden: el.getAttribute('aria-hidden'),
        detached: el.hasAttribute('data-pui-view-detached'),
        pending: el.hasAttribute('data-pui-view-pending'),
        setup: events[key].filter((e) => e.type === 'instance.setup.exit').length,
        mounts: events[key].filter((e) => e.type === 'mount.mounted').length,
        unmounts: events[key].filter((e) => e.type === 'unmount.done').length,
        disposed: events[key].filter((e) => e.type === 'instance.dispose.done').length,
        surface: el.shadowRoot?.querySelectorAll('[part="surface"]').length ?? 0,
        projection: el.hasAttribute('data-pui-split-root-style'),
      };
    }),
  });
  return {
    sample,
    flush,
    async dispose() {
      root.remove();
      await flush();
      const result = {
        subscriptions: subscriptions.size,
        shadowChildren: hosts.map((el) => el.shadowRoot?.childNodes.length ?? 0),
        disposed: hosts.map(
          (el) => events[el.dataset.s3!].filter((e) => e.type === 'instance.dispose.done').length
        ),
        errors: [...errors],
      };
      window.removeEventListener('error', onError);
      return result;
    },
  };
}

// A separate diagnostic, never a substitute for complete Tabs admission.
// C-A11Y-0001-L governs tree hiding; legacy state hiding is observed only.
export function mountHidingProbe(split: boolean, mechanism: 'tree' | 'state') {
  let setup = 0,
    mounts = 0,
    unmounts = 0;
  const proto = definePrototype<{ hidden: boolean; present: boolean }>({
    name: 's3-hiding-probe',
    setup(def) {
      setup++;
      def.props.define({ hidden: { type: 'boolean' }, present: { type: 'boolean' } });
      def.props.setDefaults({ hidden: false, present: true });
      const hidden = def.state.bool('probe.hidden', false);
      const accessible = asAccessible();
      if (mechanism === 'tree') accessible.tree({ hidden });
      else accessible.state('hidden', hidden);
      def.feedback.style.use(tw('block'));
      def.lifecycle.onCreated((run) => {
        hidden.set(run.props.get().hidden);
        run.lifecycle.setPresent(run.props.get().present);
      });
      def.props.watch(['hidden', 'present'], (run, next) => {
        hidden.set(next.hidden);
        run.lifecycle.setPresent(next.present);
      });
      def.lifecycle.onMounted(() => {
        mounts++;
      });
      def.lifecycle.onUnmounted(() => {
        unmounts++;
      });
      return (r) => r.slot();
    },
  });
  const C = AdaptToWebComponent(proto, {
    registerAs: 's3-hiding-probe',
    shadow: split
      ? { mode: 'open', presentation: 'split', styleArtifact: protoShadowStyleArtifact }
      : false,
  });
  const el = new C();
  const child = document.createElement('button');
  child.textContent = 'Probe action';
  el.append(child);
  document.body.append(el);
  const sample = () => ({
    nativeHidden: el.hidden,
    ariaHidden: el.getAttribute('aria-hidden'),
    display: getComputedStyle(el).display,
    height: el.getBoundingClientRect().height,
    detached: el.hasAttribute('data-pui-view-detached'),
    setup,
    mounts,
    unmounts,
  });
  return {
    sample,
    set(props: { hidden: boolean; present: boolean }) {
      setElementProps(el, props);
    },
    dispose() {
      el.remove();
    },
  };
}
