# Native typography browser acceptance packet

This bounded evidence change follows the current #777/#803 request and the experimental ownership recorded in `2026-10-03-website-typography-projection.md`. It does not add a public Base Typography contract or change a production typography recipe.

## Real browser plan

`site-typography.browser.test.ts` registers 30 independently named cases: eight runtime/family native-source cases, sixteen real-homepage locale/runtime/family cases, two actual documentation scope cases, and four no-JavaScript/initial-module-failure cases. Each homepage case attempts all four combinations of 320/390 CSS-pixel viewport and 100/200% root text resize. A viewport assertion failure retains its frame and proceeds to the next observation. This is text resize evidence, not browser toolbar zoom evidence. The isolated Actions process has an 840-second deadline, plus bounded cleanup; tests have explicit 90/120/180-second bounds.

The noindex fixture adds authored native headings, paragraphs, emphasis, labels, inputs, fieldset/legend, and a local anchor. It imports the actual global stylesheet and existing documentation typography owner. It has no test Prototype, renderer replacement, text paint CSS or forged generated owner attributes. A parser-time inline script retains the actual original SSR nodes before the real module executes. Tests compare their identity, text-node count, original text, semantic tag, legal phrasing wrapper, and real PUI surface after materialization and replacement.

Label pointer activation must focus its original input. Chromium's accessibility tree must expose the label-derived textbox name and legend-derived group name. Real mouse triple-click selection and keyboard Copy must produce the original mixed Latin/CJK text. Separately, explicitly injected backward native Selection and global preference events isolate source-range preservation from the selection caused by operating another control. The same source endpoints and copied text must survive a real runtime replacement. Only the isolated test BrowserContext gets clipboard permission.

Both families and all four runtimes record actual `CSS.getPlatformFontsForNode` data. Glyph counts must be nonzero; Brutalist Latin must use the custom DM Sans face; CJK must use a non-DM-Sans font and must not attribute its glyphs to DM Sans. Computed font stacks are additional observations, never glyph evidence. Hosted Actions installs the official Ubuntu CJK font package and records package/browser versions.

Real homepage journeys preserve the exact Chinese and English slogan/tagline and require same page/typography generation, size hierarchy, actual style tokens and no document/body horizontal overflow. Actual documentation routes follow the global runtime while an individual demonstration changes independently. No-JavaScript and failed-initial-module journeys require original text, visible heading/body hierarchy, native link activation and native label activation where present.

The Hero fallback currently has source-level support from Starlight's default `main[data-pagefind-body]` and the existing Markdown heading rules. Its real no-JavaScript/failed-module computed hierarchy is an acceptance assertion, not a source-derived passed result. No fallback skin was added here.

## Provenance and inventory

Reports keep `actualGitHead`, caller-supplied `expectedHead`, and Actions `eventSha` in separate fields. The dedicated workflow checks out and requires the PR head, not the synthetic merge. Main CI may run the registered suite on its actual merge checkout and records that honestly. Generated frames and complete Playwright traces are separate artifacts; failed captures and error messages remain in the measured manifest.

The suite is registered once in `scripts/test/runtime-test-plan.mjs`, excluded from general unit execution, and assigned once by the unchanged eight-shard allocator. Shared CI includes its diagnostics beneath that shard's retained evidence directory. Its original run may therefore be audited independently of the optional focused evidence workflow.

## Execution boundary

No local browser, socket, dev server, full build, or heavyweight type check was started while preparing this packet. Socket-free TypeScript collection, workflow parsing, exact browser inventory and existing runtime-plan contract tests are available locally. Actual browser behavior, rendered screenshots, clipboard operation, fonts and hosted timing remain unverified until the exact integrated candidate runs in Actions. Preserve any first-run failure rather than replacing it with a source-only pass.
