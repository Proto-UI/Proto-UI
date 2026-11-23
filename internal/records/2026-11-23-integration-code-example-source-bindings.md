# Combined CodeExample and CodePanel source bindings

## Reviewed source

This source-only reconciliation renews exactly two current Website fingerprints during the seven-Sprint integration. It retains every existing owning row, row disposition and raw-import boundary. The original source reviews remain readable in [the Sprint 3 website record](2026-11-22-sprint3-website-current-source.md) and [the install source-binding record](2026-11-22-sprint3-install-source-bindings.md).

| Source | Recovered previously bound SHA-256 | Current formatted SHA-256 |
| --- | --- | --- |
| `apps/www/src/components/CodeExample.astro` | `c6c30f5a00e1ccb858017b67a452c476590ec632a3b85ac866b3106ddbe70db8` | `991f8c3bd93c21eaee831b98876389b77d58331b5dd68cd8bf186857958c4851` |
| `apps/www/src/components/PrototypePreviewer/CodePanel.astro` | `f25f1b0ccd7faf348e2b32d8a3230d60c07c773ad981882c158ab8bb590edb30` | `4b69ff8ca48e9d55ef0988207857a862dfc9be207ebb8f4f563c50979ff28462` |

The CodeExample baseline is the exact Git body at `118cb52100e321efda2cd7497f75e24bef537cc0`, also present at the Sprint 3 merge base `39ca4f7729cde9a3ebb3abfd4fd987d9db57e4de`. Its SHA reproduces the previous matrix binding. The incoming Sprint 3 body at `cb26aa7541862bea056d705f383bef4d15f99a67` has SHA `ee411c8095f9be0dc5bc9877e10496b907b5d219286aba21b9190e979d23463a`; its locale additions had not renewed that old matrix fingerprint. The CodePanel baseline is the exact already-bound Sprint 3 body at `cb26aa7541862bea056d705f383bef4d15f99a67`.

## Complete deltas

CodeExample selects its default labels from the existing `/zh-cn/` route convention, including the default accessible container name, Host navigation name and Files label. Explicit authored labels still take precedence. Supported/pending-host checks, the selected host, stable IDs, native links, scripted acquisition and cleanup, and the no-JavaScript source exposure remain in their existing owners.

The normal repository formatter expands the two Astro files' object literals, attributes and CSS declarations, adds equivalent expression parentheses, and standardizes literal quoting. Property values, selectors, CSS declarations and script imports remain unchanged by formatting. Template whitespace and formatted source bytes are different; the new hashes describe those actual bytes. CodePanel keeps its existing SSR-expanded source, progressively owned disclosure, localized names, scrollable title and focus styling.

The complete retained owner sets are `www.docs.code-example-file-tabs`, `www.docs.code-example-host-tabs` and `www.docs.code-surface` for CodeExample, and `www.demo.code-panel`, `www.docs.code-panel-copy`, `www.docs.code-panel-expand` and `www.docs.code-surface` for CodePanel. No additional source is admitted by this reconciliation.

## Evidence boundary

The exact original Git bodies and before/after formatter inputs are retained with the integration source-review packet. Existing browser captures and test receipts keep their original source identities. Current native, no-JavaScript, keyboard and visual acceptance must use the final combined candidate and the original assertions; renewing these fingerprints supplies source review only.
