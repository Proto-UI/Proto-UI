import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import shadcnButton from '@proto.ui/prototypes-shadcn/button';
import {
  selectContent as shadcnSelectContent,
  selectItem as shadcnSelectItem,
  selectRoot as shadcnSelectRoot,
  selectTrigger as shadcnSelectTrigger,
  selectValue as shadcnSelectValue,
} from '@proto.ui/prototypes-shadcn/select';

/**
 * Site chrome is part of the Proto UI dogfood surface. Keep registration in a
 * single place so every page uses the same Shadcn projections and never
 * accidentally defines a second constructor for a preview element.
 */
const siteProjections = [
  ['wc-shadcn-button', shadcnButton],
  ['wc-shadcn-select-root', shadcnSelectRoot],
  ['wc-shadcn-select-trigger', shadcnSelectTrigger],
  ['wc-shadcn-select-value', shadcnSelectValue],
  ['wc-shadcn-select-content', shadcnSelectContent],
  ['wc-shadcn-select-item', shadcnSelectItem],
] as const;

export type SiteSelectExposes = {
  [key: string]: unknown;
  open?: { get?: () => unknown };
  value?: { get?: () => unknown };
};

export type SiteSelectRoot = HTMLElement & {
  getExposes?: () => SiteSelectExposes;
  setProps?: (props: Record<string, unknown>) => void;
};

const siteSelectProps = new WeakMap<SiteSelectRoot, Record<string, unknown>>();
const pendingSelectReplays = new WeakSet<SiteSelectRoot>();

/**
 * Projected Button hosts receive the browser's native `MouseEvent` and then
 * the Button protocol's outward `CustomEvent("click")`. Site consumers own
 * the outward signal, while native buttons retain their ordinary click path.
 */
export function isSiteButtonActivation(event: Event): boolean {
  const currentTarget = event.currentTarget;
  return (
    !(currentTarget instanceof HTMLElement && currentTarget.localName === 'wc-shadcn-button') ||
    event instanceof CustomEvent
  );
}

type SelectValueChangeDetail = {
  reason?: unknown;
};

type SelectCloseExposes = {
  open?: { get?: () => unknown };
  requestOpen?: (request: {
    open: false;
    reason: string;
    focusReason: 'programmatic' | 'keyboard' | 'pointer';
  }) => unknown;
};

function closeSelectAfterValueChange(root: SiteSelectRoot): void {
  if (root.dataset.siteShadcnCloseOnSelectInitialized === '1') return;
  root.dataset.siteShadcnCloseOnSelectInitialized = '1';

  root.addEventListener('valueChange', (event: Event) => {
    const detail = (event as CustomEvent<SelectValueChangeDetail>).detail;
    const focusReason =
      detail?.reason === 'keyboard' || detail?.reason === 'pointer'
        ? detail.reason
        : 'programmatic';

    // Select content is portaled out of the root. The item can therefore
    // commit a value before the root's anatomy lookup sees the close request.
    // Submit the public request synchronously while the root is still enabled:
    // site-owned valueChange listeners may disable the Select before a queued
    // close could be accepted.
    if (!root.isConnected) return;
    const exposes = root.getExposes?.() as SelectCloseExposes | undefined;
    if (exposes?.open?.get?.() !== true) return;
    exposes.requestOpen?.({ open: false, reason: 'item.select', focusReason });
  });
}

export function registerSiteShadcnControls(): void {
  for (const [tagName, prototype] of siteProjections) {
    if (customElements.get(tagName)) continue;
    const constructor = AdaptToWebComponent(prototype, {
      register: false,
      registerAs: tagName,
    });
    customElements.define(tagName, constructor);
  }
}

export function selectValue(root: SiteSelectRoot): string {
  const state = root.getExposes?.().value as { get?: () => unknown } | undefined;
  const value = state?.get?.();
  return typeof value === 'string' ? value : '';
}

function updateSelectProps(root: SiteSelectRoot, props: Record<string, unknown>): void {
  const nextProps = { ...siteSelectProps.get(root), ...props };
  siteSelectProps.set(root, nextProps);
  setElementProps(root, nextProps);
  if (pendingSelectReplays.has(root)) return;
  pendingSelectReplays.add(root);
  // Resolve the latest merged bag when the replay runs. Value and disabled
  // are commonly updated in the same turn while a preview remount locks the
  // control, and the adapter's setProps replaces rather than merges raw props.
  queueMicrotask(() => {
    pendingSelectReplays.delete(root);
    const currentProps = siteSelectProps.get(root);
    if (currentProps) root.setProps?.(currentProps);
  });
}

export function setSelectValue(root: SiteSelectRoot, value: string): void {
  updateSelectProps(root, { value });
}

export function setSiteSelectDisabled(root: SiteSelectRoot, disabled: boolean): void {
  updateSelectProps(root, { disabled });
}

function applyProps(element: HTMLElement, props: Record<string, unknown>): void {
  setElementProps(element, props);
  // Astro can execute a page script in the same turn as custom-element
  // upgrade. Replay through the live controller once connected so style and
  // state props are never lost during that upgrade boundary.
  queueMicrotask(() => (element as SiteSelectRoot).setProps?.(props));
}

function initializeButton(button: HTMLElement): void {
  if (button.dataset.siteShadcnInitialized === '1') return;
  const props: Record<string, unknown> = {};
  if (button.dataset.variant) props.variant = button.dataset.variant;
  if (button.dataset.size) props.size = button.dataset.size;
  if (button.dataset.disabled === 'true') props.disabled = true;
  applyProps(button, props);
  button.dataset.siteShadcnInitialized = '1';
}

function initializeSelect(root: SiteSelectRoot): void {
  const initialized = root.dataset.siteShadcnInitialized === '1';
  if (!initialized) {
    // `data-value` is owned by the adapter's exposed-state projection, so it
    // is intentionally not used as an authoring input. Keep the SSR seed in a
    // separate data attribute that the runtime will not overwrite.
    const value = root.dataset.siteInitialValue ?? '';
    updateSelectProps(root, {
      value,
      disabled: root.dataset.disabled === 'true',
      closeOnSelect: true,
    });
  }

  const trigger = root.querySelector<HTMLElement>('wc-shadcn-select-trigger');
  if (trigger) {
    applyProps(trigger, {
      size: trigger.dataset.size ?? 'default',
      disabled: trigger.dataset.disabled === 'true',
    });
  }

  const valuePart = root.querySelector<HTMLElement>('wc-shadcn-select-value');
  if (valuePart) applyProps(valuePart, { placeholder: valuePart.dataset.placeholder ?? '' });

  const content = root.querySelector<HTMLElement>('wc-shadcn-select-content');
  if (content) {
    applyProps(content, {
      position: content.dataset.position ?? 'popper',
      align: content.dataset.align ?? 'start',
    });
  }

  root.querySelectorAll<HTMLElement>('wc-shadcn-select-item').forEach((item) => {
    applyProps(item, {
      value: item.dataset.value ?? '',
      textValue: item.dataset.textValue ?? item.textContent?.trim() ?? '',
      disabled: item.dataset.disabled === 'true',
    });
  });

  closeSelectAfterValueChange(root);
  root.dataset.siteShadcnInitialized = '1';
}

/** Initialize all site-owned Shadcn projections in a document. */
export function initSiteShadcnControls(root: ParentNode = document): void {
  registerSiteShadcnControls();

  if (root instanceof HTMLElement && root.matches('wc-shadcn-button[data-site-shadcn-button]')) {
    initializeButton(root);
  }
  root
    .querySelectorAll<HTMLElement>('wc-shadcn-button[data-site-shadcn-button]')
    .forEach(initializeButton);

  const selectRoots: SiteSelectRoot[] = [];
  if (root instanceof HTMLElement && root.matches('wc-shadcn-select-root[data-site-select-root]')) {
    selectRoots.push(root as SiteSelectRoot);
  }
  root
    .querySelectorAll<SiteSelectRoot>('wc-shadcn-select-root[data-site-select-root]')
    .forEach((select) => selectRoots.push(select));
  selectRoots.forEach(initializeSelect);
}
