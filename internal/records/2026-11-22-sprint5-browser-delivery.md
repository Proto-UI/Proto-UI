# Sprint 5 browser compiler delivery

## Scope and authority

This candidate advances #828, #1169, #1170, #1171 and #1172 under #817. It uses the existing canonical AST parser, checked IR, target admission and native source emitters. The ordinary filesystem entry and the browser entry share `memory.ts`. The browser never evaluates authored proto or calls a server compiler.

The initial browser host is adapted from the unmerged MIT-licensed candidate `3a3c731286dd025de8595ddb0c2af1167415640d` referenced by #828. That candidate was not present in the `dc3b184` main baseline. This change preserves its authorship and extends its host/protocol rather than claiming that history was merged. All current changes are AI-assisted; independent review and browser acceptance remain separate from implementation.

Applicable definitions remain the existing template, state, props, events, accessibility and lifecycle definitions referenced by the canonical compiler and Base Button. The thin compiler completion standard remains in force. Preview replacement creates a fresh logical owner; it does not introduce SSR or cross owner state transfer. A retired preview must finish disposal (or have its frame removed at the bounded cleanup deadline) before a new preview mounts.

## Delivery and identity

`build-browser.mjs` bundles only the trusted compiler and a closed in-memory host. The bundle executes in QuickJS WebAssembly inside a caller-owned module Worker. Node filesystem operations are not emulated. SHA-256 is the only bound host operation: UTF-8 text passes through JSON framing to preserve embedded NUL and lone surrogates across the VM's C-string boundary. Node and WASM artifacts must match, including generated support paths and source metadata.

The queue snapshots every request at enqueue and retains one running request plus only the newest queued edit. A SHA-256 binds source, the entire supplied closed dependency graph, target/options and revision. Both Worker envelope and canonical result carry that binding; ready/result also identify the exact compiler bundle and TypeScript version. Mismatched transport results terminate the Worker. Superseded results cannot clear a newer result.

The optional compiler panel is inside the existing PrototypePreviewer RuntimeBox. The ordinary article and existing preview remain available without opening it. Opening the panel loads inert source assets and the Worker. Source edits and target changes invalidate generated text, diagnostics and visible output together. Compiler errors retain their original source spans; mount/host errors are separate. Cancel, panel closure and DOM removal terminally stop the Worker and retire the current frame. A transport/VM/mount failure recreates the Worker on retry. A normal source rejection retains the healthy VM.

Generated source remains the canonical editable artifact. Only its preview copy is transpiled to JavaScript, with static generated-module import links and execution checkpoints. Target assets record actual installed versions and content digests; the panel verifies their versions against generated dependency declarations before mounting. This delivery layer neither interprets IR nor implements component protocols.

## Resource and execution decision

The preview receives the existing CLI stylesheet generator's exact declared token closure; unsupported token projections fail preview admission. Checked outward event names wire ordinary framework listeners, with an event counter for exercising the generated consumer. Neither step dispatches by component name.

| Boundary | Limit or behavior |
| --- | --- |
| Closed serialized request | 256 KiB UTF-8 |
| Returned serialized compiler result | 8 Mi characters |
| QuickJS VM memory / stack | 128 MiB / 2 MiB |
| VM initialization | 30 seconds |
| Canonical compile plus preview preparation | 30 seconds |
| Parent Worker response deadline | 35 seconds |
| Preview mount deadline | 10 seconds |
| Previous preview cleanup acknowledgement | 250 ms, then remove frame |
| Preview generated functions/loops | 100,000 checkpoints per browser task |
| Trusted native-support template cache | At most 8 capability plans; copied immutable text artifacts |

The historical host's 5-second compilation guard was exercised and failed on the current real Base Button, including when preview preparation was disabled. It was not an Issue performance commitment. A profiling run then found a real NUL-hash parity defect. After that fix and a bounded cache of generic host capability templates, four-profile Node/WASM parity passed: cold WC 22,251 ms, React 4,087 ms, Vue 3 4,342 ms and Vue 2 4,381 ms in one local serialized run. The 30/35-second host budgets are an explicit decision based on that observed work, not a claim that the 5-second run passed or a throughput SLA. All authored source parsing, checking and emission still execute for every edit.

Preview code runs in an iframe with `sandbox="allow-scripts"`, an opaque origin, no parent DOM/storage grant and a CSP denying network connections, external images/fonts, forms and child frames. Neither an opaque origin nor `connect-src 'none'` by itself prevents frame self-navigation. Preview admission therefore also rejects navigation, form, document, executable and embedded browsing tags, including anchors, forms, meta refresh and iframe; only literal inert HTML template tags are accepted for this delivery. The ordinary compiler may still compile other valid source for non-preview consumers. Messages bind source window, opaque origin, session token and revision.

The iframe and checkpoints are separate from the browser's OS process sandbox. The runner keeps `chromiumSandbox: true`; the local managed environment rejected Chromium's ProcessSingleton Unix socket with EPERM, so no local browser pass is claimed. A normal-sandbox execution environment must supply the actual browser receipt. Browser-native memory allocations cannot be capped by the VM's 128 MiB limit; that limit applies to compilation only. The process sandbox, input/output bounds, restricted capabilities and frame retirement are distinct controls.

## Acceptance status and reproducibility

- Direct actual-WASM tests cover four canonical Base Button targets, a Unicode closed source graph, effectful source rejection without evaluation, unsupported targets, digest mismatch, bounds, interruption, recovery and terminal disposal.
- Controlled transport tests cover mutable queued input, duplicate revisions with different targets, coalescing, mismatched source/build/revision and disposal.
- Owner coordination tests cover retire-before-mount, out-of-order completion, stale target preparation, disposal and mount-failure recovery.
- The actual bilingual Astro browser runner is `node --import tsx scripts/analysis/browser-compiler-browser.mts`. Its receipt, server log and screenshots go to `.cache/sprint5/browser` (or `PUI_EVIDENCE_DIR`). It must run with a normal OS browser sandbox and exact candidate inputs.
- A default-heap full workspace TypeScript run failed with a 2 GiB Node heap OOM, without a source diagnostic. This resource failure is retained; an appropriately provisioned type gate remains necessary.

The first actual Astro/Chrome 145 run on doesvm retained two product failures: the underscore-prefixed asset route was ignored (HTTP 404), and the existing previewer's broad native-select fallback adopted the compiler's target selector and replaced its options. The assets now use `/compiler-assets/`; the legacy fallback excludes compiler-panel and mounted-demo controls. A regression checks that changing a compiler target does not change the ordinary preview runtime. The first failed receipt remains evidence; it is not a successful preview run.

After the initial candidate, the complete local browser/native-support group passed 42 tests in four files. Focused runtime-selector/protocol/owner tests passed 31 tests after the actual UI fixes. A 4 GiB focused TypeScript gate covering the new browser/UI/build/runner files and their canonical compiler import closure passed after fixing three script typing errors. Final browser verification still must run the final candidate and preserve its exact source bindings.

The final retirement negative control passed with the owner coordinator's four tests: a cleanup rejection arriving while compilation is pending remains observed, blocks replacement activation and is returned to the disposal caller. The added preview event/CSS delivery and expanded navigation admission still require the final candidate's actual WASM/browser rerun; a queued local attempt was cancelled before acquiring the shared acceptance lock and is not counted as an execution.

The existing schema-3 website inventory is preserved: **494 pages, 264 demos, 722 registered prototypes**, with all original rejects and historical source bindings. Its old admission records are historical snapshots, not current browser acceptance. This candidate opts in the English and Chinese Base Button pages for the four Web source targets; their browser status is pending the real runner. The other inventory rows remain explicit work under #817. No first-demo success closes #817 or certifies every registration, target, browser, physical input method or assistive-technology route.

`scripts/compiler/browser-delivery-index.mjs` produces a separate full-inventory overlay, leaving the historical inventory byte-for-byte intact. Until an actual receipt is supplied, every candidate target remains pending. With `--receipt`, the script verifies recorded source bytes before recording any executed page target. Independent acceptance and parent closure are separate decisions.

Independent review found that the original hand-maintained browser source paths omitted direct compiler imports in core. The build now derives canonical compiler, framework vendor and editor/Worker inputs from actual esbuild metafiles, including installed modules and the QuickJS binary. A conservative workspace/site/build source inventory covers the surrounding Astro shell and resolution configuration. Its membership and file bytes are compared exactly; the generated delivery overlay and receipt outputs are outside that input set.

The runner independently rebuilds expected compiler/target assets, compares the service's input manifest and asset bytes (also when an external `PUI_BROWSER_URL` is selected), and verifies the actual browser-loaded asset and WASM digests. After the run it rebuilds again and records an explicit source/asset stability result. Receipt acceptance performs a fresh current-source rebuild instead of trusting the receipt's file list or a cached compiler digest. Metadata controls use real small esbuild fixtures: core and CLI CSS drift, missing bindings and metafile entries, newly imported dependencies, changed target bundles, a different service and missing final stability all fail. These controls passed 5/5; the final browser candidate still needs its real execution receipt.
