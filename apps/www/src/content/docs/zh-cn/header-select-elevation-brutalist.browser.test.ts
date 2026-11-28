// @vitest-environment node
(globalThis as { __PUI_HEADER_SELECT_DELEGATED__?: boolean }).__PUI_HEADER_SELECT_DELEGATED__ =
  true;
const { registerHeaderSelectElevationSuite } =
  await import('./header-select-elevation.browser.test');

registerHeaderSelectElevationSuite({
  families: ['brutalist'],
  includeStartupAndResize: false,
});

export {};
