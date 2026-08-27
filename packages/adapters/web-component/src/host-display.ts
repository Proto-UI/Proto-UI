import { installViewVisibilityRule, PUI_VIEW_DETACHED_ATTR } from '@proto.ui/adapter-base';

const HOST_DISPLAY_STYLE_ID = 'proto-ui-wc-host-display';
const HOST_DISPLAY_CLASS = 'pui-host-root';
const PUI_STYLE_ATTR = 'data-pui-style';

export { PUI_VIEW_DETACHED_ATTR };

const RULES_BY_DOCUMENT = new WeakMap<Document, boolean>();

const DISPLAY_TOKENS = new Set([
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'contents',
  'hidden',
  'table',
  'inline-table',
  'table-caption',
  'table-cell',
  'table-column',
  'table-column-group',
  'table-footer-group',
  'table-header-group',
  'table-row-group',
  'table-row',
  'flow-root',
  'list-item',
]);

export type HostDisplayController = {
  sync(): void;
  disconnect(): void;
};

export function installDefaultHostDisplay(el: HTMLElement): HostDisplayController {
  const doc = el.ownerDocument;
  if (doc) ensureDefaultHostDisplayRule(doc);

  const sync = () => {
    if (hasExplicitDisplayClass(el)) {
      el.classList.remove(HOST_DISPLAY_CLASS);
      return;
    }
    el.classList.add(HOST_DISPLAY_CLASS);
  };

  sync();

  return {
    sync,
    disconnect() {
      el.classList.remove(HOST_DISPLAY_CLASS);
    },
  };
}

function ensureDefaultHostDisplayRule(doc: Document) {
  if (RULES_BY_DOCUMENT.get(doc)) return;

  installViewVisibilityRule(doc);

  const styleEl = getOrCreateStyleElement(doc);
  styleEl.textContent = `${styleEl.textContent ?? ''}\n:where(.${HOST_DISPLAY_CLASS}) { display: block; }\n`;
  RULES_BY_DOCUMENT.set(doc, true);
}

function hasExplicitDisplayClass(el: HTMLElement): boolean {
  for (const token of Array.from(el.classList)) {
    if (token === HOST_DISPLAY_CLASS) continue;
    if (isDisplayUtilityClass(token)) return true;
  }
  for (const token of (el.getAttribute(PUI_STYLE_ATTR) ?? '').split(/\s+/)) {
    if (token && isDisplayUtilityClass(token)) return true;
  }
  return false;
}

function isDisplayUtilityClass(token: string): boolean {
  const normalized = token.split(':').pop()?.replace(/^!/, '') ?? token;
  return DISPLAY_TOKENS.has(normalized);
}

function getOrCreateStyleElement(doc: Document): HTMLStyleElement {
  const existing = doc.getElementById(HOST_DISPLAY_STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;

  const styleEl = doc.createElement('style');
  styleEl.id = HOST_DISPLAY_STYLE_ID;
  styleEl.setAttribute('data-proto-ui-wc-host-display', '');

  const parent = doc.head ?? doc.documentElement ?? doc.body;
  parent?.appendChild(styleEl);

  return styleEl;
}
