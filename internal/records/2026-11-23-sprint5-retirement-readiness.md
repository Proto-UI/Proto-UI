# Sprint 5: preserve preview retirement across iframe startup

This non-normative continuation advances [PR #1715](https://github.com/Proto-UI/Proto-UI/pull/1715) from public parent `32cf4b2f9c9ca22dd016de2981396df9ba49b626`. It preserves that branch's normal mainline merge, production repository-root/Worker repairs, original browser/native workflows and earlier evidence. Codex prepared the four-file correction under the current user's instruction to advance drafts through substantive work to Ready for review.

The [manifest](evidence/2026-11-23-sprint5-retirement-readiness/manifest.json) identifies the exact four source hashes, original preimages, final patch, producer output, commands and raw failing/passing evidence. Results below concern that recorded candidate source on the parent; they are not a fabricated whole-PR run at a later commit SHA.

## Corrected behavior and test boundaries

The parent can retire a preview immediately after creating its srcdoc iframe, before the child installs its message listener. Posting the sole disposal request during that interval loses it. A real sandboxed Chromium control reproduced the difference: retirement after ready acknowledged successfully; retirement in the same JavaScript turn rejected at the existing 250-millisecond deadline. Both paths removed their frames.

The child now sends `preview-listener-ready` immediately after installing its disposal listener and before asynchronous imports. The parent accepts this signal only after the existing frame source, opaque origin, token and revision checks. A retired mount sends disposal exactly once when the listener is available and retirement remains active. Disposal starts the original 250-millisecond timer immediately; a late handshake uses its remaining budget. The child must still return a real `disposed` acknowledgement. Late signals cannot revive the mount, and cleanup errors remain observable before the acknowledgement.

The original eight retirement controls remain complete. Two new controls cover identity rejection, duplicate disposal/handshakes, a real acknowledgement at 249 ms, a handshake at 249 ms that does not extend the 250 ms deadline, and late signals after termination. The test fixture now supplies the actual required compile-result/provenance fields with `satisfies`, preserving strict typing instead of casting an incomplete object.

The browser acceptance probe's sandbox assertion retains all three parent-document, local-storage and cookie rejection checks. Its callback now uses three explicit try/catch blocks. This removes the nested named helper whose transpiler-generated `__name` reference was unavailable when Playwright serialized the callback into the child frame. No sandbox permission or assertion is weakened.

The emitted SDK's new ControlLabel hover test had a separate fixture-host error. Its LabelHost tried to unwrap an intentionally retired projection when GPUI rendered again after `Owner::dispose`. The product's `Owner::project` correctly refuses disposed owners, and retirement correctly clears projection. The fixture host now follows that boundary, as the existing neighboring Host already did. All original native pointer, current/stale-hover and activation assertions remain. Additional real frames after disposal check that both owners stay disposed, projections remain absent and the activation count stays unchanged.

An initial layout hypothesis did not repair the SDK failure: the complete run still returned 27 passed and one failed. Exact emitted line inspection located the projection unwrap, rather than a missing bounds value. The provisional layout addition was completely removed. That failed candidate and its raw run remain in the archive. Generated Rust was never edited; the final SDK was regenerated from the authoring template.

## Executed evidence

| Observation | Actual terminal result and scope |
| --- | --- |
| Four changed TS/MTS files | Prettier check passed; exact final hashes retained |
| Original compiler/browser/owner source selection | 22 selected files, 378/378 passed, zero pending/skipped; 175.1 seconds under the unchanged 300-second supervisor |
| Original graph-admission controls | Exit 0; complete existing positive and negative suite retained |
| Numeric producer and offline metadata preparation | Exit 0 each; metadata preparation is the existing producer requirement |
| Full locked native graph | Exit 0, pinned GPUI revision and shared SDK identity preserved |
| Actual emitted SDK controls | 28/28 passed, zero ignored or filtered; Rust 1.98.1, GPUI `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`, `--offline --locked` |
| Real iframe protocol experiment | Original startup-before-retirement case rejected; repaired case acknowledged. Ready-then-retire also acknowledged. All four observations left zero frames |
| Complete workspace TypeScript invocation | Exit 2, with only the two missing generated shadow-style-module diagnostics below; not a types pass |
| Original full browser journey invocation | Failed during Chrome launch with SIGTRAP, before a documentation page or Worker case; not browser acceptance |

The iframe experiment uses actual Chromium 145.0.7632.6 with its OS sandbox enabled and an explicitly synthetic custom-element fixture. Its role is to falsify and validate the iframe protocol race. It is separate from a canonical WASM/generated-control journey, GPUI Adapter, physical OS input or actual application acceptance. Complete original and repaired reports, scripts and source hashes are retained.

The successful native run records identical generated Rust and authoring-source hashes before and after execution. The final four-file source hashes also remain identical across the complete validation driver.

## Remaining checks and preserved failures

The standalone `check:types:workspace` invocation completed with exactly two TS2307 diagnostics, in `scripts/analysis/fixtures/shadow-s3/admission.ts` and `scripts/analysis/fixtures/shadow-s4/dialog.ts`, for `apps/www/src/styles/proto-ui-shadow-style.generated.js`. The normal `check:types` command first runs the canonical website style generator. That prerequisite was absent in this new checkout. The earlier incomplete-mock TS2352 diagnostic is absent from the completed workspace output, but the command's real exit 2 remains a failure. No generated-module declaration was invented to silence it.

The complete browser runner retained `chromiumSandbox: true`. Chrome exited with SIGTRAP during startup, before the runner reached its canonical style generator, owned Astro service or any real page/Worker case. The driver used its own long temporary-directory path; the launch failure's cause has not been established. No no-sandbox fallback, existing server, fake receipt or relaxed deadline was substituted.

The parent head's actual [manual workflow 45176454526](https://github.com/Proto-UI/Proto-UI/actions/runs/45176454526) is retained with raw SDK, source/types, production and browser logs. Its SDK result was 27/28; its browser probe reported `__name` and subsequent retirement/recovery failures. The separately reproduced startup race does not establish that it was the sole cause of every original journey failure. The production bundle check also reported two existing static Liquid fixture import-policy failures; this correction does not broaden that policy.

Earlier local complete-source attempts ended in SIGKILL, and a device protocol-only attempt reached its 120-second supervisor without a test result. They are not passes. The final complete 378-case run provides the retained successful protocol/source result. A local executor interruption made the earlier local raw files unavailable; the archive does not pretend to contain them. The first device candidate's invalid layout hypothesis, its 27/28 failure and the explicit supersession of unfinished follow-up work are retained separately.

After publication, the original registered compiler workflow is to be dispatched on the new source with both browser and Adapter opt-ins. Those runs retain the canonical generator, complete workspace/docs checks, production checks and real bilingual browser journey. Dispatch or queue state is not a pass. Generated SDK evidence remains separate from the parent head's actual macOS Adapter/AccessKit result and from physical assistive-technology evidence.

## Review and readiness scope

The iframe lifetime and new negative controls received a bounded source review from another contributor; that review preserved the original deadline, identity guards and real acknowledgement requirement. The native host boundary was separately checked against the actual parent authoring template and product project/dispose code. These checks are not a GitHub APPROVED review.

Ready exposes this repaired source and its retained evidence for independent review. It does not close the original ten Sprint 5 Issues, admit public SSR, promote draft request/owner contracts, complete the remaining page inventory, certify full Shenko/Verdant applications, or replace DCO, exact-head CI and required independent review. All original conditions and prior failed records remain applicable.
