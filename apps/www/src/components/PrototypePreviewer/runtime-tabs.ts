import {
  AdaptToWebComponent,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import * as shadcn from '@proto.ui/prototypes-shadcn/tabs';
import * as brutalist from '@proto.ui/prototypes-brutalist/tabs';
import * as bootstrap from '@proto.ui/prototypes-bootstrap-2-3-2/tabs';
import * as liquid from '@proto.ui/prototypes-liquid-glass/tabs';
import type { ProjectionFamilyId } from './projection-families';
import type { RuntimeId } from './runtimes/ids';

const families = { shadcn, brutalist, 'bootstrap-2-3-2': bootstrap, 'liquid-glass': liquid };
const labels: Partial<Record<RuntimeId, string>> = {
  wc: 'Web Components',
  react: 'React',
  vue: 'Vue',
  vue2: 'Vue 2',
};

/** One local activation's application-owned loading transition, not a Focus owner. */
export type RuntimeTabsFocusLease = Readonly<{ restore(): void; cancel(): void }>;
type RuntimeTab = WebComponentAdapterElement<typeof shadcn.tabsTrigger>;

/** Legacy embed chrome uses real family Tabs; projected pages instead mount the
 * same atoms in their active runtime generation through projection-composition. */
export function createRuntimeTabs(options: {
  mount: HTMLElement;
  panel: HTMLElement;
  family: ProjectionFamilyId;
  runtimes: readonly RuntimeId[];
  value: RuntimeId;
  onValueChange: (value: RuntimeId) => void;
}) {
  const { mount, panel, family, runtimes, onValueChange } = options;
  const definitions = families[family];
  const entries = {
    root: definitions.tabsRoot,
    list: definitions.tabsList,
    trigger: definitions.tabsTrigger,
    content: definitions.tabsContent,
  };
  for (const [part, proto] of Object.entries(entries)) {
    const tag = `pui-runtime-${family}-tabs-${part}`;
    if (!customElements.get(tag)) {
      customElements.define(tag, AdaptToWebComponent(proto, { register: false }));
    }
  }
  const element = (part: keyof typeof entries, props: Record<string, unknown>) => {
    const node = document.createElement(`pui-runtime-${family}-tabs-${part}`);
    setElementProps(node, props);
    return node;
  };
  let value = options.value;
  let disabled = false;
  let disposed = false;
  const root = element('root', { value, orientation: 'horizontal', activationMode: 'manual' });
  root.dataset.runtimeTabsRoot = '';
  const list = element('list', { appearance: 'underline', a11yLabel: 'Runtime', loop: true });
  root.append(list);
  const panels = new Map<RuntimeId, HTMLElement>();
  const triggers = new Map<RuntimeId, RuntimeTab>();
  let pendingFocus: {
    lease: RuntimeTabsFocusLease;
    beforeLock(): void;
    beforeUnlock(): void;
  } | null = null;
  for (const runtime of runtimes) {
    const trigger = element('trigger', { value: runtime, appearance: 'underline', disabled });
    trigger.textContent = labels[runtime] ?? runtime;
    trigger.dataset.runtimeTab = runtime;
    list.append(trigger);
    triggers.set(runtime, trigger as RuntimeTab);
    const content = element('content', { value: runtime, keepMounted: true });
    panels.set(runtime, content);
    root.append(content);
  }
  panels.get(value)!.append(panel);
  const change = (event: Event) => {
    if (event.target !== root || disabled || disposed) return;
    const next = (event as CustomEvent<{ value?: unknown }>).detail?.value;
    if (typeof next === 'string' && runtimes.includes(next as RuntimeId) && next !== value) {
      onValueChange(next as RuntimeId);
    }
  };
  root.addEventListener('valueChange', change);
  mount.replaceChildren(root);
  return {
    root,
    /** Only the local valueChange caller may carry this lease into its switch. */
    captureFocusLease(next: RuntimeId): RuntimeTabsFocusLease | null {
      pendingFocus?.lease.cancel();
      const trigger = triggers.get(next);
      const document = root.ownerDocument;
      const view = document.defaultView;
      const ownsFocus = () => {
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return active === trigger || (active !== null && trigger?.contains(active) === true);
      };
      if (disposed || disabled || root.inert || !trigger || !ownsFocus()) return null;
      const getExposes = trigger.getExposes;
      if (typeof getExposes !== 'function') return null;
      const parent = mount.parentNode;
      const tree = mount.getRootNode();
      const currentOwner = () =>
        !disposed &&
        mount.isConnected &&
        mount.parentNode === parent &&
        mount.getRootNode() === tree &&
        root.parentNode === mount &&
        list.parentNode === root &&
        trigger.parentNode === list &&
        trigger.isConnected &&
        trigger.getExposes === getExposes;
      if (!currentOwner()) return null;
      const reason = getExposes.call(trigger).focusVisible.get() ? 'keyboard' : 'programmatic';
      const isFallback = () =>
        document.activeElement === null ||
        document.activeElement === document.body ||
        document.activeElement === document.documentElement;
      let live = true;
      let locked = false;
      let lostToLock = false;
      // A remove/reinsert may reuse its WC public facade. Observe only the
      // owned ancestry's direct child lists, not arbitrary document mutations.
      const ownershipPath = new Set<Node>();
      for (let node: Node | null = trigger; node; ) {
        ownershipPath.add(node);
        node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null);
      }
      const available = () => {
        if (trigger.getExposes().disabled.get()) return false;
        for (const node of ownershipPath) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.inert || node.hidden) return false;
          const style = view?.getComputedStyle(node);
          if (style?.display === 'none' || style?.visibility === 'hidden') return false;
        }
        return true;
      };
      const removedOwner = (records: MutationRecord[]) =>
        records.some((record) => [...record.removedNodes].some((node) => ownershipPath.has(node)));
      const observer = new MutationObserver((records) => {
        if (removedOwner(records)) cancel();
      });
      const cancel = () => {
        if (!live) return;
        live = false;
        document.removeEventListener('focusin', cancel, true);
        document.removeEventListener('pointerdown', cancel, true);
        document.removeEventListener('keydown', cancel, true);
        view?.removeEventListener('blur', cancel);
        observer.disconnect();
        if (pendingFocus?.lease === lease) pendingFocus = null;
      };
      const lease: RuntimeTabsFocusLease = {
        cancel,
        restore() {
          if (removedOwner(observer.takeRecords())) cancel();
          const mayRestore =
            live &&
            locked &&
            lostToLock &&
            currentOwner() &&
            value === next &&
            !disabled &&
            !root.inert &&
            available() &&
            isFallback();
          // Consume before calling into the public method: focus callbacks may reenter.
          cancel();
          if (mayRestore) trigger.getExposes().focusSelf({ reason, preventScroll: true });
        },
      };
      pendingFocus = {
        lease,
        beforeLock() {
          if (locked || !currentOwner() || root.inert || !ownsFocus()) return cancel();
          locked = true;
        },
        beforeUnlock() {
          // Sample while our inert gate is still installed. Returning from any
          // newer focus to body cannot revive a lease canceled by focusin/input.
          lostToLock = live && locked && root.inert && !ownsFocus() && isFallback();
        },
      };
      document.addEventListener('focusin', cancel, true);
      document.addEventListener('pointerdown', cancel, true);
      document.addEventListener('keydown', cancel, true);
      view?.addEventListener('blur', cancel);
      for (const node of ownershipPath) observer.observe(node, { childList: true });
      return lease;
    },
    /** Only call after the prior demo has destroyed its runtime-owned children. */
    select(next: RuntimeId) {
      if (disposed || !panels.has(next)) return;
      value = next;
      if (panel.parentElement !== panels.get(next)) panels.get(next)!.append(panel);
      setElementProps(root, { value, orientation: 'horizontal', activationMode: 'manual' });
    },
    setDisabled(next: boolean) {
      if (disposed) return;
      if (next) pendingFocus?.beforeLock();
      else pendingFocus?.beforeUnlock();
      disabled = next;
      // Loading belongs to this application shell. Preserve each Tab's own
      // availability and controlled value; gate all physical input as one unit.
      root.inert = disabled;
      root.setAttribute('aria-busy', String(disabled));
    },
    dispose() {
      if (disposed) return;
      pendingFocus?.lease.cancel();
      disposed = true;
      root.removeEventListener('valueChange', change);
      // Return the now-empty preview shell before disconnecting all Tabs atoms.
      mount.after(panel);
      root.remove();
    },
  };
}
