# Sprint 2: closed local helpers retain nominal inputs

## Failure and shared rule

After first-class `run.lifecycle` was admitted, the unchanged Shadcn Tabs Content still failed at Base Tabs Content's local `syncContext(next, run.lifecycle)` call. The local helper declares `{setPresent(present:boolean):void}`. That interface describes the real module, but ordinary callable assignability correctly does not erase its nominal authority into a structural record.

The existing module-helper compatibility proof now also seeds a bounded inference pass for an actual immutable local helper with required ordinary parameters. Each requested field must match the real nominal member/operation table. The preliminary graph is discarded; the frontend rebuilds the same authored closure with that nominal parameter and rechecks all calls, aliases, phases, effects and owners. There is one closure at the authored allocation site. Runtime module reads and argument evaluation order remain unchanged.

This is not a global nominal-to-structural conversion. A second incompatible call, a fake structural object, a different State payload, a phase violation or an unproven cast still fails. Mutable helpers, callable-variable annotations, optional/default/rest parameters and unresolved call provenance have no new admission. The final shared callable analysis must establish that the retyped local closure does not escape to open callers. A small optional observer reports actual escaping closures; it changes no scheduling or callable-flow semantics.

That escape condition is necessary: the first candidate accepted a helper that was both internally called with the real module and publicly exposed with its original structural interface. The corrected frontend refuses that candidate itself. It does not rely on a later emitter to reject a private parameter by accident.

## Evidence status

The original minimal source failed with `PUI1006: Callable argument 1 type mismatch`. The corrected standalone source and cold JSON IR pass; wrong State payload, wrong phase and mixed structural callers refuse. A subsequent probe compiled the unchanged Shadcn Tabs Content for all four Web profiles. Its source bytes were not rewritten.

The focused source/runtime file completed **23/23**. It covers one authored closure, cold-IR receiver forgery, alias identity, two independent runtime owners, terminal retirement, distinct shadowed declarations, two nominal inputs and the refusal cases above. The standalone local-helper fixture also passed complete strict generated-artifact checks for all four Web profiles. Its consumers execute under Happy DOM, not physical browsers or AT.

A separate adversarial probe instantiated the same local source through two module-generic specializations with different State payloads. The first candidate alternated its inference hint and reported `PUI1999`. Retained nominal hints now advance monotonically: a source declaration that cannot retain one compatible signature reports a source-located `PUI1006`. Two same-payload instantiations pass, while the heterogeneous case remains explicitly unsupported. This avoids both inference oscillation and a first-caller authority grant.

The first combined consumer run passed 20/25. The four real Content cases reached their final assertion, where the fixture incorrectly expected a disposed public State to remain readable; all four hosts correctly invalidated it. The other fixture used a standalone Block statement, outside this parser's admitted syntax, to test shadowing. The corrected shadowing fixture uses nested callback scopes. Those fixture corrections do not relax source, owner or runtime checks.

Real Content's complete strict artifacts exposed separate generation defects: frozen literal-array results widened to `readonly string[]`, and Vue 2 lost several checked Context/Focus/Style types. Their repair and final real-Content consumers are recorded separately. They are not counted as successes merely because ordinary compilation returned an artifact. Resource-exited combined runs remain failed receipts; subsequent single-artifact processes use a 1,024 MB heap because the shared workspace's available memory had fallen below the previous 3 GB heap limit.

The final bounded runtime run completed **69/69** across this 23-case file, the strengthened 24-case lifecycle-module file and the original 22-case frozen-array file, with one worker, no file parallelism and a 1,024 MB heap. Its complete log is `local-owner-frozen-ingress-final.log` in the [local compiler evidence bundle](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-24-sprint2-compiler-local/README.md). The preceding 62-case result remains as a separate receipt from before the public-module input guard was added.

An independent reviewer supplied two closed-wrapper/returned-closure positives and six external-wrapper, getter, array, late-store or external-callback negatives. The positives pass source and cold IR; all six negatives report `PUI1006`. Their authored sources, driver and results are retained as `review-local-nominal-boundaries.*`. The same review's explicit public lifecycle-module input finding is addressed by the separate owner/module-boundary follow-up.

A final bounded TypeScript program checked 15 changed source/test roots and their complete imported graph with **zero diagnostics**. Its first run found only the new artifact helper's overly broad `profile: string` annotation; the helper now names the actual generated profile union. Both the red and final reports and the exact driver are retained. Generated-artifact checks are separate from this source/test program.

## Remaining boundary

The full real Tabs Root is still unsupported. All four Web probes stop at Base `tabs/root.proto.ts`'s `disabledExpose as {get?:unknown}` assertion in `readTriggerSnapshot`: an opaque object does not yet establish the checked member provenance. The independent provider is an explicit fixture for Content's actual Context contract; it does not substitute for Root's trigger discovery, selection or keyboard behavior. This slice does not establish full Tabs, native/AT support, independent differential coverage or the original complete library/profile denominator.
