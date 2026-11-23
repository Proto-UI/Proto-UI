# Independent local review: Sprint 2 compiler release consumers

Reviewer: `/root/collections`, independent of the compiler implementation owner. Execution mode: human-assisted / current-user. This is a source and bounded executable review, not a GitHub approval or final-head whole-PR acceptance packet.

## Source binding and scope

- Repository: `/workspace/scratch/44c416809288/s2-compiler`.
- Assigned implementation: `936a6f497f1dcbfe1906ffa376fcc43c3aa4413c`, 22 files, authored release Button consumers across four Web source profiles.
- Reviewed correction: `3624d24ea8dc168292fbdb9e029be54ca0b10797`, five files, subscription retirement and static enumeration shadowing.
- Reviewed final correction: `f618a760cfcdeee9d237474af1b7345eb60bd6c9`, eight files, module style scope plus strict generated-source type facts. The independent final probe ran at descendant `3ea9e34545615ce4a981e2e19c3c3fcc9de3b0bb`; the relevant `rule-declarations.ts`, `resolved-props.ts` and `parser.ts` files are unchanged from f618a76. The descendant's separate CLI registry change was not accepted by this review.
- The intervening pinned-CLI/ordinary-consumer commits are outside this compiler-semantics review. They have now received their own scoped independent review in `collections-agent-pinned-cli-review.md`, with separate artifact and executed-tool bindings.
- Definitions read: draft `C-RULE-COLOR-SCHEME-0001`, `C-RULE-PREFERENCES-0001`, `C-RULE-WHEN-0001`, active `C-PROPS-0012` / `C-PROPS-0013`, and the source-language boundary. No lifecycle promotion is inferred.

## Findings

### COMPILER-REVIEW-001 — P2 / high confidence — corrected and independently reproduced green

**Location:** The newly emitted preference/color source in `packages/compiler/src/native-async.ts`; corresponding new lease lifecycle in `native-style.ts`.

**Expected:** Acquisition and release use the same complete native listener API pair. Retirement precedes external cleanup, attempts every owned release, preserves errors, and cannot erase a reentrant fresh source or keep late work active.

**Observed on 936a6f4:** Preference admission accepted an MQL with `addEventListener` but no `removeEventListener`, plus a complete `addListener` / `removeListener` pair. Acquisition chose the modern add method, while release chose the legacy remove method. The emitted helper installed two modern listeners and retained both after the last lease released. Related stop paths could skip subsequent query/cache cleanup after the first remove threw. Color and composed style leases had the same independent add/remove selection and early-abort risk.

**Impact:** Detached/disposed consumers could retain native listeners; teardown failures could strand service caches or other owned leases.

**Correction:** 3624d24 captures one complete attach/release pair per MQL, retires and removes the exact cache generation before attempt-all cleanup, rolls back partial acquisition, preserves original/cleanup errors, and clears style release references/generations before invoking external releases.

**Independent result:** The exact emitted helper from 936a6f4 acquires `modern: 1, legacy: 0` per query and still retains `modern: 1` after release. The helper from 3624d24 acquires `modern: 0, legacy: 1` and releases both to zero. An additional direct execution of the generated NativeStyle module verifies release-time remount, release failure followed by fresh mount, stale callback suppression, terminal disposal, and retirement during acquisition.

Evidence: `compiler-review-meta-probe.mjs`, `compiler-review-meta-probe.log`, `compiler-review-style-lease-probe.log`. The implementation owner's 21-case follow-up log was also inspected; its added partial attach/observe, teardown failure and reentry assertions are discriminating.

### COMPILER-REVIEW-002 — P2 / high confidence — corrected and independently reproduced green

**Location:** New `staticLocalBindings` and the pre-expansion path in `packages/compiler/src/parser.ts`.

**Expected:** Finite enumeration treats `Object.keys` as a builtin only when the actual lexical binding is the builtin. A local declaration must not silently fall back to a same-named module declaration.

**Observed:** Expansion ran before semantic predeclaration, but the new static local map only collected variable statements. With a local `function Object(){return 1;}`, the new `Object.keys(tokens).forEach(...)` source was accepted and emitted two Rule effects. The real source's `Object.keys` is absent and must fail. The variable-shaped shadow control correctly rejected, demonstrating the missing hoisted-binding case rather than a general fixture failure.

**Impact:** An unknown/non-builtin call could be erased and replaced by compiler-invented behavior.

**Correction:** 3624d24 marks current-block function/class/enum declarations and binding patterns as lexical shadows before expansion.

**Independent result:** The real builtin control still compiles to two effects. A variable shadow, function declared before or after the enumeration, destructured shadow, and a local function hiding module data all reject with a source-bound unsupported diagnostic.

Evidence: `compiler-review-static-probe.log`. The original red result was obtained through the real `compilePrototype` entry before the correction and delivered to the implementation owner.

### COMPILER-REVIEW-003 — P2 / high confidence — corrected and independently reproduced green

**Location:** The new local resolver in `packages/compiler/src/rule-declarations.ts`, `extractRuleStyleHandle` / `declaration`.

**Expected:** Once style extraction enters a module binding's initializer, references resolve in that module's lexical environment. An unrelated setup-local binding cannot change an already initialized module constant.

**Observed on 3624d24:**

```ts
import { definePrototype, tw } from '@proto.ui/core';
const PARTS = ['bg-red'];
const TEXT = PARTS.join(' ');
export default definePrototype({
  name: 'style-module-scope',
  setup(def) {
    const PARTS = ['bg-white'];
    def.feedback.style.use(tw(TEXT));
  },
});
```

The real compiler succeeds but emits `tokens: ['bg-white']`. Removing the unrelated setup-local declaration emits `['bg-red']`, which is the source's correct value in both cases. The resolver uses source-file equality to decide whether to invoke the setup-local lookup while recursively reading a same-file module initializer; source-file identity does not preserve lexical scope.

**Impact:** The compiler can silently emit a different public recipe from the authored module. This violates the narrow static-data admission boundary.

**Correction:** f618a76 carries the lexical-environment distinction through extraction. Entering a module binding initializer disables the setup-local resolver, and finally restores the caller's environment after recursive resolution. Truly local immutable table reads retain their original path.

**Independent result:** The original module `TEXT` emits `bg-red` with the unrelated local shadow still present. A real local table emits its own `text-black` token. A single `tw(TEXT, LOCAL['token'])` call emits both correct tokens, proving that the module-to-local environment restoration also works. All three real `compilePrototype` controls pass.

Evidence: `compiler-review-module-style-scope-red.log` includes the exact source, reviewed commit and both original IR results. `compiler-review-scope-and-props-green.log` records the three independent green controls and source head.

## Other reviewed behavior

The bounded Rule Meta vocabulary is explicitly validated in source declaration, Rule plan, IR validation and target admission. Unknown keys and unsupported GPUI/Qt/Flutter/SSR targets retain rejection. Supporting observers are emitted only for reached dependencies. Existing sampled Meta reads remain separate from mounted preference sources. The style invalidation path does not dispatch Props watchers or request Proto structural rendering.

Independent direct execution of the emitted preference module exercises all four keys, not only reduced motion: ten MQL listeners shared between two consumers; baseline and alternate vocabulary values; ambiguous contrast reads normalized to unknown; coalesced notifications; release of one consumer preserving the other; last release removing all listeners; late callbacks after release remaining inactive. Both reviewed revisions satisfy this ordinary-source control; the mixed API pair control is what distinguished the defect.

The Vue 3 default-child correction uses the existing SlotView owner, epoch and SlotRevision path. It does not add a second consumer or bypass cleanup. The current four-framework authored Button test actually supplies children, which distinguishes the previous missing-default-slot behavior. Vue 2 newly admits keyed raw watching while preserving its all-key rejection boundary. Raw diffing uses union keys and Object.is, including absent/undefined, NaN and signed zero. Callback window identity/provided-key alignment and raw-before-resolved order follow the active Props contracts. The React keyed raw disposer is an ordinary cancellable void callable, consistent with its other watcher disposers; registration remains setup-only.

No additional defect was found in these scoped Rule target gates, raw watcher changes or Vue default-slot path. Duplicate object keys remain rejected; they are not used as a passing enumeration fixture.

The additional f618a76 resolved-Props type proof visits direct unconditional authored-hook setup prefixes only, skips function bodies/optional arguments/conditional branches, stops after possible setup exits, and requires exactly matching scalar descriptors before strengthening repeated declarations. It now also considers hook configure declarations/default layers when looking for conflicting facts. Nine independent parsed-source controls confirm direct and identical hook defaults can prove presence/non-null, while nullable declarations before or after installation retain nullability and conditional, short-circuit, early-return, uncalled helper and caught-installation paths do not prove presence. Array source annotations use the already checked IR type; the Web Component unknown type remains unknown. The ordinary consumer source-map change only permits empty mappings for emitted modules whose AST contains no executable statements, while retaining embedded generated source and the independent strict type check.

## Verification readback and limits

- Independently executed: emitted-source API-pair red/green comparison; four-key vocabulary/sharing/ambiguity/lifetime probe; six static enumeration binding controls; generated NativeStyle reentry/failure/stale/dispose controls; module-style lexical-scope red/control plus three correction controls; nine parsed-source resolved-Props guarantee controls.
- Implementation-owner logs inspected: 70 tests across release-family / Rule Meta / module-static-data / Rule declarations; 76 raw-watch/Vue 2 tests; follow-up 21 tests. These are owner-run logs, not relabeled as independent executions.
- Native browser rendering, strict ordinary generated-project builds, pinned producer/source stamps, actual Shenko / Verdant build results and final integrated CI require their separate execution records. Happy DOM and direct emitted-helper execution do not establish browser rendering or AT.
- All three findings are reconciled in the reviewed corrections, and the assigned source/deterministic review has no open finding. This remains a bounded local review: it does not substitute for ordinary/native execution evidence or the PR's required review/CI/DCO/final-source binding.
