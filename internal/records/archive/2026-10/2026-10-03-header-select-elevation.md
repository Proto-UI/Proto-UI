# Explicit Header Select elevation

The approved Header composition groups Runtime and Style Select triggers with raised Button commands. `P-BRUTALIST-SELECT-TRIGGER` remains draft and keeps its upstream-aligned `flat` default. Its additive `appearance="elevated"` projection reuses canonical 4px/4px hard-shadow and +4px/+4px hover/press endpoints; it changes neither Base state ownership nor Content paint. This is a Proto UI extension, not a claim that upstream Select has a raised default.

The homepage's existing `ProjectionCompositionControls` receives `brutalistTriggerAppearance` through `homepage-runtime-client.ts`. The existing composition owner passes it only to `brutalist-select-trigger`, before all four runtimes materialize it. Other families and toolbar-free partial-family recipes are unchanged. Documentation `Header.astro` opts its existing `AdapterSelect` in through the same public prototype prop via `site-shadcn-controls.ts`. No site CSS adds paint or motion. Lock/unlock changes root props; it does not replace the Trigger appearance bag. Reinitializing the WC bridge replays its complete Trigger bag.

## Evidence boundary

Socket-free Vitest/Happy DOM exercises default/removal, elevated hover/press endpoint tokens, disabled state, flat Content, family-specific bridging, and real WC/React/Vue/Vue 2. The real-runtime fixture checks strict physical root/trigger identity, owner/generation, lock/unlock, theme publication, the existing disclosure's compact/desktop moves, Escape and return focus. Its keyboard and breakpoint events are synthetic: these passing tests do not prove browser paint or native hit-testing.

The separate `header-select-elevation.browser.test.ts` probe uses actual public homepage controls and native pointer/keyboard input. Hosted Actions samples both themes, all four runtimes and 1440/390 widths, measures rest/hover/press displacement, hit targets, native focus-ring extent, flat popup, and retained physical Trigger identity across each breakpoint direction. Screenshots and JSON bind route, runtime, theme, source SHA and expectation. It remains unrun locally: this task permits no local browser, build or socket.

`.github/workflows/header-select-elevation-evidence.yml` prepares an exact-source comparison: fixed `8856a7112e86aa974f2ba388c3b8b70417268394` with the existing flat Selects beside raised Buttons, versus the exact candidate head with elevated Selects beside raised Buttons. Only the candidate probe is copied into the baseline checkout; production sources are not patched. The artifact records both subject SHA and probe SHA/hash. Each workflow job uses ordinary read-only pull-request permissions and preserves failures.

## Alternative not implemented

Upstream Button's `noShadow` recipe provides an all-flat design alternative, but Proto UI's current Button API is `solid | surface | destructive` and has no public no-shadow option. A genuine all-flat Header therefore needs a separately governed Button appearance extension and a second exact-source candidate. Do not label the mixed-weight baseline as all-flat, inject site CSS to manufacture the alternative, or claim the upstream API is already supported. If that alternative is approved, reuse this native probe and capture plan against its actual source with a distinct expected Button contract.

No capture or visual acceptance is claimed before the exact-head Actions images are produced and inspected. The parent must refresh evidence after integration with other Header changes.

Co-author by OpenAI Dots
