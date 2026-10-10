import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
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
  for (const runtime of runtimes) {
    const trigger = element('trigger', { value: runtime, appearance: 'underline', disabled });
    trigger.textContent = labels[runtime] ?? runtime;
    trigger.dataset.runtimeTab = runtime;
    list.append(trigger);
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
    /** Only call after the prior demo has destroyed its runtime-owned children. */
    select(next: RuntimeId) {
      if (disposed || !panels.has(next)) return;
      value = next;
      if (panel.parentElement !== panels.get(next)) panels.get(next)!.append(panel);
      setElementProps(root, { value, orientation: 'horizontal', activationMode: 'manual' });
    },
    setDisabled(next: boolean) {
      if (disposed) return;
      disabled = next;
      // Loading belongs to this application shell. Preserve each Tab's own
      // availability and controlled value; gate all physical input as one unit.
      root.inert = disabled;
      root.setAttribute('aria-busy', String(disabled));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeEventListener('valueChange', change);
      // Return the now-empty preview shell before disconnecting all Tabs atoms.
      mount.after(panel);
      root.remove();
    },
  };
}
