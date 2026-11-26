# Coverage timer compilation boundary repair

Date: 2026-10-04. Scope: PR #563, review r4174318453. The maintainer requested continued repair of stalled PRs; this repair does not promote catalog lifecycle or close Website/Harness implementation work.

## Integration

Merge `main@d4bdb66b` into `4369348e` without rewriting either history. Resolve the runtime-test-plan conflict by preserving automatic discovery over all four Vitest include roots. The incoming Shadcn Input browser fixture is discovered automatically rather than restored into a second manual list. Thirteen runtime-plan tests pass.

The only incoming Astro-config delta adds the accepted Shadcn Input sidebar entry. Resolver and plugin semantics remain unchanged. After inspecting that delta, set the fixed reviewed resolver-configuration fingerprint to `90ac61e7134b84376dfef9e4db1a75640c25364e16122b7e56806f0388fecfc9`. Unknown configuration mutations remain rejected; the checker never refreshes its fingerprint from candidate input.

## Internal causal evidence

Before repair, a Website/Harness fixture containing `setTimeout("import('https://cdn.example/runtime.js')", 0)` passed consumer-wall validation. Browser timer string handlers compile source, but the graph builder emitted no runtime-compilation edge. The new negative fixture failed for that missing rejection before implementation.

The scanner now recognizes unshadowed `setTimeout`/`setInterval`, qualified browser globals, and bounded aliases. Direct calls, `call`, `apply`, `bind`, and `Reflect.apply` validate the actual handler slot. A timer bind without a fixed callable handler is unverified. Static arrow/function expressions, immutable local aliases, and unreassigned local function declarations are callable evidence. Unknown values, imports, type annotations, defaults, conditional expressions and mutable bindings do not prove callability and remain unverified. Callback mutation checks include ordinary/compound assignments, destructuring, update operators and loop assignment. These are bounded source checks, not evaluation or whole-program inference; conservative rejection is intentional.

A second red probe demonstrated the `call` invocation bypass before that form was repaired. Positive controls retain callable forms and shadowed/business timers. Both Website and Harness consumer walls are exercised.

The real matrix identified three unresolved callback arguments in existing Search, TableOfContents and browser-harness code. Their native timers now receive actual arrow callbacks invoking the existing callback. This removes a string-compilation path without granting an exception for unverified callback parameters. The change does not alter rendered UI; no unrelated or historical screenshot is relabeled as new evidence.

## Verification boundary

Focused timer probes pass; an intermediate full checker suite passed 638/638 with no skips, including the resolver negative controls. Final full-suite and real-matrix results, exact pushed SHA, fresh required CI and independent review are recorded in the PR evidence comment. Earlier-head results are not treated as proof for a later source. Production bundle and full browser CI remain necessary before integration. No merge is performed by this repair.

Co-author by OpenAI Dots

## Type-check follow-through

The first published repair's full workspace check rejected `resolve()` because the inferred polling promise requires a value; its runtime value is explicitly retained as `undefined`. The subsequent full Astro phase exposed the missing `IdleRequestCallback` deadline in the existing Search/TOC timer fallback once it became a direct callable invocation. Those fallback callbacks now receive `{ didTimeout: false, timeRemaining: () => 0 }`: the timer has no known idle budget, and no request timeout was supplied. The two exact source fingerprints are refreshed after this bounded repair. No type assertion or disabled diagnostic masks the missing arguments. Earlier failed runs remain failure evidence, and final exact-head types/CI must pass independently.
