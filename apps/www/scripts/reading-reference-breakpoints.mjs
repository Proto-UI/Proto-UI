import { READING_ROUTES, observationFailures } from './reading-reference-contract.mjs';

// Default-root boundary cases and enlarged-text controls are separate evidence.
// No 200% result can satisfy a normal 1279/1280/1281 assertion.
export const READING_BREAKPOINT_CASES = Object.freeze(
  READING_ROUTES.flatMap((route) =>
    ['light', 'dark'].flatMap((colorScheme) =>
      [
        ...[1279, 1280, 1281].map((width) => ({ width, textPercent: 100, stressOnly: false })),
        { width: 1440, textPercent: 200, stressOnly: true },
      ].map(({ width, textPercent, stressOnly }) =>
        Object.freeze({
          ...route,
          colorScheme,
          textPercent,
          stressOnly,
          viewport: Object.freeze({ width, height: 757 }),
          id: `${route.id}-${colorScheme}-${stressOnly ? 'stress' : 'normal'}-${width}-text${textPercent}`,
        })
      )
    )
  )
);

/** Self-contained, read-only browser callback. Content-box width is the CQ input. */
export function collectReadingBreakpoint() {
  const boxes = Object.fromEntries(
    [
      '.docs-shell',
      '.docs-reading-columns',
      '.right-sidebar-container',
      '.right-sidebar',
      '.right-sidebar-panel .sl-container',
      '.right-sidebar-panel sl-toc',
      '.right-sidebar-panel nav',
      '.main-pane',
    ].map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return [selector, null];
      const style = getComputedStyle(element);
      return [
        selector,
        {
          ...element.getBoundingClientRect().toJSON(),
          visible: element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
          display: style.display,
          position: style.position,
          flexDirection: style.flexDirection,
          order: style.order,
          widthStyle: style.width,
          maxWidth: style.maxWidth,
          boxSizing: style.boxSizing,
          paddingLeft: parseFloat(style.paddingLeft),
          paddingRight: parseFloat(style.paddingRight),
          borderLeftWidth: parseFloat(style.borderLeftWidth),
          borderRightWidth: parseFloat(style.borderRightWidth),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          containerName: style.containerName,
          containerType: style.containerType,
        },
      ];
    })
  );
  const shell = boxes['.docs-shell'];
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const contentWidth = shell
    ? shell.width -
      shell.borderLeftWidth -
      shell.borderRightWidth -
      shell.paddingLeft -
      shell.paddingRight
    : null;
  return {
    rootFontSize,
    rootInlineFontSize: document.documentElement.style.fontSize,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollbarWidth: innerWidth - document.documentElement.clientWidth,
    scrollY,
    desktopMediaMatches: matchMedia('(min-width: 80rem)').matches,
    docsCanvasContentWidth: contentWidth,
    // Derived diagnostic, not a claim that the browser's CQ matched.
    derivedCanvasAtMost80RootRem: contentWidth !== null && contentWidth <= 80 * rootFontSize,
    boxes,
  };
}

export function readingBreakpointFailures(observation, breakpoint, reflow, target) {
  const failures = observationFailures(observation, target, target.viewport);
  if (breakpoint.rootFontSize !== (16 * target.textPercent) / 100)
    failures.push(
      `Expected actual ${target.textPercent}% root text, observed ${breakpoint.rootFontSize}px.`
    );
  if (!target.stressOnly && breakpoint.rootInlineFontSize !== '')
    failures.push('Normal boundary must use the untouched default root font size.');
  if (
    breakpoint.viewportWidth !== target.viewport.width ||
    breakpoint.viewportHeight !== target.viewport.height
  )
    failures.push('Breakpoint geometry was not collected at the requested viewport.');
  if (breakpoint.scrollY !== 0)
    failures.push('Initial breakpoint capture must be at the document top.');
  for (const [selector, box] of Object.entries(breakpoint.boxes))
    if (!box) failures.push(`Missing actual reading owner: ${selector}`);
  if (failures.length) return failures;
  const columns = breakpoint.boxes['.docs-reading-columns'];
  const toc = breakpoint.boxes['.right-sidebar-container'];
  const actualToc = breakpoint.boxes['.right-sidebar-panel sl-toc'];
  const article = breakpoint.boxes['.main-pane'];
  if (reflow.overflow > 0) failures.push('Reading layout overflows the viewport.');
  if (!target.stressOnly) {
    if (target.viewport.width < 1280) {
      if (toc.visible || actualToc.visible || reflow.visibleTocLinks.length)
        failures.push('Normal 1279px must retain the existing hidden desktop TOC.');
    } else {
      if (!toc.visible || !actualToc.visible || !reflow.visibleTocLinks.length)
        failures.push('Normal desktop boundary must paint the actual native TOC.');
      if (columns.flexDirection === 'column' || toc.position === 'static' || toc.order !== '2')
        failures.push('Normal desktop boundary unexpectedly activates stacked TOC reflow.');
      if (actualToc.left < article.right - 1)
        failures.push('Normal desktop TOC must remain beside the article, not above it.');
    }
  } else {
    if (!actualToc.visible || !reflow.visibleTocLinks.length || columns.flexDirection !== 'column')
      failures.push('Enlarged-text control must reflow the same visible native TOC.');
    if (actualToc.width < 12 * breakpoint.rootFontSize)
      failures.push('Enlarged actual TOC is narrower than the existing 12rem reading minimum.');
    for (const link of reflow.visibleTocLinks)
      if (link.width < 10 * breakpoint.rootFontSize)
        failures.push(`Enlarged TOC link is fragmented: ${link.label}`);
    for (const control of reflow.controls)
      if (
        control.width <= 0 ||
        control.height <= 0 ||
        control.left < 0 ||
        control.right > breakpoint.viewportWidth
      )
        failures.push(`Enlarged Header control is not reachable: ${control.selector}`);
  }
  return failures;
}
