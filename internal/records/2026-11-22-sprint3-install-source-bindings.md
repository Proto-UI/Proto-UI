# Sprint 3 installation source bindings

The source-specific ordinary-test result for `830287f95959a4a1a4fb797df68b0bd6889e0bae` is retained in [Full CI run 45018250847](https://github.com/Proto-UI/Proto-UI/actions/runs/45018250847), general artifact [14754771978](https://github.com/Proto-UI/Proto-UI/actions/runs/45018250847/artifacts/14754771978). The downloaded ZIP is 10,416,729 bytes, SHA-256 `299e24e530352ea62aa80d771357ec9817d00ca9c95b113d917e484887464ba7`. Its before/after receipt confirms clean source and tree `f7b2851e7e6fa6b7d9e64fd1e687d316a4c51644`. It reports 17 coverage-matrix findings and a separate failed no-JS source-reader assertion. Those original results remain unchanged.

## Exact source and responsibility

The prior matrix fingerprints for InstallCommandCard and CodePanel are recovered exactly from `dc3b184ba10b0de53e40359c52d012b204b2cd01`. Their complete changes to the published `830287f` source were reviewed. Both files and the extracted client are byte-identical between `830287f` and integration `5f9371510cac145bd5d40d8a5c6c76853494f4c2`, before this binding repair.

| Source | Original SHA-256 | Reviewed current SHA-256 |
| --- | --- | --- |
| `apps/www/src/components/InstallCommandCard.astro` | `549885c121d579a41e0a5d28aa3a6bfc9032f73f004fc94d7431648e96f3e23d` | `05c9324e9bb8a39e6ec6772d205c9823258d86638887c0e8b903f762cd887de7` |
| `apps/www/src/components/PrototypePreviewer/CodePanel.astro` | `1f3da9d3b811eaeeef624541cec3523827b2265bb2d30a175e0d1e9a57f70497` | `f25f1b0ccd7faf348e2b32d8a3230d60c07c773ad981882c158ab8bb590edb30` |
| `apps/www/src/components/install-command-card-client.ts` | Absent at the original baseline | `dd644892e2650c8c6978c8b5707692ace5cc68d680acf940ef65d3483aa8fb64` |

InstallCommandCard localizes the manager, Copy and command labels, exposes all authored command alternatives in the no-JS fallback, and delegates its existing selection effect to the extracted client. The client retains the public Web Component `setElementProps` import, observes the existing site Button activation protocol, and owns selected manager, pressed state and panel visibility. It fences retired cards, uses a WeakMap to prevent duplicate initialization, and removes its listeners and observer on disconnection or Astro navigation. The Astro page-load listener initializes new cards. Clipboard effects remain with the existing Copy owners.

CodePanel keeps source expanded before enhancement, hides the inactive disclosure control until its client owns visibility, localizes the disclosure and Copy names, and preserves the separate expansion, passive framing and clipboard owners. These are the already reviewed consumer changes; this repair adds no product behavior.

The raw Adapter allowance moves from the obsolete Astro importer to the extracted client and is now pinned to the client's entire reviewed SHA-256. It permits only `@proto.ui/adapter-web-component`. A sibling path, changed importer bytes or a different runtime import remains rejected. The client is directly named in the existing `www.docs.install-manager-tabs` row and source-scan table. That row stays **blocked**; selection-pattern authority, draft status, keyboard and native acceptance remain unchanged. The two Astro fingerprints are updated without touching unrelated source rows.

Five of the original 17 findings concern these exact responsibilities: two stale Astro fingerprints, the client's missing raw-import admission, source-scan binding and row binding. The other twelve original findings concern Liquid hover imports/source, Liquid Select, CodeExample and previewer-bootstrap. They are retained under their existing owners; no mass fingerprint refresh or new scope exception is applied.

## Discriminating checks and retained incomplete validation

The new client import-boundary case first ran against the old policy and failed at its intended positive admission assertion. After the bounded policy change it passed, including its existing copied-path, changed-bytes and foreign-runtime rejections. Only that selected case executed; it is not a claim about the entire coverage checker test file.

The original no-JS test assumed that the whole `noscript` tag occupied one line. The actual formatted InstallCommandCard has the same literal CSS payload on a multiline tag, so the old expression returned `undefined` before its CSS assertions. Its source reader now accepts whitespace between the tag's existing syntax tokens. The original base-layer, hidden-selector, display, content and enhancement assertions remain. All three existing no-JS cases passed after the reader repair. This is source-reader validation, not a new browser/no-JS journey.

A single canonical full coverage check was then attempted under both shared heavy-job locks, with a 768 MiB Node heap bound and a 180-second outer deadline. It was terminated by signal 9 after approximately 87 seconds, with an empty log, before the deadline. The termination cause is unknown. There is no candidate coverage result, no claim that the global count fell to twelve, and no retry that hides this attempt. The four inspected source files were unchanged before and after the checks. The supervising Python process completed its receipt-writing loop; that does not turn its signal-terminated child into a pass.

Local raw receipts and logs are retained in `/workspace/scratch/828b7e591003/s3-install-source-repair/`, together with the old-policy negative log `/workspace/scratch/828b7e591003/s3-install-source-old.log`. The full source-bound CI artifact preserves the original broader ordinary-test result: 22,204 passed, 492 failed, 9 skipped and 37 todo. These are separate from the one import-boundary and three no-JS checks above. Final source CI and native consumer acceptance remain required for PR #1713, #1042, #1141 and #1178.
