# Finf Field family source stage, 2026-10-07

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Scope and source

User-directed Finf work in [PR #872](https://github.com/Proto-UI/Proto-UI/pull/872), group 1 Field. Isolated source baseline: `7f4590c66497c4650459fb7e96398affde40be8e`. This stage adds the actual governed Field family; it does not claim Fieldset/Form or complete Finf acceptance. The sole integration owner handles combined source, DCO, publication and exact-head CI.

Six Base atoms are present: Root, Label, Control, Description, Error and Validity. Twenty-four Shadcn, Brutalist, Bootstrap 2.3.2 and Liquid Glass atoms directly consume the matching Base authoring entry. Public package subpaths, six-part workspace CLI facades, projection manifests, lazy imports, ten bilingual pages, navigation and DemoSpecs are included. `C-FIELD-0001`, thirty P entities and `T-BASE-FIELD-0001` remain draft with an explicit release disposition.

Root owns controlled/uncontrolled validity, required/length checks, touched/dirty state and consumer-owned async result leases. Canonical finite control values are explicit; there is no DOM/value-expose inference. `asFieldControl` is the reusable generic reporting bridge; `asFieldTextControl` directly uses existing TextControl and Focus modules for the default editor. Required treats 0/whitespace as filled, false/null/empty string/empty array as empty, and does not trim. Length is UTF-16 code units. Props remain JSON, without validation callbacks or DOM refs.

## Shared module boundary

A separately reviewable ControlLabel anatomy bridge accepts a setup-only family/label-role/target-role tuple, resolves the nearest opaque Anatomy domain and retains module-private pair references. It reuses the existing native input, physical-tree scope, duplicate-binding and `isCurrent` guard; explicit non-null InstanceAssociations conflicts and is rejected. No reference flows through Props or Context. Field Label uses `naming: false` so A11y part relations remain the only naming owner. The default Control retains its own focus operation. This replaced an initial asTrigger shortcut before source handoff.

The narrow Web A11y projection adds `required` → `aria-required` and `errorMessage` → `aria-errormessage`, reusing the existing per-IDREF ownership ledger. Error is linked only while invalid, defaults to L1 detach and creates no implicit live region.

## Verification and failures

The final focused run passed 259 tests across sixteen suites: 24 Field Base tests; 80 actual WC/React/Vue/Vue2 family tests; 10 GPUI peer semantic transport tests; 3 Liquid Glass intent/lifetime tests; 5 CLI/compiler tests; and all affected ControlLabel/A11y suites. These are bounded checks, not the full monorepo suite. Additional actual DemoSpec/manifest validation and native inventory checks are listed in the delivery evidence.

Workspace TypeScript passed. Astro check passed with zero errors/warnings and six pre-existing deprecation hints after placing its config/cache in writable temporary directories. The Base public-package build completed for 13 dependency packages. Prototype catalog, lifecycle authoring and public-doc route checks passed. All 25 native-browser scenarios collect and the runtime runner inventory tests pass (121/121). Neither collection nor peer transport is a native browser/GPUI pass.

Useful failed attempts retained in the delivery log: the initial editor test incorrectly used unstable wrapper-function identity for its Control lease; a module-owned stable logical lease fixed repeated invalidation. Initial semantic style tokens unsupported by the finite compiler were replaced by the existing equivalent hard-shadow/border/ring vocabulary, and Bootstrap's archived error tone became a family-owned destructive token. Initial projection inventory expectations correctly rejected the newly added family and were updated to the exact six-part scope. The first Astro invocation lacked a writable config directory; the supported XDG/telemetry configuration resolved that environment error.

The new module dependency is only `packages/modules/control-label` → `@proto.ui/module-anatomy` (`workspace:*`, link `../anatomy`). Offline lock regeneration could not resolve cached TypeScript registry metadata. The lockfile was deliberately left unchanged; the integrator will regenerate once on the final union and reject unintended package/version drift.

## Remaining real gates

Native Chromium startup remains blocked by socket `EPERM` in this environment, including the integration owner's permitted escalation. The browser journey is unrun and captures source SHA, dirty-state flag, runtime/family, trusted input, accessibility state, geometry and actual screenshots/failures when run in CI. No older screenshot is substituted.

The GPUI peer has no actual physical TextControl host today. Its tests prove the real Field semantics and accessibility facts travel through the existing peer protocol, while explicitly avoiding a native-editor success claim. Native required/invalid/busy/readOnly and describedBy/errorMessage mappings, actual keyboard/IME/AT, layout and optical rendering remain required work. The Liquid Glass Control declares one static editing-surface material candidate and truthful opaque fallback, not a button deformation or native adaptive blur. Intent tests do not prove optical paint.

Next: independently review the shared bridge and dependent Field patch; integrate with other Finf slices without overwriting their registry/manifests; regenerate the single lockfile and combined generated outputs; run exact integrated-head CI, real browser screenshots and native GPUI/AT/optical acceptance. Keep the full Finf completion checkbox open until all nine acceptance dimensions have actual evidence.
