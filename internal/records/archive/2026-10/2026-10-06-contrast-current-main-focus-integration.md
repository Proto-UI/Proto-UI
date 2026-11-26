# Contrast carrier: accepted main and complete Focus dependency

## Source and integration boundary

- User-directed continuation of #775. Audit-only alternate-paint source: `6956b9a818fcb6b1868144104b45c7c3b6fd9d37`.
- Accepted main checkpoint: `405112ed2cbae56cff6e178d9cb4d5d93b930fe5`; #824 budget acceptance is no longer pending.
- First normal two-parent merge: `310691efce3a9487cad5a1f76cc70ae9809e1805`, tree `9a531076b06b0af7472f207aa52d15afe0fb304f`, parents 6956b9a8 and 405112ed. This object is carried as history; no intermediate branch update or separate CI claim.
- Complete published #832 dependency: `fd6eebd24d17747d4d26c9a4da7e343dfbedc97a`, tree `de91c56dba402f1eeb19f5a2a1275fea7c37e580`. It includes its original author history, readiness fanout, Focus supersession, React startup cleanup, Text Control change repair, and the Vue2 retained-marker/WC portal-parent release fixes, then accepted main.
- The second normal dependency merge has no conflicts. All 24 incoming delta blobs exactly match fd6eebd2. The complete `packages/adapters`, `packages/modules` and `packages/runtime` directories match that published dependency. Earlier four-file Text Control propagation from 20717674 was deliberately narrower; it never meant all later shared source was already synchronized.

## Three first-merge conflicts

1. Astro plugins retain both opt-in contrast source provenance and accepted website bundle graph collection.
2. Base view-epoch owner retains main's attach-failure rollback/version guard plus the carrier's detach complete-cleanup behavior. Final shared base blob: `80c19e2d5ea89c4d26436025984374ef9ce477d6`.
3. WC adaptation keeps current readiness/cleanup transactions and main's material binding, final style sink, owned visual surface and adopted-document update. The complete dependency merge then carries the entire four-Adapter readiness repair, rather than picking only one WC callback. Final WC adapt blob: `19fa44a488a98a1f3e55bba16986550a31ddaaad`.

No blanket ours/theirs resolution, forced branch update, unpublished UI work or protection change. Audit-specific probe/runner and their strict identity, calibration thresholds and declared ScrollArea limitations remain intact.

## Validation and remaining boundaries

- First merge: 95/95 base/WC lifecycle, material/reentry and teardown controls; public documentation/audit controls 196/196; types 463 files, zero errors/warnings.
- Final dependency combination: public controls 196/196; types 463 files, zero errors/warnings. Full local general Vitest selection: 656 files passed, 3 skipped; 4987 tests passed, 34 todo (5021 total). Native/aggregate CI remains new-head evidence debt.
- CI runtime wrapper correctly refused a local `general` invocation without a workflow run ID after its 120 orchestration controls passed. Local general tests instead use `createRuntimeTestPlan([], { phase: 'general' })` with its unchanged no-browser arguments, via Vitest directly; no fabricated GitHub receipt/context.
- Fresh eleven package measurements on the complete combination: Runtime 69072/69200, React 90663/91029, Vue 90441/90800, WC 99511/104500 gzip bytes. Lucide X 1735/3000, Lucide root 635820/700000, Core 5153/6600, Base Button 3779/6000, Shadcn Button 4625/7000. Consumer light-DOM 103604 and direct-shadow 103608 are diagnostics. Nine budget gates pass; no limit changed here.
- The unmergeable intermediate 6956 head produced no native workflow run; its six-source guard therefore has no native pass claim yet. New combined-head CI must execute the nine added controls (39 calibrations total) and actual component families.
- Previous 5025496d images and 22 successful CI jobs remain historical source-bound evidence. Eight ScrollArea known-unsupported cases and forty unexecuted targets from that run are not assumed to be the new run's counts. #852/#853 remain explicit measurement/journey follow-ups. Vercel quota status and independent approval remain separate from Actions results. #832 must be accepted before dependent integration.
