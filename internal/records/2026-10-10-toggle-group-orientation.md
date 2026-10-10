# ToggleGroup orientation projection repair (bounded draft)

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Scope and authority

Baseline: `ed78803f1d527a2385baf41970474b77ba93fe71`. Work is local only. The reviewed `P-BASE-TOGGLE-GROUP`, four family Root drafts and `T-TOGGLE-GROUP-ORIENTATION-0001` govern only this direction slice. They do not claim the whole ToggleGroup protocol has been cataloged or accepted. `C-PROPS-0009` keeps existing normalization: fresh invalid/empty uses horizontal; vertical followed by invalid/empty keeps the previous valid vertical; missing releases it to horizontal. Base source, Runtime, Focus, Compiler and CLI are unchanged.

Implementation adds the existing Base string state to `ToggleGroupRootAsHookContract` and one conditional style contribution in each family. Families read `behavior.stateHandles!.orientation`; only vertical contributes `flex-col`. Horizontal retracts it, retaining the exact former tokens. Hook state is borrowed, not a new read-only API; these recipes do not call `set` or `setDefault`. There is no new AppMaker expose or duplicated interaction owner.

## Upstream bindings and visual limits

Static inspection only; no downloaded third-party source was executed.

- Shadcn base-nova `toggle-group.tsx`, retrieved 2026-10-10 from https://ui.shadcn.com/r/styles/base-nova/toggle-group.json: SHA-256 `143ec051e67e2d31729ba87f2a4bd7ab82efe9b82c6e68c0358bc814fbdea997`. Registry is mutable, Git SHA unknown. It has horizontal flex-row and vertical flex-col/items-stretch. This repair addresses the axis, not its broader size/spacing/variant and joined-border recipes. MIT reference.
- Neobrutalism source pinned by prior archive to `3306a802724874a85f93079702b2795370a279d4`, `toggle-group.tsx` SHA-256 `bfce4a9ae80f01cb4083d26d9de8a57d91b63fac0a902fd3363f25c90d971d88`. It uses vertical flex-col/items-stretch, horizontal flex-row. Full family appearance differences remain open; this is not pixel parity. MIT reference.
- Bootstrap 2.3.2 official `less/button-groups.less`: https://raw.githubusercontent.com/twbs/bootstrap/v2.3.2/less/button-groups.less, SHA-256 `be45864865f9e19dc1e76af12d7cc0a1ca19dda5612e5835521ca43f80f05dbd`. Its vertical group stacks block buttons with no float. Host-neutral column projection matches that direction, not all classic adjoining-border/radius details. Apache-2.0 reference.
- Liquid Glass uses the project material contract and Apple's design principles: https://developer.apple.com/design/human-interface-guidelines/materials. There is no asserted official Apple ToggleGroup implementation. Existing material declarations/fallback are untouched; optical rendering is unassessed.

## Reproduction and verification

Evidence is under `internal/records/evidence/2026-10-10-toggle-group-orientation/`. Node 24.19.0, pnpm 10.32.1, Vitest 2.1.9, happy-dom. These are emulated-host observations with synthetic keyboard events, not trusted physical input.

- The original independent audit's six probes reproduced **4 failed / 2 passed** on the baseline. All four failures had `aria-orientation=vertical` but no `flex-col` in authored feedback (`baseline-negative-control.txt`).
- The expanded official 36 cases reproduced **28 failed / 8 passed** before implementation; missing vertical contribution was the common failure.
- After repair, official orientation 36 + existing navigation controls 12: **48 passed**, zero failed (`focused-green.txt`). Covers omission, horizontal, initial vertical, repeated reversible changes, exact horizontal paint restoration, selection/count preservation, malformed and empty values, missing-after-vertical, one tab stop and axis-specific navigation without selection changes.
- Compile-only contract fixture failed initially with TS2339 for missing orientation; focused TypeScript check passes after the contract addition. The positive setter type is deliberately retained. Negative checks reject number values, number reads, unknown state keys and AppMaker orientation.
- Browser launch with normal sandbox and explicit disposable profile failed before any page loaded: `socket() failed: Operation not permitted` (exit 134). No `--no-sandbox`, screenshot substitution, or invented geometry was used.

## Remaining gates

No full-delivery score or checklist tick. Real-browser rendered geometry and screenshots, physical keyboard/touch, native and Compiler composition, packed consumers and independent exact-candidate admission remain incomplete. Source-level style equivalence is not a claim of visual fidelity. Further upstream family recipe work is separate from this minimal axis repair.

Initial global catalog/graph observations before sparse materialization: catalog checker reports 558 gaps, and lifecycle/evidence loading reports three GPUI implementation files not materialized by this sparse checkout in T-AVAILABLE-SPACE-0001 / T-FOCUS-ORDER-0001. All three are verified present in baseline HEAD by git cat-file; this is an environment projection gap, not missing repository source. This slice does not rewrite those records or claim aggregate checks passed.

Broader follow-up: all navigation-overlays tests plus orientation regression: **11 files / 146 tests passed** (`integration-green.txt`). Style preset checks pass for Shadcn, Brutalist and both draft-family token closures (`preset-check.txt`); no generated preset changes were necessary.

Commit boundary: supported `agent:publish commit` was attempted with exact branch/head/staged-tree and the dot exemption, but its live `gh api repos/Proto-UI/Proto-UI` read failed because GitHub CLI has no authenticated account. No local commit was fabricated, no hook bypass was used, and no remote write occurred. Candidate is handed off as a staged tree and binary patch; `publisher-blocker.txt` retains the exact failure. This does not authorize credential setup or an alternative unchecked commit flow.

Workspace-wide TypeScript check passes. The aggregate check initially stopped at Astro telemetry's unavailable home configuration directory; the docs-only retry used a disposable XDG directory and disabled telemetry, then reported two TS2307 errors for shared/links.json not materialized in this sparse checkout (802 files checked). The baseline HEAD contains that file; this is not a ToggleGroup type failure. The normal repository pre-commit hook was also run explicitly and passed (lint-staged / Prettier). Publisher authentication failed before it could create a commit; this hook pass does not imply a commit or authenticated publication.

## Same-HEAD materialization and final validation

Only absent tracked files were materialized from the unchanged baseline HEAD, with each file hash compared against its HEAD blob. This restored shared/links.json, the three initially reported GPUI test files, six further cited source/design files, and the GPUI style_map.rs test. Existing files were never overwritten; no Rust or third-party source was executed, no sparse configuration was changed, and no materialized file changes the staged source tree. Initial red logs remain retained separately from reruns.

The subsequent graph check exposed a real new metadata error previously masked by workspace loading: CASE-NATIVE had no consuming implementation. Independent review confirmed the existing optional-path schema. A native-admission entry is now explicitly planned, required, and pathless, consuming that case and retaining activation/criterion blockers. It has no test body and has never run; neither this record nor the planned entry counts as native evidence. The five implementation source files and all executable regression assertions are unchanged.

Final checks after restoration:

- Full original check:types: PASS, including workspace TypeScript and Astro's 802 files, 0 errors, 0 warnings, 10 hints. The initial missing-file/telemetry failures remain historical observations, not final failures.
- check-lifecycle-authoring against ed78803f: PASS, six changed catalog inputs.
- prototype-inheritance plus catalog-evidence-integrity: PASS, 2 files / 4 tests.
- check-prototype-catalog: still FAIL, 554 pre-existing broader catalog gaps; the earlier 558 count included four missing sparse file observations.

Retained command logs outside the repository include /tmp/toggle-group-spec-initial-sparse.log, /tmp/toggle-group-docs-initial-sparse.log, /tmp/toggle-group-graph-materialized.log (including the genuine orphan failure), /tmp/toggle-group-types-materialized.log, /tmp/toggle-group-spec-final.log, /tmp/toggle-group-graph-final.log and /tmp/toggle-group-catalog-materialized.log. These are diagnostic handoff files, not portable catalog evidence paths. Browser/native execution and publisher identity blockers remain unchanged; no score or admission was increased.
