# Follow-up to the first complete regression candidate

This dated record explains the repairs prompted by native [run 44930338506](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506), whose exact head is `031d9b661025312244d31506758eed989cc71f94`. It is not acceptance of a replacement head. [PR #1664](https://github.com/Proto-UI/Proto-UI/pull/1664) was externally marked ready and merged while that cycle was still running. The follow-up starts from observed main `a8bf56087e5836e3c14c153cafbd796bd98bff37` and preserves the earlier failures.

The [machine-readable companion](2026-11-22-native-regression-closeout.json) binds source hashes, original and replacement local receipts, all 19 retained material failures, finite import review, budget measurements and their limits. Final CI receipts must identify the follow-up's own final commit.

The [bounded browser failure ledger](2026-11-22-native-browser-failure-triage.json) retains every failed case from historical shards 3, 4, 6, 14, 15, 17 and 18, with native artifact/log hashes, source references and explicit uncertainty. These seven shards all reached terminal reports without a 900-second shard timeout. Their observations include the fixed fixture premises as well as unresolved paint, initialization, positioning, scroll-policy and animation observations. They neither represent the whole workflow nor count distinct product bugs.

## Material extent has one lifecycle owner

The earlier contact-only expansion change exposed two distinct defects. Normal same-session pointer-up can leave `contact-motion` releasing without advancing the sink's duplicate `releaseUntil` clock. Conversely, held contact under reduced or unknown motion can reserve expanded geometry even though the final frame is neutral. These are product lifecycle defects, separate from observation helpers that still expect expansion at rest.

The sink now derives extent from the same effective motion frame and pressed state that it renders and records. It first establishes ordinary source admission, rereads preferences and applies the existing policy and motion invalidation. A positive extent must then pass source admission for its complete expanded bounds. Those final bounds flow through lease, render, carrier installation and decode verification.

Because the second source read can reenter application code, a changed frame, contact epoch, same-session sample or preference snapshot withdraws obsolete paint and schedules a new frame. It does not cancel the new input session or commit the old frame's styles. Source, overlap, clipping, ownership, decode and preference guards remain in force. The applicable contact and footprint definitions remain **draft**; no lifecycle or acceptance state is promoted here.

Thirteen new local controls cover finite release/expiry, cancellation, static motion policy, source replacement and the second-admission reentry boundaries. All thirteen pass. The four-file local run is nevertheless **177 passed / 19 failed**, exit 1. A clean `a8bf` baseline runs the original sink file as **115 passed / 19 failed**, also exit 1, with exactly the same 19 failed case names. Those existing neutral-bridge, carrier-retry and context-loss observations remain unresolved. Mock GPU/decode controls do not establish native optical results.

## Repair the observation target without relaxing acceptance

The material observers independently derive expected geometry from the committed contact/phase receipt and the original profile formula. Rest has zero extent; held, release and effective pressed states require full extent. Unknown receipts and carriers with the wrong geometry fail. Image identity, immutable decode state, source stability, pixel ROI and contrast checks remain. The controls first recorded **8 failed / 59 passed**, then **67 passed** after the observer repair. Replaying an old artifact is explicitly diagnostic, not a fresh native pass.

Two additional fixture changes restore the intended subject:

- Shadcn passive atoms now identify the unique outer, passive `display: contents` StyleScope and its four original samples. All sample geometry, text and ownership assertions remain. The old exact-four-root readiness predicate caused 16 native failures after that scope was introduced.
- Liquid Select preserves Content's listbox, portal and interaction checks, and requires the original optical result on its unique named `uncontrolledSurface`, with exact prototype and scene ownership. Eight native failures had checked the transparent Content wrapper instead of this paint owner.

Six controls read the real DemoSpecs to verify those structural premises. The separate [native browser premise record](2026-11-22-native-browser-premise-repair.md) covers Liquid boundary negatives and Menubar focus tokens. The [Compiler ownership record](2026-11-22-compiler-native-case-ownership.md) preserves the cold-start timeout and explains why a late continuation may no longer write a misleading PASS. All 20 original Compiler assertions and its five-second product-body limit remain.

The two Drawer cold-entry failures in shard 18 also stopped before their geometry assertions: the isolated fixture registered Drawer and StyleScope but omitted the public DemoSpec's `shadcn-button` dependency. The fixture now registers that actual public definition. A control using the real DemoSpec, registry and WC renderer first reproduced the missing-Button failure and then passed after registration. The missing-StyleScope countercontrol still rejects, and no width/height overrides, native geometry assertions or deadlines change. Successful fixture admission is not yet a native Drawer geometry result.

That same public Button exposed a second fixture omission: the Drawer-only CSS collector missed eight style tokens emitted by the actual composed Button. A shared, finite collector now includes the two Drawer directories and their actual base Button, Shadcn Button and StyleScope dependencies. It does not load a full-family preset. The control requires coverage of the real Button's emitted tokens and their generated CSS. The missing-token red case remains archived. Final control preparation has a separate 30-second `beforeAll` bound; its behavior body retains the default five seconds. The final one-test run passes in 7.85 seconds overall, including setup. The intermediate whole-case timeout experiments remain historical evidence, not the final test policy.

The CI export for Select places its existing failure snapshots under the uploaded runtime artifact directory. It changes evidence retention only.

## Keep bindings tied to reviewed source

Main advanced through theme inheritance and component capability work after the earlier candidate. Two Previewer fingerprints are renewed only after comparing their actual old and new bodies. The sink fingerprint is renewed only after reviewing the lifecycle change and confirming that all 19 literal import edges are unchanged. All 122 finite raw-import hashes and 210 matrix bindings match the inspected bytes. The website matrix's 78 existing rows remain byte-for-byte unchanged, including their states and criteria.

The first diagnostic website scan recorded 21 findings: 19 references to the changing sink body and two Previewer fingerprints. That failure remains in the JSON record. These checks do not manufacture semantic acceptance; final portfolio projections and a full clean-source gate are still required.

The missing inventory declaration and stale declaration of the browser shard count are corrected to match existing executable exports. The complete local type command then passes across 1,259 Astro files with zero errors and 31 hints. This local result does not replace the final native type job.

The first native general report also exposed two collection errors in the Ghost and Popover controls. The new cost fixture had been read through `fs.readFileSync(new URL(..., import.meta.url))`; Vite rewrites that URL for its browser-facing module graph. A real JSON module import now supplies exactly the same fixture to the unchanged validator. Node comparison confirms identical complete 18-shard assignments and cost/capacity vectors.

Local reproduction first recorded two failed suites with no tests collected. Once collection worked, 21 tests passed and one Ghost code-projection check failed: the WC example now supplies props through the public `setElementProps` API instead of an HTML attribute. Its test now executes the actual unique WC snippet with an observed API binding and requires the complete `ghost` props with `disabled=false/true` for the two real elements. The other three runtime attribute assertions and every shared text check remain. The resulting two files pass all 22 tests; that local result does not certify native Ghost or Popover behavior.

## Strict size policy stays strict

The clean integrated main was remeasured using the canonical strict measurement: all **9 of 9** existing probes pass without another ceiling increase. Runtime/Adapter growth since `031d9b` is attributable to the intervening Scroll, AxisInput, ARIA and WC focus-reveal changes. The JSON record retains per-input minified attribution, closure fingerprints, report hash and toolchain. Gzip contributions are not additive.

The remaining gzip headroom is narrow for Runtime, React and WC; WC has 35 bytes at this observed base. This is recorded rather than padded. The new sink body is outside these eleven measured closures. These nine probes do not measure all new component-family surfaces, and the base measurement must not be relabeled as a final-head measurement.

## Review and final acceptance boundary

An independent read-only agent inspected the sink's new admission boundary, compiler lifecycle, locked Vitest runner, fixtures, observers, declarations and source bindings. It found no new P1/P2 or code blocker and independently confirmed the 20 unchanged Compiler assertions, 78 unchanged matrix rows and 19 unchanged sink imports. This is not a GitHub approval or a claim that the aggregate passed.

The final candidate still requires its own complete coverage checks, strict size receipt and native full-cycle inventory. Search, Demo Matrix, Drawer, WC boundaries, layout and material failures retain their original assertions. An interrupted or capability-incomplete lane remains incomplete or failed; an old head's passing lane cannot certify a new head.
