# Boundary and Overlay current-focus observation

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

2026-10-10 UTC. Bounded shared capability on base `f68fad4321364c96f8a89b3304bded0000e8794c`; component consumers, independent acceptance and browser/native evidence remain separate.

## Actual change and authority

- Extend the existing draft `C-BOUNDARY-0001`, `M-BOUNDARY-0001` and `HC-BOUNDARY-CLASSIFICATION-0001` path with setup-only, idempotent `observe('focus.move')`. Event still owns native listeners, callback scope and lifecycle gating. Boundary publishes `observation: 'focus.move'` only after current-focus proof and the existing multi-region classifier.
- The optional Web `sampleFocus` bridge checks focusin against the current document/open-shadow active element. Synthetic or reentrantly stale event targets cannot substitute for current focus. Trigger, anchor, content and linked owned children retain the same inside classification; unresolved regions remain unknown.
- Realize `Overlay.configure({ closeOnFocusOutside: true })` through the shared observation, closing with `focus.outside`. It does not move focus or interpret FocusScope.hasFocused history. Components with dynamic alert/owner request policy may consume the same Boundary observation before changing owner state; no component files are changed here.
- Pointer sampling and focus sampling share a scoped press record. The original top owner is reserved before callbacks, including reentrant focus before another boundary's pointer listener runs. A boundary that already delivered pointer outside does not deliver focus outside again for that press. Release, cancellation, a key or a new press opens a fresh opportunity; view and terminal lifetime release scope membership. Synchronous detach/reconnect during delivery cannot discard the in-flight ownership record early.
- Overlay open-state watcher reentry previously allowed the outer close continuation to deactivate a boundary that a controlled owner had synchronously reopened. An open revision guard now leaves the latest nested transition authoritative; the two-layer controlled test verifies that later input cannot dismiss the lower layer.

## Focus timing and limits

This implementation does not prevent default, call focus(), restore focus, or guess focus timing with a timeout. The tests use actual happy-dom focus changes and explicitly emulate a pointerdown/focusin/release sequence. They are not native-browser timing evidence. UI Events describes focusing steps in the native mouse-down algorithm; Pointer Events does not guarantee all high-level focus/pointer orderings uniformly across user agents. Sources: [UI Events native mouse down](https://www.w3.org/TR/uievents/event-algo.html#handle-native-mouse-down), [Pointer Events](https://w3c.github.io/pointerevents/).

The implemented deduplication window is bounded by pointer release/cancel or a fresh key/press. Touch/pen, browser-specific focus after release, closed-shadow internals, browser-chrome focus loss and native browser visual evidence remain unverified. Focus loss with no provable in-document focusin destination does not fabricate outside. Native/GPUI/Compiler backends have no focus sampler added here: the optional missing capability yields no sample and an unavailable-host diagnostic. No native GUI or sandbox-disabling launch was used.

## Verification and failures retained

Pinned offline pnpm 10.32.1, Node 24.19.0, normal repository hooks. Worktree dependencies reused existing local links; no dependency/version changes.

- 21 focused existing/new Module, Runtime, Boundary bridge and four-Web-Adapter suites: 138 tests passed.
- Final focused run after strengthening the two-layer controlled-owner regression: 36 tests passed in 5 suites (8 Module lifetime/fail-closed tests and 7 cases per Web Adapter).
- `check:types:workspace` passed after running the normal website style generator. The first attempt correctly failed because the fresh worktree lacked the ignored generated shadow-style companion; generation corrected the prerequisite without tracked style changes.
- The initial Vue3 run failed because the fresh worktree lacked the existing apps/www dependency link. After attaching that local dependency directory, all four adapters passed.
- `check:prototype-catalog` remains red with 559 pre-existing broad Finf prototype declaration/catalog-debt findings on this base. No prototype or registry path is changed by this slice.
- `check:spec-authoring` initially could not start tsx's IPC socket in this executor. Invoking the same script through `node --import tsx` ran it. An authored invalid implementation kind was corrected from `unit-test` to the supported `module-test`; the remaining report contains only the three existing GPUI submodule file-presence findings for available_space.rs, composition.rs and tabs_t0.rs. No focus-slice schema or relation error remains.
- Full monorepo/consumer/compiler/native CI, browser screenshots and independent acceptance are not claimed by this local commit.

Next: integrate the shared commit, connect the existing Popover Boundary owner-request path, run its five-family component regressions, then verify exact-head browser behavior and acceptance under the parent task's unchanged criteria.
