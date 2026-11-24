# Sprint 5 React recovery rejection retires the native root

## Boundary

This increment follows the separate Vue adoption correction and implements the existing draft `C-LIFECYCLE-OWNER-INITIALIZATION-0001-D/E` for a concrete React failure path tracked by #896. An adoption that the generated API has rejected must retire its acquired native resources and refuse further work. Accepted ownership and explicit fresh initialization retain their existing behavior. This does not activate the draft or admit a public SSR profile.

## Actual failure and correction

The private React SSR helper records recoverable hydration errors and makes `getHandle()` reject the adoption. Previously it left the actual React root alive. A native Suspense boundary could recover its mismatching child, install that child's real effect and event listener, and keep both alive after the generated API had refused the adoption.

The counterexample uses the actual emitted server and client artifact set. Its server tree contains a Suspense child button with `server` text; its client tree contains the same native Suspense boundary and a real React component rendering `client` text. React reports one recoverable mismatch. The generated `getHandle()` correctly rejects adoption, but the native child has `active: 1` and `retired: 0` where the independent resource oracle requires `active: 0` and `retired: 1`.

The generated hydration helper now marks rejection terminal immediately and refuses subsequent `render` calls. It queues the actual `root.unmount()` after React's current commit stack. This preserves native framework cleanup without attempting a synchronous unmount during React's commit. The root retirement is idempotent. A separately detected replacement of the initial source-bound root also triggers retirement when the API refuses it.

The first attempted whole-root mismatch reached the existing missing/mismatched source-bound projection refusal before the intended resource oracle. That result is retained in `react-owner-adoption-red.log`; it is not used as the native-resource leak witness. The valid Suspense-boundary red is `react-owner-adoption-red-suspense.log`.

## Accepted-owner control and artifact typing

The second actual emitted consumer starts from matching server HTML and accepts adoption. A normal update changes its native child while retaining the same exposed State object and only one `created` event. Explicit unmount disposes that State, repeated unmount has no duplicate disposal, and a subsequent explicitly selected initialization creates a distinct State and another `created` event. The old State stays invalid. This is a bounded State/lifecycle identity control, not complete Context or physical-browser evidence.

The first run of that control failed only because the fixture expected the word `disposed`, while the established retained-State error says `terminal disposal`. The fixture now requires the actual terminal-disposal diagnostic. No production behavior was changed to accommodate that assertion. `react-owner-adoption-two.log` preserves the intermediate result.

A strict check of the complete emitted artifact closure exposed a pre-existing no-style server branch: `const tokens = []` produced TS7034 and TS7005. `serverTokens()` already returns `readonly string[]`; the emitted local now carries that same type for both reached-style and empty branches. This is one local annotation in `react-source.ts`, with no capability admission, execution or package-surface change. The third test writes the complete actual SSR artifact set to a fresh destination and checks every emitted TypeScript support file under the repository's strict options.

The first standalone artifact-check attempt used an already-created publication destination and correctly received PUI3002; `react-owner-artifact-types.log` preserves this harness error. The following standalone check reached the actual two TypeScript diagnostics, preserved in `react-owner-artifact-types-final.log`. The final three-case test includes the successful strict artifact successor after the local type annotation.

## Verification

The final affected suites passed **17/17**, with no skips:

```sh
corepack pnpm@10.32.1 exec vitest run \
  packages/compiler/test/react-owner-hydration.test.ts \
  packages/compiler/test/react-context-source.test.ts \
  --maxWorkers=1 --minWorkers=1
```

This is three new adoption/type consumers and fourteen existing React Context consumers, including the existing source-bound SSR Context adoption and fresh post-adoption child test. The raw result is `react-owner-adoption-final-three.log`. The new tests load the real frameworks and the complete emitted modules, with no authored-source execution or mocked root, effect or renderer.

The final focused strict source program resolved **454 source files with zero diagnostics**. Catalog authoring passed for the single changed draft test input against `c99a224ad2`. Their raw receipts are `react-owner-adoption-types-final.log` and `react-owner-adoption-spec.log`. Formatting and `git diff --check` passed. The draft test mapping remains `needs-review` until independent review accepts this bounded witness.

The changes are confined to React SSR output, its no-style server local annotation, tests and evidence. Previously verified GPUI/native producer, native output, WC physical-browser and other unchanged target evidence remain bound to their original source closures. This React increment does not claim to have rerun those lanes or replace their receipts.

## Remaining original acceptance

Real physical-browser adoption/replacement for React, Vue 3 and Vue 2, complete per-target State/Context and controlled-input authority, source/compiler/helper/request binding, application trust and independent draft acceptance remain separate #895/#896 conditions. These happy-dom and strict-artifact results close the reproduced development defects only; they do not establish the complete Sprint 5 acceptance matrix.

## Durable raw and independent review

The [evidence manifest](evidence/2026-11-24-sprint5-react-adoption/manifest.json) binds the retained original failures and successful author logs, plus the separate reviewer’s unchanged four real-emitted consumer controls. The independent review supports exact tree `95576086dfad30c721b95dff5e97d4d103ba6be8` against its Vue parent; it is not GitHub approval. Integration applies the same five-file patch (SHA-256 `2176c2d23316aeea1c3d2d4be093197ac11e7fde532f77354ef2bed378ca554a`) after the independently resolved concurrent merge.

## Integrated source check

Applied after merge `f6bdadf1bf1791bab8a66d7c9a6c25993fc5c1f4`, the real emitted React/Vue owner and Context suites passed **24/24, zero skipped** (React owner 3, React Context 14, Vue owner 4, Vue Context 3). Raw JSON/logs and source hashes are retained in the manifest. The explicit source workflow now includes both JSON provenance suites, both target owner and Context suites, and native-input focus controls. Scheduling/inventory controls passed **34/34, zero skipped**. This source selection addition does not change workflow permissions, opt-ins or deadlines.

The current catalog check passed for one changed input against `f6bdadf1`. The initial `tsx` CLI wrapper failed to create its IPC socket under the local process sandbox; the same original checker then ran successfully through `node --import tsx`, with unchanged base and rules. Both logs are retained.
