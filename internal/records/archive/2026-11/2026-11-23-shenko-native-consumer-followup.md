# Shenko native consumer: reading and terminal ownership follow-up

This follow-up starts from published Compiler candidate `79e8469ba1b4d6229504eea3dae4c2cecbba476e` (A5). It records failures from the actual Shenko production App, their shared implementation repairs, and bounded verification on the subsequent working source. These working-tree receipts are not relabeled as clean-commit, complete browser, or all-target acceptance.

## Actual consumer findings

A5 fixed the earlier unreachable `CollectionItem.getMeta` callback: the real App now mounted. Its independent production attempt compiled all 46 entries, passed strict checking and the 51 existing frontend tests, and reproduced all 13 static payloads. The overall independent gate nevertheless failed because checkout under host umask `002` produced a CLI executable mode of `0775`, which pnpm normalized to `0755`. Its bytes and hash were unchanged. Shenko's separate preparation fix controls the checkout umask before admitting inputs; it preserves the full mode comparison. The failed attempt remains failed.

The original reading fixture contained committed messages but no focusable historical operation in IM. Replaying the committed PR #389 assets with that fixture reproduced the same two IM Tab failures, while both Inspect journeys passed. Adding an ordinary fenced code block uses the existing Copy control and makes all four baseline journeys pass. Only fixture content changed: the four scenarios and the 15,274-byte action/assertion block remain byte-identical, SHA256 `085a68b4f38ab03ece237082d493f36545f13443d408f241f5fea9de545c8dc6`. This is a fixture correction, not an unchanged-script claim.

With that fixture, A5's desktop IM passed its first 15 checks, including historical focus, reader anchors, selection, explicit resume and natural end arrival, before failing after subject replacement. Mobile IM passed its first 14 checks before failing to follow growth immediately after natural arrival. Inspect failed its initial end movement. Both later IM contexts also reported a terminal Drawer release error. Those observations motivated the repairs below; they are not superseded by simulated-DOM tests alone.

## Reading ownership repairs

The native Web Scroll bridge now schedules the initial `while-at-end` movement when an acquired viewport already overflows, matching the canonical host's acquisition behavior. It installs that work before the attachment command FIFO drains, so a queued pause, a later same-axis position command or a reentrant command can cancel or supersede it. Current binding, epoch, reader contact, request version and pending/following checks remain. Explicit `toEnd` remains synchronous.

Two existing fixtures separate the new mount-owned frame from the explicit command under observation. One flushes it first; the position fixture uses the controlled frame scheduling already used by the existing end tests. The first replay's 66 passes and 3 failures are preserved. The corrected four-file replay passed all 69 original cases.

Natural arrival exposed a separate same-lease gap. Native input could leave the previous 250 ms departure-intent window active after the reader actually reached the end. Immediate content growth was then rejected by that old window and interpreted as another departure. The original composed-wheel case was extended past its existing successful-arrival assertion: immediate growth expected one frame but observed zero before the fix. All prior actions and assertions remained.

The repair clears `readerIntent` only in the original branch that already proves same-axis movement, unchanged layout, actual end arrival and reader provenance. Its condition is unchanged. Stationary or clamped input, ordinary programmatic requests, movement on another axis and layout-only changes still do not release an explicit pause. The same four original files then passed 69/69, with zero skips, including their reached Scroll support strict check. No new executable case was added.

## Terminal PartView lookup and Drawer admission

The draft `C-ANATOMY-0009-F` makes the ownership boundary explicit: retaining a PartView does not keep its target declaration alive. A fresh lookup on a retired claim or an unavailable terminal Expose surface returns absence. Caller authority, phase and provenance errors must still propagate; repeatable detachment of a live view must not retire the declaration.

Runtime checks both the original claim identity and target availability before reading its Expose port. Native Web lowering and GPUI, Qt and Flutter queries implement the same target-unavailability boundary. Existing public method wrappers, capability decoding, caller checks and IR8/ABI remain unchanged. Source synchronization for the three non-Web targets is not a claim of new native runtime acceptance.

Drawer Content retains its original Root PartView instead of retaining a release method indefinitely. Release first clears Content-local admission state and runs the original local callback, then freshly queries that saved Root. This handles both terminal cleanup and reparenting: a retired Root is absent, while a live former Root can still release its old lease. Generation checks, falsy thrown values, first-error behavior and `AggregateError` ordering remain.

Previously retrieved methods preserve their existing host behavior. Canonical Runtime tests require the saved Root release to become inert after Root-first disposal; compiled public methods retain terminal rejection. These are distinct existing behaviors, neither of which was weakened. The new rule concerns fresh lookup.

The existing module retirement scenario now also asserts `false`/`null` from its saved PartView. `T-ANATOMY-0002` records that module evidence without adding F to the shared terminal-isolation case's coverage or implicitly claiming the existing website implementation covers it.

## Fresh author-source composition

The actual Shenko public `upstream/drawerContent.proto.ts` entry was freshly loaded through the public Compiler API, compiled, serialized through JSON IR8, independently validated, and emitted through public `emitReactSource` and `writeCompilation`. Its 38 output files, including 36 support files, passed the complete reached strict typecheck. No old IR or hand-edited generated component was used.

The first attempt correctly stopped at a stale canonical Web-host snapshot. The official generator and its `--check` then passed. Comparing all 33 snapshot inputs found only the changed Anatomy API comments; no unrelated input drift or manual generated-file edit was introduced. The original rejected attempt remains in the evidence.

## Internal size work and unchanged gates

The retained internal refactors combine repeated A11y value-range classification, group Scroll's private horizontal/vertical owned handles, and share event-router traversal. They preserve numeric coercion, semantic names/defaults, handle and fresh-snapshot identity, per-field reentrancy checks, getter order, method receivers, and lazy active-element fallback. An independent review caught IteratorClose ordering in the router extraction; the corrected projection remains inside the resolver callback and its original 227 cases were replayed successfully.

The original strict nine-entry budgets remain unchanged. The completed pre-Overlay diagnostic on the repaired working source passed six entries and failed three: React 165,656/165,500, Vue 164,492/164,300 and Web Component 199,094/199,000 gzip bytes. Runtime was 101,482/101,500. A first-error-collector candidate passed 67 original tests but increased Web Component gzip by 10 bytes, so it was precisely reverted. These failed measurements are retained, not replaced with an advisory policy or raised limits.

The retained Overlay refinement replaces 24 same-form `patchValue` calls with a private fixed-order field tuple and numeric-index loop. It preserves each method lookup before the corresponding patch getter, each per-field write/freeze, error and reentrant visibility, the preceding available-layout checks and following metadata handling. All 93 cases in the seven existing Overlay files passed. Paired strict measurements decreased all four affected entries, but still failed overall: Runtime 101,430/101,500; React 165,619/165,500; Vue 164,443/164,300; Web Component 199,063/199,000. The other five entries were unchanged. This functional follow-up is published with that remaining gate explicit; a later candidate must establish its own clean strict result.

## Bounded evidence

These are separate replays with potentially overlapping cases, not an aggregate full-suite count. Exact receipts, source bindings and log hashes are retained under `internal/records/evidence/2026-11-23-shenko-native-followup/`. Raw receipts and logs are stored as losslessly verified gzip archives so normal formatting cannot rewrite their bytes. The copied receipts preserve their original timestamps, source identities and pending fields; later replays do not rewrite earlier observations.

| Scope | Actual result |
| --- | --- |
| Initial following, four original Compiler files | 69/69, zero skips |
| Natural arrival extension, before repair | Existing case fails: zero frames instead of one |
| Natural arrival repair, same four files | 69/69, zero skips; reached Scroll support strict passes |
| Anatomy/Drawer, seven original files | 124/124, zero skips |
| Public lifetimes, six original Web files | 60/60, zero skips |
| Compiler scoped strict | Exit 0, zero diagnostics |
| Fresh actual DrawerContent and its full reached strict graph | Both exit 0 |
| A11y range-key refactor | 37/37 |
| Scroll axis-handle refactor | 67/67 |
| Corrected event router, ten original files | 227/227, zero skips |
| Overlay fixed-order configuration, seven original files | 93/93, zero skips |

The local full workspace type attempt exhausted its default heap, and the larger-heap retry was interrupted. Neither is a pass. A4's official full type chain remains evidence for A4, not this candidate. A4's general CI job was cancelled without a completed 200-file Compiler result, so progress checkpoints do not establish that original scope.

[A5's actual native consumer workflow](https://github.com/Proto-UI/Proto-UI/actions/runs/45092986478) passed on Linux and macOS, including the original 39 consumers and 8 numeric accessibility bridge tests per host with the locked GPUI dependency graph. That success establishes the earlier scalar/callback repair at A5; it is not reassigned to these subsequent changes.

Final clean-commit types, the original Compiler/Scroll suite, strict size, independent 46-entry production regeneration and real four-journey browser verification remain separate gates. No browser, native-toolchain, physical IME, assistive-technology, model/backend or merge approval is inferred from the bounded source checks.
