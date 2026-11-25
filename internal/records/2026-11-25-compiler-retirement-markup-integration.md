# Compiler foundation: markup reference after main integration

## Source transition and preserved reference

The current user authorized integration of the latest main into the compiler
foundation and this bounded follow-up of its markup source inventory. Commit
`8635852ffdba3eecd8b03259deb93d81b33301c9` integrates main
`f7d5b8468892b13e61afaa86c40ca2ff8d0558c4` while retaining compiler retirement.
Main includes [PR #1916](https://github.com/Proto-UI/Proto-UI/pull/1916)'s
RuntimeBox, CodePanel, family control, Popover and Toast changes. This record
updates source identities for that integrated candidate; it does not transfer
either parent's browser or CI results to the combined source.

The complete preceding 31-source reference is copied byte-for-byte to
[website-markup-provenance-862870f.json](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-862870f.json).
Its SHA-256 is
`23aa5d008f4b59d8a7ab47a1114f5eddfe8b2855603d42032bbebd2f3c4c3690`.
The [earlier retirement record](2026-11-25-compiler-retirement-markup-reference.md)
and all earlier references remain unchanged, including the original failed
CI run and its 17 unexecuted markup-study cases.

The [current reference](../../scripts/coverage-matrices/test/fixtures/website-markup-provenance-current.json)
binds the exact product bytes at `8635852ffdba3eecd8b03259deb93d81b33301c9`,
before this metadata-only follow-up. Every recorded path matches the Git blob
at that commit and the clean integration worktree. The uncommitted frontend
lockfile in the separate development worktree is not used as source identity.

## Reviewed changes

All previous 31 owners remain. Seven existing hashes are renewed after review;
24 hashes, including the lockfile, Astro configuration, sampled source maps,
route documents and the previously reviewed Dialog page, remain unchanged.
The newly imported formatting producer is added as the 32nd owner.

| Owner | Reviewed source difference |
| --- | --- |
| `PrototypePreviewer.astro` | Formats authored code before serializing the code map and highlighting it, selects the preview control family, provides startup runtime tabs, and retains the integrated layout changes. The retired optional compiler panel remains absent. |
| `CodePanel.astro` | Selects controls for the preview family and adds the collapsed guard and explicit collapse control; collapsed viewport styling hides scroll affordances. The source, highlight and Copy ownership surfaces remain. |
| `previewer-client.ts` | Preserves host height during a runtime transition, clears it on success/error/disposal, and observes preview control family changes. The retired compiler selector exclusion remains removed. |
| `projected-previewer-client.ts` | Captures startup tabs with the skeleton, removes them at commit, and restores them if preparation is rolled back. |
| `code-panel-client.ts` | Makes collapsed code inert, synchronizes expand/guard/collapse controls, resets scrolling on collapse and cleans up the additional event listeners. |
| `site-copy-command.ts` | Selects the four preview families and their Copy surface/glyph recipes, observes the explicit preview family and suppresses an automatic material scene for this control. Actual text still comes from the owned Copy controller. |
| `projection-families.ts` | Registers the Input and Label auxiliary prototypes for the Shadcn, Brutalist and Bootstrap Popover recipes. The sampled Transition and Dialog source-map identities remain unchanged. |
| `code-format.ts` (new owner) | A build-time Prettier producer now transforms the snippet before the source map/highlight stage. Its parser selection, width/options, cache and original-fragment fallback therefore affect the bytes sampled by the study and need an explicit source identity. |

The source hashes in the preserved and current references are fixed reviewed
values. The browser study does not generate a new accepted profile from its
own inputs. Adding this direct formatting producer does not assert complete
transitive dependency coverage; other helper, runtime, family and host
dependencies remain subject to separate closure evidence.

## Integrated browser study and evidence boundary

Main also changed the existing browser study. It imports `formatPreviewCode`
and passes the authored source through the formatting producer before the
Shiki comparison, recording both authored and formatted source digests.
The sampled routes, runtime sequences, native receiver/source/HTML/Copy,
remount, no-JavaScript and hostile-example assertions remain in the integrated
study. This metadata follow-up does not edit that file or any assertion,
timeout, source-binding implementation or Node control test.

Validation used Node v24.22.3. The exact source-binding preflight reports no
issues for all 32 sources and verifies the preserved archive bytes. The existing
Node controls pass 67/67, and `check:public-docs` passes with 438 maintained
repository documents. The agent-document generator check also passes when
launched directly with `node --import tsx`; the package-script launcher could
not create its local IPC pipe in this environment.

The 17 browser scenarios are not run by this reference update. A later real
run must bind its own candidate and report its own outcomes, including the
combined changes from main; neither an updated digest nor a successful website
build supplies that browser result.

`sourceAdmission` remains `unverified`. Original CI failures, the former
ENOENT and all missing/unrun evidence remain historical facts. This record
does not claim browser acceptance, served-source proof, full transitive
closure, lifecycle/release acceptance or completion of #834.
