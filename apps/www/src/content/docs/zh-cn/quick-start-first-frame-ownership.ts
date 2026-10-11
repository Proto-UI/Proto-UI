/** Self-contained browser predicate: Playwright serializes this function into
 * the real page. Startup evidence must wait for every owner under test. */
export function quickStartOwnershipReady(): boolean {
  const typography = document.querySelector('.doc-stage-notice__title');
  return !!(
    document.querySelector('[data-docs-site-header]')?.hasAttribute('data-site-menu-ready') &&
    document
      .querySelector('[data-site-code-surface="frame"]')
      ?.getAttribute('data-code-surface-view') === 'ready' &&
    typography?.getAttribute('data-typography-runtime') === 'react' &&
    typography.getAttribute('data-typography-owner') === 'documentation-typography'
  );
}
