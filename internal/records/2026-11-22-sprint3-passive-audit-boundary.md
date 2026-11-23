# Sprint 3 passive audit authored boundary

## Preserved native result

The original passive shard belongs to candidate `830287f95959a4a1a4fb797df68b0bd6889e0bae`. Its archive SHA-256 is `95303ded4c27553932e093e7f79615d454ebcb6ddc572c5246ad41a3d70e0f84`. It retains 112 raw frame attempts, 48 matched PNG/fact frames, eight observed runtime/theme cases and 64 unresolved cases. Matched capture is not visual or contrast acceptance.

Badge, Card, Skeleton, Separator and Spinner account for 40 of those unresolved cases: each failed `capture:rest` with `Requested target predicate not achieved: rest.` The predicate exists and executed. Their actual failure was `Physical root outside current content lease.` The passive reader included the surrounding Runtime picker Tabs Root and panels because they share projection metadata with the retained consumer. Only the picker controls themselves have `data-projection-control`; that attribute alone does not exclude the surrounding reader structure. The authored expected/missing/extra/visibility checks otherwise found the intended consumer parts.

## Repair and scope

The passive reader now uses the same `authoredProjectionRootFilter` as the existing anatomy and numeric readers through `readSubjectContrastRoots`. It excludes the independently owned reader shell and surrounding picker structure while preserving the retained consumer, detached current-owner parts, foreign roots inside the consumer and extra current-owner body roots. All original count, ancestry, owner/generation, visibility, missing/extra and paint restrictions remain. No passive component becomes focusable, and no component implementation changes.

The other 24 original failures (Scroll Area, Input and Image) have separate causes and remain unresolved by this change.

## Discriminating checks

Before the repair, the four existing actual-producer Badge pipeline checks failed with the same reader-root error: **0 passed, 4 failed, process exit 1**. After the repair, the selected existing pipeline and boundary controls completed **26 passed, 0 failed, process exit 0**. These cover four Badge pipelines, five passive families across four actual host producers, an extra current-owner body root, and shell opacity/filter/clip effects. The negative controls still require failed downstream evidence; no assertion was removed or weakened. Tests outside the explicit selection were not executed in this focused run.

```sh
NODE_OPTIONS=--max-old-space-size=512 corepack pnpm@10.32.1 exec vitest run \
  apps/www/test/contrast-projection-identity.test.ts \
  -t 'actual Badge pipeline|^(badge|card|skeleton|separator|spinner)/.*actual downstream readers|badge: keeps an extra|measures shell opacity|actual pipeline cannot' \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

The exact tested source SHA-256 values are:

| File | SHA-256 |
| --- | --- |
| `apps/www/scripts/contrast-probe.browser.ts` | `01fc987edd7d402e05b2c5a4b3da64827a988020c8e587773a951148a071281e` |
| `apps/www/scripts/audit-brutalist-contrast.mts` | `d257baf8e3cf705f782b314aa939619f488e8e57697d649d6420fadf6ae4f24e` |
| `apps/www/test/contrast-projection-identity.test.ts` | `3c51b8ab3ad23bf712265492696adbd28450358b46e1ee4668e826b0cb88881b` |

The retained local old/fixed JSON receipt SHA-256 values are `c41707c0e0242f8f166007aa35bee275836f664e9bc50f5483b4b8611052ba07` and `bb254cbefae20b76c124f4ba535a0150ae7dd25bca66ea284aff59a5c859a607`. These actual-framework DOM/CSSOM checks establish observer behavior, not native paint, physical assistive technology or component visual conformance. Fresh source-bound native capture for the five families × four hosts × two themes remains required; preserve the original 40 failures alongside its result.
