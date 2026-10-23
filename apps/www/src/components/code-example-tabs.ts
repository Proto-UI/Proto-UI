import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as shadcn from '@proto.ui/prototypes-shadcn/tabs';
import * as brutalist from '@proto.ui/prototypes-brutalist/tabs';

/** Reveal only along the tab strip; never scroll the document vertically. */
export function revealCodeExampleTab(tab: HTMLElement, viewport: HTMLElement): void {
  const bounds = viewport.getBoundingClientRect();
  const target = tab.getBoundingClientRect();
  if (!bounds.width || !target.width) return;
  if (target.left < bounds.left) viewport.scrollLeft += target.left - bounds.left;
  else if (target.right > bounds.right) viewport.scrollLeft += target.right - bounds.right;
}

type TabProjection = { select(index: number): void; destroy(): void };

/** Progressive legacy chrome, like runtime-tabs.ts: real family Tabs rendered
 * by WC, independently of the host whose source is being read. This is not a
 * claim that CodeExample has joined the page-wide runtime transaction. */
export function enhanceCodeExampleTabs(options: {
  list: HTMLElement;
  tabs: HTMLElement[];
  panels: HTMLElement[];
  onSelect(index: number): void;
}): TabProjection {
  const { list, tabs, panels, onSelect } = options;
  const doc = list.ownerDocument;
  const active = doc.activeElement;
  if (list.contains(active) || panels.some((panel) => panel.contains(active))) {
    return { select() {}, destroy() {} };
  }
  const scope = list.closest<HTMLElement>('[data-projection-family], [data-site-library-family]');
  const family = (scope?.dataset.projectionFamily ?? scope?.dataset.siteLibraryFamily ??
    doc.documentElement.dataset.siteLibraryFamily) === 'brutalist' ? 'brutalist' : 'shadcn';
  const definitions = family === 'brutalist' ? brutalist : shadcn;
  const entries = {
    root: definitions.tabsRoot,
    list: definitions.tabsList,
    trigger: definitions.tabsTrigger,
    content: definitions.tabsContent,
  };
  for (const [part, proto] of Object.entries(entries)) {
    const tag = `pui-code-example-${family}-tabs-${part}`;
    if (!customElements.get(tag)) {
      customElements.define(tag, AdaptToWebComponent(proto, { register: false }));
    }
  }
  const element = (part: keyof typeof entries, props: Record<string, unknown>) => {
    const node = doc.createElement(`pui-code-example-${family}-tabs-${part}`);
    setElementProps(node, props);
    return node;
  };
  let value = Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
  let destroyed = false;
  const rootProps = () => ({ value: String(value), orientation: 'horizontal', activationMode: 'automatic' });
  const root = element('root', { ...rootProps(), surfaceStyle: { display: 'block', minWidth: '0', width: '100%' } });
  root.dataset.codeExampleTabsProjection = family;
  const projectedList = element('list', {
    appearance: 'underline', a11yLabel: list.getAttribute('aria-label') ?? 'Code example', loop: false,
    surfaceStyle: { paddingInline: '0.75rem', gap: '1.25rem', minWidth: '0' },
  });
  projectedList.dataset.codeExampleTablist = list.hasAttribute('data-code-host-tabs') ? 'host' : 'file';
  root.append(projectedList);
  const originals = panels.map((panel) => ({
    panel, marker: doc.createComment('code-example-source'),
    role: panel.getAttribute('role'), labelledBy: panel.getAttribute('aria-labelledby'),
  }));
  if (panels.length !== tabs.length) throw new Error('[CodeExample] Tabs and panels must match.');
  const triggers: HTMLElement[] = [];
  const contents: HTMLElement[] = [];
  for (const [index, tab] of tabs.entries()) {
    const trigger = element('trigger', {
      value: String(index), appearance: 'underline',
      surfaceStyle: { minHeight: '2.75rem', fontSize: '0.8125rem', lineHeight: '1.25rem' },
    });
    // Astro preserves formatting whitespace around authored labels. Keep the
    // projected label exact without touching source-code whitespace.
    trigger.textContent = tab.dataset.codeHostName ?? tab.textContent?.trim() ?? '';
    if (tab.dataset.codeHostName) trigger.dataset.codeHostName = tab.dataset.codeHostName;
    if (tab.dataset.codeHostAvailability) {
      const status = doc.createElement('span');
      status.dataset.codeHostStatus = '';
      status.textContent = ` · ${tab.dataset.codeHostAvailability}`;
      trigger.append(status);
      trigger.dataset.codeHostAvailability = tab.dataset.codeHostAvailability;
    }
    trigger.dataset.codeExampleProjectedTab = String(index);
    projectedList.append(trigger);
    triggers.push(trigger);
    const content = element('content', {
      value: String(index), keepMounted: true,
      surfaceStyle: { margin: '0', minWidth: '0' },
    });
    const original = originals[index];
    if (!original) throw new Error('[CodeExample] Missing source panel for Tabs.');
    contents.push(content);
    root.append(content);
  }
  const strip = list.parentElement?.hasAttribute('data-code-toolbar') ? list.parentElement : list;
  const previousHidden = strip.hidden;
  const reveal = () => revealCodeExampleTab(triggers[value], projectedList);
  const onFocus = (event: Event) => {
    const index = triggers.findIndex((trigger) => trigger.contains(event.target as Node));
    if (index >= 0) revealCodeExampleTab(triggers[index], projectedList);
  };
  const hint = list.hasAttribute('data-code-host-tabs')
    ? list.closest('[data-code-example]')?.querySelector<HTMLElement>('[data-code-host-overflow]') : null;
  const hintMarker = hint ? doc.createComment('code-example-host-hint') : null;
  const updateOverflow = () => {
    if (hint) hint.hidden = projectedList.scrollWidth <= projectedList.clientWidth + 1;
    reveal();
  };
  const resize = typeof doc.defaultView?.ResizeObserver === 'function'
    ? new doc.defaultView.ResizeObserver(updateOverflow) : null;
  let queued = false;
  const publishValue = () => {
    if (queued || destroyed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!destroyed) {
        setElementProps(root, { ...rootProps(), surfaceStyle: { display: 'block', minWidth: '0', width: '100%' } });
        reveal();
      }
    });
  };
  const change = (event: Event) => {
    if (destroyed || event.target !== root) return;
    const next = Number((event as CustomEvent<{ value?: unknown }>).detail?.value);
    if (!Number.isInteger(next) || next < 0 || next >= tabs.length || next === value) return;
    value = next;
    onSelect(next);
    publishValue();
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    root.removeEventListener('valueChange', change);
    projectedList.removeEventListener('focusin', onFocus);
    resize?.disconnect();
    if (hint && hintMarker?.parentNode) hintMarker.replaceWith(hint);
    if (hint) hint.hidden = false;
    for (const { panel, marker, role, labelledBy } of originals) {
      if (marker.parentNode) marker.replaceWith(panel);
      if (role !== null) panel.setAttribute('role', role);
      if (labelledBy !== null) panel.setAttribute('aria-labelledby', labelledBy);
    }
    root.remove();
    strip.hidden = previousHidden;
  };
  try {
    for (const [index, { panel, marker }] of originals.entries()) {
      panel.before(marker);
      panel.removeAttribute('role');
      panel.removeAttribute('aria-labelledby');
      contents[index].append(panel);
    }
    root.addEventListener('valueChange', change);
    strip.after(root);
  // Keep the working native controls if a real Tabs owner fails to initialize.
  if (
    projectedList.getAttribute('role') !== 'tablist' ||
    !triggers.every((trigger) => trigger.getAttribute('role') === 'tab') ||
    !contents.every((content) => content.getAttribute('role') === 'tabpanel')
  ) {
    destroy();
    throw new Error('[CodeExample] Tabs projection did not initialize; native controls retained.');
  }
  // Do not steal a keyboard interaction already in progress during hydration.
  if (strip.contains(doc.activeElement)) {
    destroy();
    return { select() {}, destroy() {} };
  }
    if (hint && hintMarker) {
      hint.before(hintMarker);
      projectedList.after(hint);
    }
    strip.hidden = true;
    projectedList.addEventListener('focusin', onFocus);
    resize?.observe(projectedList);
    updateOverflow();
  } catch (error) {
    destroy();
    throw error;
  }
  return {
    select(index) {
      if (destroyed || index < 0 || index >= tabs.length) return;
      value = index;
      publishValue();
    },
    destroy,
  };
}
