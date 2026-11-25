import { PREFERRED_ADAPTER_KEY } from './adapter-preference-key';
import { headerButtonProps, headerIconButtonLayout } from './site-header-control-recipes';
import { bindSiteSelectDismissal } from './site-select-dismissal';
import { siteControlTags, type SiteLibraryFamily } from './site-library-family';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import bootstrapButton from '@proto.ui/prototypes-bootstrap-2-3-2/button';
import {
  selectContent as bootstrapSelectContent,
  selectGroup as bootstrapSelectGroup,
  selectSurface as bootstrapSelectSurface,
  selectViewport as bootstrapSelectViewport,
  selectItemText as bootstrapSelectItemText,
  selectItem as bootstrapSelectItem,
  selectRoot as bootstrapSelectRoot,
  selectTrigger as bootstrapSelectTrigger,
  selectValue as bootstrapSelectValue,
} from '@proto.ui/prototypes-bootstrap-2-3-2/select';
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
  selectGroup as shadcnSelectGroup,
  selectSurface as shadcnSelectSurface,
  selectViewport as shadcnSelectViewport,
  selectItemText as shadcnSelectItemText,
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
  ['wc-bootstrap-2-3-2-button', bootstrapButton],
  ['wc-bootstrap-2-3-2-select-root', bootstrapSelectRoot],
  ['wc-bootstrap-2-3-2-select-trigger', bootstrapSelectTrigger],
  ['wc-bootstrap-2-3-2-select-value', bootstrapSelectValue],
  ['wc-bootstrap-2-3-2-select-content', bootstrapSelectContent],
  ['wc-bootstrap-2-3-2-select-item', bootstrapSelectItem],
  ['wc-bootstrap-2-3-2-select-surface', bootstrapSelectSurface],
  ['wc-bootstrap-2-3-2-select-viewport', bootstrapSelectViewport],
  ['wc-bootstrap-2-3-2-select-group', bootstrapSelectGroup],
  ['wc-bootstrap-2-3-2-select-item-text', bootstrapSelectItemText],
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
  ['wc-shadcn-select-surface', shadcnSelectSurface],
  ['wc-shadcn-select-viewport', shadcnSelectViewport],
  ['wc-shadcn-select-group', shadcnSelectGroup],
  ['wc-shadcn-select-item-text', shadcnSelectItemText],
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

function siteControlFamily(element: HTMLElement): SiteLibraryFamily {
  if (element.localName.startsWith('wc-bootstrap-2-3-2-')) return 'bootstrap-2-3-2';
  return element.localName.startsWith('wc-brutalist-') ? 'brutalist' : 'shadcn';
}

export function supportsSiteSelectValue(root: SiteSelectRoot, value: string): boolean {
  const { SelectItem } = siteControlTags(siteControlFamily(root));
  return [...root.querySelectorAll<HTMLElement>(SelectItem)].some(
    (item) => item.dataset.value === value && item.closest('[data-site-select-root]') === root
  );
}

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
      currentTarget.matches('wc-shadcn-button, wc-brutalist-button, wc-bootstrap-2-3-2-button')
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
  // define upgrades all connected hosts. Seed adapter WeakMap props first so
  // the first mount consumes the same recipe as SSR, never Button defaults.
  document
    .querySelectorAll<HTMLElement>('wc-shadcn-button[data-site-shadcn-button], [data-site-button]')
    .forEach(initializeButton);
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
      minHeight: 'var(--site-control-height, 2.75rem)',
      paddingBlock: '0.25rem',
      ...(docsRuntime ? { height: 'auto' } : {}),
      fontFamily: 'inherit',
      fontSize: '0.875rem',
    };
  return headerIconButtonLayout();
}

function initializeButton(button: HTMLElement): void {
  const family = siteControlFamily(button);
  button.dataset.siteControlFamily = family;
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
  if (button.closest('[data-site-header]'))
    // Preserve the authored command purpose separately from the public family
    // size. Bootstrap maps the icon command to size=default, so feeding that
    // normalized output back into the recipe would lose its navbar context.
    Object.assign(
      props,
      headerButtonProps(family, button.dataset.headerButtonSize ?? button.dataset.size ?? 'icon')
    );
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

const nativeFallbackFocusLeases = new WeakMap<HTMLElement, () => void>();

/** Finish a reader's already-focused native navigation before changing its
 * activation semantics to a Select. The prepared Select stays out of layout
 * and the accessibility tree until that native interaction actually ends. */
function retainFocusedNativeSelectFallback(root: SiteSelectRoot): void {
  const fallback = root.nextElementSibling;
  const document = root.ownerDocument;
  if (
    !fallback?.matches('[data-site-select-fallback]') ||
    !fallback.contains(document.activeElement)
  ) {
    nativeFallbackFocusLeases.get(root)?.();
    return;
  }
  if (nativeFallbackFocusLeases.has(root)) return;
  root.dataset.siteSelectFallbackRetained = 'true';
  const release = () => {
    fallback.removeEventListener('focusout', onFocusOut);
    delete root.dataset.siteSelectFallbackRetained;
    nativeFallbackFocusLeases.delete(root);
  };
  const onFocusOut = (event: Event) => {
    const next = (event as FocusEvent).relatedTarget;
    if (next instanceof Node && fallback.contains(next)) return;
    // A Surface publication synchronously moves and restores the same native
    // node. Observe the completed focus transaction, never guess with a timer.
    queueMicrotask(() => {
      if (!fallback.isConnected || !fallback.contains(document.activeElement)) release();
    });
  };
  fallback.addEventListener('focusout', onFocusOut);
  nativeFallbackFocusLeases.set(root, release);
}

function initializeSelect(root: SiteSelectRoot): void {
  if (!customElements.get(root.localName)) return;
  retainFocusedNativeSelectFallback(root);
  const family = siteControlFamily(root);
  const { SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } =
    siteControlTags(family);
  root.dataset.siteControlFamily = family;
  const initialized = root.dataset.siteShadcnInitialized === '1';
  // The documentation Runtime selector owns enlarged-text reflow for its
  // Trigger, its Value, its popup rows and the popup's own height.
  const docsRuntime = !!root.closest('[data-docs-site-header] [data-adapter-select]');
  bindSiteSelectDismissal(root, (reason) => {
    const exposes = root.getExposes?.() as SelectCloseExposes | undefined;
    if (exposes?.open?.get?.() === true)
      exposes.requestOpen?.({ open: false, reason, focusReason: 'programmatic' });
  });
  if (!initialized) {
    // `data-value` is owned by the adapter's exposed-state projection, so it
    // is intentionally not used as an authoring input. Keep the SSR seed in a
    // separate data attribute that the runtime will not overwrite.
    let value = root.dataset.siteInitialValue ?? '';
    if (root.hasAttribute('data-adapter-select-root')) {
      try {
        const saved = root.ownerDocument.defaultView?.localStorage.getItem(PREFERRED_ADAPTER_KEY);
        if (saved && supportsSiteSelectValue(root, saved)) value = saved;
      } catch {
        /* A blocked preference store retains the declared default. */
      }
    }
    updateSelectProps(root, {
      value,
      disabled: root.dataset.disabled === 'true',
      closeOnSelect: true,
      ...(family === 'shadcn' && root.closest('[data-site-header]')
        ? { styleProfile: 'rhea' }
        : {}),
      ...(selectSurfaceStyle(root, 'root')
        ? { surfaceStyle: selectSurfaceStyle(root, 'root') }
        : {}),
    });
  }

  const trigger = root.querySelector<HTMLElement>(SelectTrigger);
  if (trigger) {
    applyProps(trigger, {
      size: trigger.dataset.size ?? 'default',
      ...(root.closest('[data-site-header]')
        ? {
            appearance: family === 'brutalist' ? (trigger.dataset.appearance ?? 'flat') : 'default',
            ...(family === 'shadcn' ? { styleProfile: 'rhea' } : {}),
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

  const valuePart = root.querySelector<HTMLElement>(SelectValue);
  if (valuePart) {
    applyProps(valuePart, {
      placeholder: valuePart.dataset.placeholder ?? '',
      ...(selectSurfaceStyle(valuePart, 'value')
        ? { surfaceStyle: selectSurfaceStyle(valuePart, 'value') }
        : {}),
    });
  }

  // A breakpoint can change while this same Content is portalled. Follow the
  // site's existing IDREF so the placement input follows its live owner too.
  const contentId = trigger?.getAttribute('aria-controls');
  const linkedContent = contentId ? root.ownerDocument.getElementById(contentId) : null;
  const content =
    root.querySelector<HTMLElement>(SelectContent) ??
    (linkedContent?.matches(`${SelectContent}[data-site-select-content]`) ? linkedContent : null);
  if (content) {
    // Portaled content needs its own family theme rather than root inheritance.
    content.dataset.siteControlFamily = family;
    applyProps(content, {
      // The compact Docs field permits multi-line values. Its longest option
      // can be taller than the selected Trigger, so use existing intrinsic
      // popper rows there. Wide chrome retains the family's item alignment.
      ...(docsRuntime && family === 'shadcn'
        ? {
            position:
              content.dataset.position ??
              (root.ownerDocument.defaultView?.matchMedia('(max-width: 47.999rem)').matches
                ? 'popper'
                : undefined),
          }
        : content.dataset.position
          ? { position: content.dataset.position }
          : {}),
      ...(content.dataset.align ? { align: content.dataset.align } : {}),
      // This consumer's popup owns a fixed, short option list. The family's
      // own height clamp would crop the rows that do not fit the current side
      // and, because the clamp is also what the placement reads as the
      // popup's height, it hides from the collision placement that the popup
      // no longer fits there. The popup is therefore measured at its natural
      // height, so the placement can move it to the side that has room and
      // every option stays reachable.
      ...(docsRuntime ? { surfaceStyle: { maxHeight: 'none' } } : {}),
    });
  }

  root.querySelectorAll<HTMLElement>(SelectItem).forEach((item) => {
    applyProps(item, {
      value: item.dataset.value ?? '',
      textValue: item.dataset.textValue ?? item.textContent?.trim() ?? '',
      disabled: item.dataset.disabled === 'true',
    });
  });

  if (docsRuntime) {
    // Compact popper rows can grow with enlarged Trigger/Value text. In wide
    // item alignment these labels must still fit the shared row box.
    root.querySelectorAll<HTMLElement>(SelectItemText).forEach((text) => {
      applyProps(text, {
        surfaceStyle: {
          minWidth: '0',
          flex: '1 1 auto',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
        },
      });
    });
  }

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
