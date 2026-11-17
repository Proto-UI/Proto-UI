# Retain short PRE observations in the shared browser artifact

## Actual failure and the missing evidence

On `bf8b1f55f93a89f3c689276d6e339d83891f4dba`, the [shared browser shard 7/10](https://github.com/Proto-UI/Proto-UI/actions/runs/44038705347/job/133887873514) ran all six cases in `code-scroll-chain.browser.test.ts`: **five passed and one failed**. The independently located short PRE reverse-wheel case failed with `expected 785 to be less than 285`. The file finished in 56,885 ms; that case took 16,757 ms. The shared shard later reached its outer timeout before a terminal Vitest report and full failure stack were retained.

That error can arise at either the initial passive product displacement assertion or the later `product-auto` stage after the same PRE has been used for the `contain-negative` control. The retained log does not identify which assertion failed. Passing historical replay, non-passive scheduling, and fresh static policy diagnostics do not establish acceptance of the failing passive same-PRE journey. The two long-code journeys at 1440 and 320 pixels passed.

The [actual artifact](https://github.com/Proto-UI/Proto-UI/actions/runs/44038705347/artifacts/14308629288) has 428 files, but no code-scroll observations or screenshots. Its downloaded ZIP is 21,831,845 bytes with SHA-256 `3aefeb4dcad5a6e177969b8ec0f97ea6689520ab172136cc3c9a10eac9f4dee1`. The source and terminal receipt both bind to the exact head above. The receipt records a failed shard without a terminal runtime payload.

## Evidence directory ownership

The shared browser job exports `PROTO_UI_RUNTIME_EVIDENCE_DIR` and uploads that directory with `if: always()`. `scripts/test/run-runtime-tests.mjs` requires this root for CI phases and passes the environment to the test process. It does not supply the dedicated code-scroll variable. Previously, the suite read only `PROTO_UI_CODE_SCROLL_EVIDENCE_DIR`, so these observations fell back to `/tmp/pui-code-scroll-chain`, outside the uploaded root.

The suite now chooses its directory in this order:

1. The existing `PROTO_UI_CODE_SCROLL_EVIDENCE_DIR`, preserving the dedicated workflow and caller override.
2. `code-scroll-chain` beneath a nonempty `PROTO_UI_RUNTIME_EVIDENCE_DIR`, so the shared job uploads the existing receipts and screenshots.
3. The original `/tmp/pui-code-scroll-chain` local fallback.

Both workflow files remain unchanged. This is an evidence retention repair; it does not repair or accept the wheel behavior.

## Existing observations already distinguish the two failure stages

Before the initial displacement assertion, the observer saves the selected PRE's geometry, document and internal scroll positions, computed overflow and overscroll, pointer hit, every wheel input, and captured native event attribution. Each `short-product-wheel-*` observation is persisted. The crossover additionally records each named control stage, same-PRE identity and connectivity, computed policy, input and event times, hit attribution, and post-delivery displacement. It explicitly saves before its final displacement assertion. The case and crossover failure handlers retain the primary failure and cleanup/restoration observations.

Retaining these existing records is sufficient to distinguish the two possible displacement failures and inspect input attribution. No duplicate instrumentation is added. Every case body, assertion, wheel delta, coordinate, event observer, save ordering, poll limit, and case timeout is byte-identical outside the output directory declaration.

## Boundary with PR #1485

[PR #1485](https://github.com/Proto-UI/Proto-UI/pull/1485), inspected open at `52c89701fec2a6afaa4cd341fafb707795901fc8`, routes the literal `overflow-y-auto` token to the split inner surface while its host retains placement and maximum height. Its [published native receipt](https://github.com/HyacinthHaru/Proto-UI/blob/b6d3e3de74b89dd89a2781b5a272476eaad6d025/evidence/2026-11-17/split-root-vertical-scroll-cdba4fe2/receipt.json) contains Chrome 156 Dialog wheel, focus, and Escape observations. Both runtime source hashes at the inspected PR head match that receipt. This is useful evidence for the Dialog boundary it actually exercises.

That PR changes neither the native PRE's overflow/overscroll CSS nor this short-PRE passive crossover. The native code panel remains a native PRE; its passive paint layer is a sibling, not a replacement scroll owner. No short-PRE pass or coverage by PR #1485 is inferred, and this patch does not enter its product scope.

## Validation and remaining acceptance

Bounded validation checks TypeScript syntax, evaluates the actual directory initializer under dedicated/shared/both/neither environment selections, and verifies source conservation outside that declaration. Formatting and whitespace checks cover the two-file candidate. No new mirror tests, browser runs, product changes, or deadline changes are included.

The original native **five passed / one failed** result remains unresolved. A usable native runner must rerun the unchanged six cases on the candidate and retain `code-scroll-chain/observations.json` with source hashes. The retained stage and event facts can then establish whether the failure belongs to initial input delivery, reuse after the negative control, or the product overflow chain. This machine's normal Chromium sandbox launch failure supplies no evidence about that product behavior.
