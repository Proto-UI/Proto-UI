# Generic preview post-render shell preparation cleanup

This bounded repair addresses #777 review thread `4184647347` on exact `c4b6be34b67dc79cad3dd047aeb6f6e59cb5dd65`. It does not modify fixed-family projected previewers, renderer implementations, public prototypes, user copy or readiness budgets.

## Reproduction and boundary

A generic preview can finish `renderDemo` while its latest page-family preparation still has to run. The former `try/catch` owned only the first `surface.ready`; a later theme-resolution throw or `setAppearance` rejection escaped before `currentDemo` was assigned. Clearing `host.innerHTML` in the outer error handler did not invoke the renderer's resource cleanup.

A controlled regression uses actual installed WC/React/Vue/Vue2 adapters, the real demo renderer, real RuntimeBox/passive shell and host-mount leases. Only framework CDN acquisition is replaced with the installed framework, and a bounded wrapper pauses return after the real renderer commits. A real demo setup installs a window listener with a cleanup. The page-family attribute changes from Shadcn to Brutalist during that pause; either theme resolution or the actual Surface-module-load boundary rejects before publication. These are fault-injection host-unit tests, not captured browser/network outages.

All eight cases reached the intended error view on the old source. Observed `result.destroy` count and setup-cleanup count were both zero; the listener responded again behind the error page (count 1 to 2). The previewer's current runtime was null and no successful runtime publication occurred. Early fixture attempts lacked complete scoped Shadcn CSS inputs and never reached the renderer; they are not counted as reproduction evidence. The final fixture seeds the declared theme inputs on its own root.

## Minimal fix

Keep latest-family resolution and the awaited Surface update inside the same pre-publication cleanup boundary as `surface.ready`. A stale or destroyed request skips that preparation, then follows the existing destroy-and-return path. A preparation failure invokes the renderer destroy before the existing outer error view. Current-version guards and the publication point remain unchanged.

The eight original regressions pass after the fix: destroy and setup cleanup each run once, the listener no longer responds, framework/shell markup is retired, and later terminal previewer destroy does not repeat cleanup. Existing previewer and runtime-surface suites are retained. This record does not claim browser, full-repository CI or formal GitHub approval; those are separate exact-head checks.

Co-author by OpenAI Dots
