import { bindSiteSelectDismissal } from './site-select-dismissal';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import brutalistButton from '@proto.ui/prototypes-brutalist/button';
import {
  selectContent as brutalistSelectContent,
  selectItem as brutalistSelectItem,
  selectRoot as brutalistSelectRoot,
  selectTrigger as brutalistSelectTrigger,
  selectValue as brutalistSelectValue,
} from '@proto.ui/prototypes-brutalist/select';
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
 * single place so every page uses the matching library projections and never
 * accidentally defines a second constructor for a preview element.
 */
const siteProjections = [
  ['wc-brutalist-button', brutalistButton],
  ['wc-brutalist-select-root', brutalistSelectRoot],
  ['wc-brutalist-select-trigger', brutalistSelectTrigger],
  ['wc-brutalist-select-value', brutalistSelectValue],
  ['wc-brutalist-select-content', brutalistSelectContent],
  ['wc-brutalist-select-item', brutalistSelectItem],
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
    !(
      currentTarget instanceof HTMLElement &&
      currentTarget.matches('wc-shadcn-button, wc-brutalist-button')
    ) || event instanceof CustomEvent
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

export function registerSiteControls(): void {
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

/** Header sizing is a consumer override through the adapter's normalized
 * surfaceStyle input, not an external selector competing with Proto styles. */
function headerSurfaceStyle(element: HTMLElement, kind: 'button' | 'root' | 'trigger' | 'value') {
  if (!element.closest('[data-site-header]')) return undefined;
  if (kind === 'root') return { width: '100%', minWidth: '0', maxWidth: '100%' };
  const docsRuntime = !!element.closest('[data-docs-site-header] [data-adapter-select]');
  if (kind === 'value')
    return {
      display: 'block',
      minWidth: '0',
      flex: '1 1 auto',
      overflow: docsRuntime ? 'visible' : 'hidden',
      textOverflow: docsRuntime ? 'clip' : 'ellipsis',
      whiteSpace: docsRuntime ? 'normal' : 'nowrap',
      ...(docsRuntime ? { overflowWrap: 'anywhere' } : {}),
    };
  if (kind === 'trigger')
    return {
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      minHeight: 'var(--site-select-control-height, var(--site-control-height, 2.75rem))',
      paddingBlock: 'var(--site-select-control-padding-block, 0.5rem)',
      ...(docsRuntime ? { height: 'auto' } : {}),
      fontFamily: 'inherit',
      fontSize: '0.875rem',
    };
  return {
    width: '2.75rem',
    height: '2.75rem',
    minHeight: '2.75rem',
    padding: '0',
    fontFamily: 'inherit',
  };
}

function initializeButton(button: HTMLElement): void {
  button.dataset.siteControlFamily = button.localName.includes('brutalist')
    ? 'brutalist'
    : 'shadcn';
  if (button.dataset.siteShadcnInitialized === '1') return;
  const props: Record<string, unknown> = {};
  if (button.dataset.variant) {
    // Family-specific public variants, never recolor a foreign Button.
    props.variant =
      button.localName === 'wc-brutalist-button' &&
      ['ghost', 'outline', 'secondary'].includes(button.dataset.variant)
        ? 'surface'
        : button.dataset.variant;
  }
  if (button.dataset.size) props.size = button.dataset.size;
  if (button.dataset.disabled === 'true') props.disabled = true;
  const surfaceStyle = headerSurfaceStyle(button, 'button');
  if (surfaceStyle) props.surfaceStyle = surfaceStyle;
  applyProps(button, props);
  button.dataset.siteShadcnInitialized = '1';
}

/** Local demo runtime fields can be narrower than their value at enlarged
 * text sizes. Bound only this existing consumer, through its public surface. */
function selectSurfaceStyle(element: HTMLElement, kind: 'root' | 'trigger' | 'value') {
  const header = headerSurfaceStyle(element, kind);
  if (header) return header;
  if (!element.closest('[data-adapter-select]')) return undefined;
  if (kind === 'value')
    return {
      display: 'block',
      minWidth: '0',
      flex: '1 1 auto',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      overflow: 'visible',
    };
  return {
    width: '100%',
    minWidth: '0',
    maxWidth: '100%',
    ...(kind === 'trigger' ? { height: 'auto' } : {}),
  };
}

function initializeSelect(root: SiteSelectRoot): void {
  const family = root.localName.includes('brutalist') ? 'brutalist' : 'shadcn';
  root.dataset.siteControlFamily = family;
  const initialized = root.dataset.siteShadcnInitialized === '1';
  bindSiteSelectDismissal(root, (reason) => {
    const exposes = root.getExposes?.() as SelectCloseExposes | undefined;
    if (exposes?.open?.get?.() === true)
      exposes.requestOpen?.({ open: false, reason, focusReason: 'programmatic' });
  });
  if (!initialized) {
    // `data-value` is owned by the adapter's exposed-state projection, so it
    // is intentionally not used as an authoring input. Keep the SSR seed in a
    // separate data attribute that the runtime will not overwrite.
    const value = root.dataset.siteInitialValue ?? '';
    updateSelectProps(root, {
      value,
      disabled: root.dataset.disabled === 'true',
      closeOnSelect: true,
      ...(selectSurfaceStyle(root, 'root')
        ? { surfaceStyle: selectSurfaceStyle(root, 'root') }
        : {}),
    });
  }

  const trigger = root.querySelector<HTMLElement>(
    'wc-shadcn-select-trigger, wc-brutalist-select-trigger'
  );
  if (trigger) {
    applyProps(trigger, {
      size: trigger.dataset.size ?? 'default',
      ...(root.closest('[data-site-header]')
        ? {
            appearance:
              family === 'brutalist'
                ? (trigger.dataset.appearance ?? 'flat')
                : (!!root.closest('[data-site-header-preferences]') ||
                      !root.closest('[data-site-header-panel]')) &&
                    !root.ownerDocument.defaultView?.matchMedia?.('(max-width: 47.999rem)').matches
                  ? 'ghost'
                  : 'default',
          }
        : {}),
      ...(family === 'brutalist' &&
      !root.closest('[data-site-header]') &&
      trigger.dataset.appearance
        ? { appearance: trigger.dataset.appearance }
        : {}),
      disabled: trigger.dataset.disabled === 'true',
      ...(selectSurfaceStyle(trigger, 'trigger')
        ? { surfaceStyle: selectSurfaceStyle(trigger, 'trigger') }
        : {}),
    });
  }

  const valuePart = root.querySelector<HTMLElement>(
    'wc-shadcn-select-value, wc-brutalist-select-value'
  );
  if (valuePart) {
    applyProps(valuePart, {
      placeholder: valuePart.dataset.placeholder ?? '',
      ...(selectSurfaceStyle(valuePart, 'value')
        ? { surfaceStyle: selectSurfaceStyle(valuePart, 'value') }
        : {}),
    });
  }

  const content = root.querySelector<HTMLElement>(
    'wc-shadcn-select-content, wc-brutalist-select-content'
  );
  if (content) {
    // Portaled content needs its own family theme rather than root inheritance.
    content.dataset.siteControlFamily = family;
    applyProps(content, {
      position: content.dataset.position ?? 'popper',
      align: content.dataset.align ?? 'start',
    });
  }

  root
    .querySelectorAll<HTMLElement>('wc-shadcn-select-item, wc-brutalist-select-item')
    .forEach((item) => {
      applyProps(item, {
        value: item.dataset.value ?? '',
        textValue: item.dataset.textValue ?? item.textContent?.trim() ?? '',
        disabled: item.dataset.disabled === 'true',
      });
    });

  closeSelectAfterValueChange(root);
  root.dataset.siteShadcnInitialized = '1';
}

/** Initialize only site-owned, actual family projections in a document. */
export function initSiteControls(root: ParentNode = document): void {
  registerSiteControls();

  if (
    root instanceof HTMLElement &&
    root.matches('wc-shadcn-button[data-site-shadcn-button], [data-site-button]')
  ) {
    initializeButton(root);
  }
  root
    .querySelectorAll<HTMLElement>('wc-shadcn-button[data-site-shadcn-button], [data-site-button]')
    .forEach(initializeButton);

  const selectRoots: SiteSelectRoot[] = [];
  if (root instanceof HTMLElement && root.matches('[data-site-select-root]')) {
    selectRoots.push(root as SiteSelectRoot);
  }
  root
    .querySelectorAll<SiteSelectRoot>('[data-site-select-root]')
    .forEach((select) => selectRoots.push(select));
  selectRoots.forEach(initializeSelect);
}

// Compatibility names for existing website consumers.
export const registerSiteShadcnControls = registerSiteControls;
export const initSiteShadcnControls = initSiteControls;
