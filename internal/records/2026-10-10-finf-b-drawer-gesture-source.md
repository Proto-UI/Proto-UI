# Finf B: Drawer normalized drag and snap source increment

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

Date: 2026-10-10 UTC. WIP source, not Finf acceptance.

## Delivered

- Base Drawer Handle is a dedicated input atom, with direct shadcn, Brutalist, Bootstrap 2.3.2 and Liquid Glass projections. The grab region uses the shared AxisInput seam against the nearest Drawer Content geometry. Public inputs remain dimensionless; no raw DOM, pointer coordinates or custom drag transport in portable code.
- Content owns controlled/uncontrolled `snapPoint`, positive normalized `snapPoints`, `dragProgress` preview, `dragging` and percentage style projection. It emits snap requests without taking over a controlled owner. A refused controlled close restores actual owner extent.
- Drag directions map to all four edges. Completed movement under `dragDismissThreshold` requests Root close. `dragDismissible=false` disables handle/drag dismissal only, retaining explicit Close and existing Escape/outside protocols. Keyboard Handle is a named separator with inward/outward arrows and Home/End.
- Pointer cancel, disabled policy, side/owner changes and detached input discard unfinished drag; panel controls do not become grab surfaces.
- Continuous presentation uses exposed `offsetPercentage` to `--pui-offset-percentage` and four statically collected `translate-*-[calc(...)]` recipes. Runtime-generated per-position token strings were removed before this source commit because they have no generated CSS rule.
- Five real DemoSpecs now include Handle, half/full points and announced committed size. Ten zh/en docs describe the bounded protocol and remaining acceptance.

## Dependencies and integration

Apply this owned source commit after shared AxisInput source commits `fe5f7552b978beaca7ef9718f932578035da9361`, `9415c16bfe8cf7ce966f2527fc8c658950fe6ed0`, `5723e028e3d2bf1b1527f0ebceb7fc6aabb52058`. They were cherry-picked locally without conflicts; do not duplicate them on the integrator branch.

See `2026-10-10-finf-b-drawer-gesture-integration.json` for the five new prototype exports/IDs and existing demo/doc paths. Shared package/family indexes, prototype registry and CLI part lists remain integrator-owned.

## Verification and development failures

- Pinned offline `pnpm@10.32.1 exec tsc --noEmit -p /tmp/finf-b-overlays-tsconfig.json`: passed, 15 owned overlay feature source directories. This is narrow source typing, not a whole-project build.
- Initial focused host run failed on an invalid authored `focus-visible:` token, then on a missing required Root context subscription. Both source defects were corrected; no assertions were removed.
- Focused 8 Drawer behavior tests plus prior 10 overlay tests passed before the continuous CSS teardown assertion was added.
- Current 10-test Drawer file: 9 passed, 1 failed. Fixed translation source collection, light/shadow CSS lowering, actual numeric CSS variable updates, four edges, controlled refusal and input interruption pass. The remaining assertion observes `--pui-offset-percentage:45` retained on a fully disposed detached WC after instance created/disposed counts balance. Shared expose-state projector teardown was reported to integration; the assertion remains red, not skipped or weakened. Stale pointer input emits no further snap request.
- Ordinary unresolved Astro base tsconfig warning and existing AlertDialog missing-description startup warning remain logged, not silenced.

## Remaining gates

Real-browser gesture/visual receipts including full-content access at partial snaps, native input/GPUI, compiler lowering, packed consumers, full catalog/contracts and independent acceptance remain pending. Velocity fling is not implemented or claimed. Source-level behavior tests use synthetic panel geometry. No lifecycle/matrix advancement, native build or final Finf completion is claimed.
