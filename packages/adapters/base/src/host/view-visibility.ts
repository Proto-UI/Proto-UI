export const PUI_VIEW_PENDING_ATTR = 'data-pui-view-pending';
export const PUI_VIEW_REVEALING_ATTR = 'data-pui-view-revealing';
export const PUI_VIEW_DETACHED_ATTR = 'data-pui-view-detached';

const VIEW_VISIBILITY_STYLE_ID = 'proto-ui-view-visibility';
const RULES_BY_DOCUMENT = new WeakMap<Document, boolean>();

export function installViewVisibilityRule(doc: Document): void {
  if (RULES_BY_DOCUMENT.get(doc)) return;

  let styleEl = doc.getElementById(VIEW_VISIBILITY_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = VIEW_VISIBILITY_STYLE_ID;
    (doc.head ?? doc.documentElement).appendChild(styleEl);
  }

  styleEl.textContent = `${styleEl.textContent ?? ''}\n:where([${PUI_VIEW_PENDING_ATTR}]) { visibility: hidden !important; }\n:where([${PUI_VIEW_PENDING_ATTR}], [${PUI_VIEW_REVEALING_ATTR}]) { transition: none !important; animation: none !important; }\n:where([${PUI_VIEW_DETACHED_ATTR}]) { display: none !important; }\n`;
  RULES_BY_DOCUMENT.set(doc, true);
}
