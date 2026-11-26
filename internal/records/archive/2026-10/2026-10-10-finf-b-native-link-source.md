# Finf B: native NavigationMenu Link consumer

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

2026-10-10 UTC. Source increment, not Finf acceptance.

## Delivered

- NavigationMenu Link declares the shared native-link module; the declaration propagates through the Base AsHook and all four styled projections. WC has an actual local anchor retaining caller content and physical focus; other Web adapter root choices are owned by the shared module.
- Link no longer calls `asTrigger` or registers synthetic `press.commit`. Browser-owned native activation is observed through the native-link callback in a later task. This avoids keydown-driven panel closure before native Enter/default navigation and avoids synthetic Space navigation.
- `href`, `target`, new `rel`, and effective disabled are synchronized as a complete snapshot. Shared URL/rel policy and disabled default prevention remain in the host module. `navigate` carries immutable `href`, `target`, `rel`, `modified` observation; it is not a veto or rerouting API.
- Ordinary same-window activation closes the panel unless `closeOnSelect=false`. Modified/middle-button and `_blank` activation preserve the current page's panel. Command Item remains the existing command protocol.
- Five real demos use existing same-document destinations, retaining native navigation rather than simulating it in a callback. Ten docs describe the ownership boundary, late observation and pending acceptance.

## Dependencies and integration

Shared prerequisite `0e2d0c78df063d856d9a61c43c1dae167af4616f` cherry-picked cleanly. Public current-page mapping also requires the earlier shared A11y patch `bafd08cb`, already present in the integrated tree; standalone cherry-pick previously conflicted with that patch's range-mapping predecessors, so it was not forced into this worktree.

Manifest: `2026-10-10-finf-b-native-link-integration.json`. No new prototype export names or subpaths. Base now directly imports `@proto.ui/module-native-link`; its package dependency and lock importer are reserved for the shared integration owner.

## Verification and retained failures

- Pinned offline pnpm 10.32.1 focused source types: passed across 15 owned menu source directories and their imports.
- Current focused host run: 14 passed, 1 failed. Five Base/style native-anchor fixtures assert one actual anchor, caller children, physical focus, href and unprevented activation; they prove no immediate panel close before the later observation. Additional tests assert Enter vs Space, modifier/auxiliary/new-window behavior, complete href/target/rel/disabled replacement. Existing seven menu tests pass with role checked on the new physical anchor.
- The single retained red is the known missing `aria-current` mapping on this isolated older shared base. Its assertion remains intact for integrated-tree verification, including removal when current becomes false.
- Development source failure: attempted watch on an owned disabled state. Replaced it with the actual source-of-policy context subscription, respecting owned-state authority. All startup exceptions from that defect were resolved.
- The first `_blank` Happy DOM test attempted its local test URL and reported localhost connection refusal. Tests now reuse the shared native-link no-network fixture to disable synthetic frame/page navigation while preserving default-prevention assertions. These are source-runtime checks, not proof that a real browser navigated.
- Ordinary unresolved Astro base tsconfig warning remains, not silenced.

Real-browser URL preview/history and visual receipt, native/GPUI, packed consumer, compiler implementation, complete CI, catalog/contracts and independent acceptance remain open. Shared compiler/native negative admission is preserved; no unsupported emitted behavior is advertised as working.
