# Finf group C continuous layout follow-up

Date: 2026-10-10 UTC. This supplements the earlier source checkpoint without rewriting its observed failures. This is functional source evidence, not complete Finf acceptance.

## Change and rationale

- Resizable Panel now uses the existing exposed `size` number-range projection (`--pui-size`) and one static `basis-[calc(var(--pui-size)*1%)]` recipe. Arbitrary runtime-generated percentage tokens were removed. Portable props/state remain dimensionless.
- The independently owned shared CLI CSS change `82f2e01908b81f372005ef357a4ea6391cbe07a2` lowers `basis` to `flex-basis`. This local branch temporarily includes that dependency; integration should not replay its local cherry-pick duplicate.
- Tests prove static source collection, document and Shadow CSS lowering, actual Web Component variable updates, no disconnected-panel writes, reconnect synchronization, and inheritance by all four visual families. They do not measure real-browser flex geometry.
- Message Scroller now provides a named region via Root `a11yLabel` (default `Messages`), follows updates and clamps negative new-content facts. No unread inference is added.
- Five Virtual List DemoSpecs retain 1,000 stable unique logical keys while generating them compactly instead of checking in 5,000 repetitive string lines. The fixture size and final key are tested.
- Actual Data Table consumer coverage now asserts the `aria-sort` attribute after header activation, alongside the already tested materialized sorted cell value.

## Evidence and known red

- Six focused Group C test files: 48 passed, one failed locally. The remaining failure is the new Data Table `aria-sort` assertion: `null` instead of `ascending`, because this worker branch lacks the integrator's shared mapping commit `bafd08cbeb1f3b08362fc0954230f22d68b0bbf5`. A local cherry-pick conflicted with other shared A11y prerequisites and was aborted without editing shared ownership. The integrator owns replay and a full merged-tree rerun; this local run is not called green.
- Before the shared CSS dependency, the added static recipe test failed on both unsupported `basis` tokens. After the dependency it passes for document and Shadow output.
- Scoped TypeScript covering all eight Base directories, four visual projections and forty DemoSpecs passed using the pinned offline pnpm 10.32.1 toolchain. `git diff --check` passed.
- An initial test used `fileURLToPath(import.meta.url)` under Vitest's transformed URL and failed as a fixture-path error; the collector now receives a workspace absolute path. An invalid-infinity props test was corrected to a finite negative count because the props boundary rejects non-finite numbers before component normalization.
- No native GPUI/Rust run, real-browser visual or pointer acceptance, package-consumer smoke, lifecycle promotion, or independent review is claimed. Existing Collection-provider/native-windowing integration debt and broader evidence gates remain open.

## Integration handoff

No new exports, registry entries, DemoSpec IDs, subpaths or navigation are required. The prior manifests remain valid. Apply this functional follow-up after the prior three Group C commits, with the shared CSS and A11y changes present; rerun the six Group C test files and retain the actual result. Do not treat these smoke counts as checklist completion.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
