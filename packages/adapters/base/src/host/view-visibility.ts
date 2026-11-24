export const PUI_VIEW_PENDING_ATTR = 'data-pui-view-pending';
export const PUI_VIEW_REVEALING_ATTR = 'data-pui-view-revealing';
export const PUI_VIEW_DETACHED_ATTR = 'data-pui-view-detached';
/** Private first-render portal guard shared by its owner and presentation reader. */
export const PUI_PORTAL_PREPARING_ATTR = 'data-pui-portal-preparing';

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

  // The reveal guard suppresses transitions from the unpublished host style.
  // An explicitly bound Presence or a fresh portal can keep authored keyframes.
  styleEl.textContent = `${styleEl.textContent ?? ''}
:where([${PUI_VIEW_PENDING_ATTR}]) { visibility: hidden !important; }
:where([${PUI_VIEW_PENDING_ATTR}], [${PUI_VIEW_REVEALING_ATTR}]) { transition: none !important; }
:where([${PUI_VIEW_PENDING_ATTR}], [${PUI_VIEW_REVEALING_ATTR}]:not([${PUI_VIEW_REVEALING_ATTR}="presence"], [${PUI_VIEW_REVEALING_ATTR}="portal"])) { animation: none !important; }
:where([${PUI_VIEW_DETACHED_ATTR}]) { display: none !important; }
`;
  RULES_BY_DOCUMENT.set(doc, true);
}
