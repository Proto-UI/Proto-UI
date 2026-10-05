/** Self-contained, read-only page probe serialized by Playwright. */
export function readReadingReflow() {
  const boxes = Object.fromEntries(
    [
      '.docs-reading-columns',
      '.docs-sidebar',
      '.right-sidebar-container',
      '.right-sidebar',
      '.right-sidebar-panel .sl-container',
      '.right-sidebar-panel sl-toc',
      '.right-sidebar-panel nav',
      '.main-pane',
      '[data-docs-site-header]',
    ].map((selector) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      const style = getComputedStyle(element);
      return [
        selector,
        {
          ...element.getBoundingClientRect().toJSON(),
          display: style.display,
          widthStyle: style.width,
          flex: style.flex,
          alignItems: style.alignItems,
          alignSelf: style.alignSelf,
        },
      ];
    })
  );
  return {
    rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
    viewportWidth: innerWidth,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    boxes,
    visibleTocLinks: [...document.querySelectorAll<HTMLElement>('.right-sidebar-panel sl-toc a')]
      .filter((link) => link.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
      .map((link) => ({
        label: link.textContent?.trim(),
        ...link.getBoundingClientRect().toJSON(),
      })),
    controls: [
      '.site-header-brand',
      '.site-header-search',
      '.site-header-theme',
      '.site-header-menu',
    ].map((selector) => ({
      selector,
      ...document.querySelector<HTMLElement>(selector)!.getBoundingClientRect().toJSON(),
    })),
  };
}
