# Search module preparation on public Button intent

## Scope and ownership

This product candidate starts from `4a2320762ba5f4319dec1915ca4e138772dceb0c`. It changes only the Search service and its existing command composition, with additive tests and a separate source-matched measurement lane. It does not change SSR markup, native dialog behavior, Pagefind rendering, command activation, or the existing 1000 ms opener-readiness gate.

The command composition consumes `hovered` and `focusVisible` through `DemoRuntimeApi.getExposes()`. These are the existing draft `P-BASE-BUTTON` public facts (`P-BASE-BUTTON-POINTER-HOVER`, `P-BASE-BUTTON-FOCUSABLE`), read through draft `C-EXPOSE-STATE-0001`'s external state subscription. No lifecycle admission or new Prototype is proposed. The callback defers service work out of the state callback and checks both command lifetime and active projection ownership. Retired projections unsubscribe. No website-local pointer/focus detector or second interaction state machine is added.

The Search custom element retains one preparation promise for the HEAD index probe, runtime import, and default-UI import. Success remains reusable across command-runtime changes and close/reopen. A deliberate public intent begins only that module work; it neither opens the dialog nor constructs a Pagefind instance, changes failure UI, or focuses anything. There is no idle or unconditional startup preparation.

Actual open uses the same promise, then checks the current native-dialog open session before constructing Pagefind UI. Close invalidates pending UI continuations without discarding useful modules. Disposal aborts the probe and rejects pending imports' waits; an obsolete owner cannot construct or focus into a reconnected service. A failed preparation is handled silently, clears its own promise by identity, and does not schedule retries. A subsequent intent or actual open can retry; failure during actual open still exposes the normal explicit Retry command.

Shortcut and touch opens do not require prior preparation. This candidate makes no claim that no-lead opens, query work, reopening, or whole-page startup become faster.

## Executed local evidence

- Added the first five intent/lifetime tests before the product patch. Against the unchanged baseline product, all five failed and all 30 pre-existing tests passed. This is behavioral red evidence, not a module-resolution failure.
- After the patch and added failure/projection checks, the four Search test files pass 82/82: the actual command Buttons and adapters remain real; Pagefind/network/native dialog are controlled service doubles. Coverage includes both Shadcn/Brutalist across WC, React, Vue and Vue2, keyboard focus, deduplication, silent HEAD/runtime/UI failure, retry, close/reopen, retirement, and disconnect/reconnect.
- One pre-existing Retry-close assertion expected hidden Pagefind construction after closing. It now requires no construction until reopen, with the same prepared modules and one instance. This is the intended ownership change, not a relaxed readiness assertion.
- Projection-scope and homepage-runtime integration: 61/61 passed. Base Button lifetime/asButton and command-icon dependency checks: 18/18 passed.
- `check:types`: passed, 0 errors and 3 existing informational hints. The initial invocation stopped at the executor's unavailable default Astro configuration directory; the successful invocation used a writable configuration directory and disabled telemetry.
- `check:prototype-catalog`: passed. `git diff --check`: passed.

These tests establish controlled state transitions, not real browser latency or trusted input performance. The source-matched CI lane is separately required to check no-intent startup, intent lead, immediate open, semantic query/reopen, HEAD503/retry, and interrupted lifetimes. The original browser opener gate remains unchanged and independently required. Hosted screenshots and exact-head measurements remain pending; no old screenshot is used as this candidate's output.

## Bounded same-tree measurement lane

`.github/workflows/search-intent-ab.yml` builds the same candidate tree twice. The counterfactual replaces only `Search.astro` and `site-search-commands.ts` with pinned `4a232076` bytes. Before measurement it rejects unrelated tracked drift and unequal generated Pagefind/index/default-UI bytes. The 42 attempts cover immediate open, pointer/focus lead, no-intent startup, touch, HEAD503 retry, failed-intent recovery, pending close/disposal, query and reopen. `search-intent-ab-<run>-<attempt>` retains source/build boundaries, raw samples, screenshots, failures and descriptive distributions. The workflow retains the existing 35-minute diagnostic envelope and does not rerun historical application trees or alter acceptance budgets. Before any hosted execution, independent review caught and repaired three probe defects: missing CDP completion-clock mapping, inclusion of invalid finite sample metrics in natural distributions, and a DOM guard anchored to the command instead of actual native-dialog opening. Nineteen no-browser controls now cover those failures and the source/index/lifetime assertions. Hosted measurements have not yet run.

## Review and publication boundaries

A fresh-context independent local product review found no confirmed defect. Its 23 extra cold-keyboard, no-lead shortcut, import-timeout, late-resolution/rejection and repeated-intent cases were incorporated into the Search result above. Measurement-lane review and hosted validation remain separate. Formal GitHub comment/review/integration remains blocked while the governed CLI has no authenticated session. Source publication, if performed, uses the authorized contributor identity and exact source tree; it does not constitute approval or merge readiness. No historical measurement report is reproduced in this product record.

### First hosted preparation failure and repair

The first hosted attempt, run `37356547632` at head `162fb335b5c54be5b384acb547f020bc2520b3fe`, passed all 19 no-browser probe controls but failed before either production build or browser launch. Git's default line-oriented filename output quoted an existing Chinese filename; the source boundary tried to read that quoted string as a literal path. No browser sample or latency result was produced. This is a measurement preparation defect, not evidence of a product performance failure or pass.

The repair uses NUL-delimited Git output for tracked, changed and untracked path lists, preserving Unicode, embedded newlines and surrounding whitespace without changing Git's global configuration. A real temporary Git-repository regression fails before the repair and passes afterward, including rejection of unrelated changes, untracked files and dirty candidate source. The 20 probe controls pass. A further local smoke test hashes the actual 7,322-file repository across two clean head-bound worktrees, with only the specified two Search files reverted, and passes the unchanged pinned-source boundary. Product source, measurement budget, cohort plan and the 1000 ms opener acceptance remain unchanged; actual browser evidence still awaits a successful hosted run.

### Native-index semantic boundary after repeat-build control

The second hosted attempt, run `37357442978` at head `897ed2f9e7e176480d4072ed100fb90cb300060e`, passed source validation and both production builds. It stopped before browser sampling because independently generated Pagefind fragments and metadata were not byte-identical. The full artifact retains the build logs, native source boundary and failed comparison; no latency value was accepted.

Two local production builds of that exact unchanged source isolate the cause: 277 fragment URLs match; 138 fragments differ at 389 non-heading `anchor.id` fields only. These are the existing SSR-random Previewer IDs (282), AdapterSelect labels (60), CodeExample host/file IDs (24), WikiTerm IDs (20), and install-command IDs (3). Every other fragment field, anchor position/type/text and stable heading matches; runtime and inverted-index shards match byte-for-byte. The shipped Pagefind subresult calculation selects nonempty heading anchors, rather than these non-heading IDs.

The corrected measurement retains each source's own untouched HTML and native Pagefind index. It does not map both sources to one index, rewrite HTML, seed product randomness, or claim that independent builds are naturally byte-identical. Both full original index directories and their byte/hash manifests are retained. Only the five proven non-heading ID formats may vary, and each must exist in its corresponding HTML. All other content, metadata, counts and heading fields remain exact; all stable heading and actual query-result/subresult destinations must resolve in both builds. Runtime/WASM/inverted-index assets remain byte-identical. Every index response is checked against its own build's original hash, and each complete native manifest is checked again after capture.

Module preparation and first visible-input latency remain the primary question. Query/reopen distributions are descriptive and explicitly retain the native fragment/metadata compressed-byte confound; they are not a pure causal or identical-index performance comparison. Query, retry, close/disposal and semantic-result controls remain required. No product code, HTML, 42-attempt plan or original 1000 ms opener acceptance changes with this measurement correction.

Separately, the existing full project CI for `897ed2f9` passed in run `37357442602`, including all eight browser shards. That establishes that revision's repository checks, not the still-unmeasured A/B result or a later head's acceptance.

The corrected harness passes 71 built-in-only controls, including strict Pagefind 1.4.0 metadata decoding, all five ID classes, missing true result anchors, wrong served bytes, missing-file restoration, and changed post-capture HTML/UI/index artifacts. An independent local reviewer reproduced the native pair comparison and verified the final harness hashes. A coherent local baseline/candidate pair additionally verified all 1,489 stable headings against both real HTML trees and 13 static Button result fixtures; those fixtures are not browser-produced result evidence. Browser execution remains the next required step.
