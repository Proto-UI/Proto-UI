# Search startup: Selection sampling diagnosis and rejected cache

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Observed boundary

Exact candidate `24b54c735dbcfb83d5369e84a9a3f84ba1d638ab`, [run 37876012821 / Search job 113644674485](https://github.com/Proto-UI/Proto-UI/actions/runs/37876012821/job/113644674485), retains 24 passed and 6 failed cases. Artifact `homepage-search-commands-24b54c735dbcfb83d5369e84a9a3f84ba1d638ab-37876012821-1` (11592302236) has SHA-256 `1f9b306a3ae3ea6095eb8f07bd689058b291429b7106894916d4db5b651b4273`.

- Shadcn light 390, light 1440 and dark 1440 miss the unchanged initial-readiness deadline. The startup trace observes active commands respectively 115.0, 315.0 and 242.3ms after that deadline. Later readiness does not pass the original observation.
- The three Docs Shadcn 1280/1440/2048 cases stop at the preceding `role === combobox` 1000ms assertion (browser test line 987). They never reach the runtime text-completeness assertions. Do not describe these as measured text clipping.
- Similar Search readiness failures exist at `c49ae230`, `63a8d424` and `8e8c4ca2`. The Selection lease/native initializer is unchanged from main `169407b2`. This is evidence of an existing readiness-sensitive path, not proof that every later failure has the same cause or an exemption from acceptance. The new Docs failures have no captured initializer profile and remain unlocalized.

## Source-bound diagnostic evidence

The artifact's three `post-failure-startup.cpuprofile.json` files are separate diagnostic navigations, not profiles of the original failed visits or new acceptance runs. Their `withNativeContentLease` self-sampled times are 287.0/440.8/401.1ms. The caller chain is `SocialIcons.astro` top-level initialization → `initSiteNativeControls` → `withNativeContentLease`. Almost all position ticks map to the first `Selection.anchorNode/anchorOffset` read. The lease has no DOM writes before that read; the preceding owner has just performed its composition writes.

Chromium's [Selection implementation](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/editing/dom_selection.cc) routes `anchorNode`, `getRangeAt` and `getComposedRanges` through `PrimaryRangeOrNull`/`rangeCount`, which can update style and layout. A `rangeCount === 0` fast path therefore does not eliminate this dependency. Browser implementation details support the hypothesis, not a portable performance guarantee.

The initializer already filters bound links/ranges through its WeakMap; repeated direct initialization is a no-op for existing owners. Cold startup still moves each eligible owner's authored nodes once into actual passive Surface/Text projections. `SocialIcons` can release/reinitialize on `astro:page-load`, but this site uses full-document navigation and these diagnostic stacks originate at its first top-level call. No evidence attributes the cold failures to that repeat-event path.

## Decision: reject transparent cross-owner Selection caching

No product performance change is made. A microtask-scoped document Selection cache is unsafe even during a synchronous loop: connecting the first owner can synchronously create a Selection in a later owner; that later lease must read and preserve the new boundaries. The same freshness is required after an earlier move throws. Caching the initial empty snapshot loses both cases.

Two regression controls now cover those sequences. Current implementation: 8/8 lease tests pass. A temporary negative implementation caching the document snapshot until the next microtask yields exactly 6 passed / 2 failed; it was restored byte-for-byte. Together with existing native-controls ownership/no-op/cleanup coverage, 13/13 focused HappyDOM tests pass. The focusOffset getter fixture retains the documented HappyDOM 15 limitation; no real-browser Selection or latency pass is claimed.

## Bounded future options, not an implementation

1. An explicit DOM batch needs a finite list of affected owners, per-owner focus and directional Selection ownership, source-node identity/order, exception-safe cleanup and cancellation, plus a defined reentrant callback boundary. The batch must not overwrite a newer callback-created selection or adopt an unrelated ancestor. Merely checking a deferred `selectionchange` event is insufficient for synchronous changes. Any path allowing arbitrary connection/focus callbacks must retain fresh sampling at those boundaries unless it has a proven synchronous version/transaction protocol; instrumenting global Selection methods is not proposed.
2. Compiler/prerender adoption could eliminate initial wrapping/moving only if the browser renderer can retain the exact same connected authored nodes and passive wrapper identities. Serialized lookalike markup alone cannot prove that. Adapter creation, public props/theme updates, runtime ownership, focus/Selection and native event semantics must still run; this is not permission to skip enhancement or redefine ready.
3. Before selecting either change, retain the existing fixed source and profile, add bounded initializer counts and per-owner lease/DOM-move counts to an isolated diagnostic, and compare one reviewed candidate against that source in a predeclared same-environment native cohort. Test empty/caret/forward/backward/cross-owner selections, synchronous callback replacement, nested leases, throw/dispose, repeated init and family changes. Run the unchanged 30-case suite on the exact new head and retain every original failure. Do not retry until green or infer performance from HappyDOM read counts.

Current native Search readiness and Docs initialization remain red. This test/diagnosis increment changes no deadline, skip, production behavior, repository protection or acceptance status.
