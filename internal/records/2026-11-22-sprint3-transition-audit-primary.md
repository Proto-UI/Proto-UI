# Sprint 3 Transition audit primary recovery

## Original native result remains unchanged

The Brutalist intent shard from candidate `830287f95959a4a1a4fb797df68b0bd6889e0bae` contains 144 raw frame attempts, 136 matched PNG/fact frames, 24 observed runtime/theme cases and eight unresolved cases. Its archive is 28,565,960 bytes with SHA-256 `4debcf9292d25db43dd59a52bff67d29739d780978209d45500fdf0b0d5dc490`. Its `candidate/runner.source` is the original runner, SHA-256 `a81872ed92c964a52c147f34f396819672823f246f10762e1a626f6c34e79baa`.

All eight Transition cases failed before their first screenshot at `capture:rest`: `Interactive anatomy has no current primary target.` The failed attempts retain null image/fact paths. The original `primary()` omitted Transition and returned null without selecting any element. This identifies an observer prerequisite defect; matched frames for other families are not contrast or visual acceptance.

## Exact control and unchanged scope

The actual shared recipe `apps/www/src/content/docs/transition-demo.shared.ts` renders a passive Transition presence region and three public controls: `enterBtn`, `leaveBtn` and `completeBtn`. Its setup connects those controls to `controls.enter`, `controls.leave` and `controls.complete`. The Brutalist projection manifest explicitly admits `brutalist-button` as an auxiliary prototype for this recipe.

The audit now selects the exact `brutalist-button` with `data-demo-ref="enterBtn"` and `role="button"`. Selection remains strict, with no `first()` fallback. Whole-recipe anatomy and the original current owner/generation checks still apply.

The planned journey remains **rest → hover → keyboard-focus**. These frames observe the public Enter control's visual states. They do not establish motion, timing, phase transitions, interruption, disposal or the presence region's visual behavior. Those conditions continue to require their separate Transition consumer evidence. No recipe, protocol, Adapter or public host declaration changes in this repair.

## Discriminating observer regressions

Eight focused checks use the actual documentation producer, recipe, installed runtimes and serialized production probe, with controlled geometry/style inputs. All eight fail against the original missing branch; all eight pass against the repaired branch, with a zero process exit. Negative controls retain rejection for missing/ref-altered, wrong-part, wrong-role, duplicate, foreign-owner and stale-generation controls. Positive controls identify Enter rather than the passive Transition region and preserve actual current owner attribution.

```sh
NODE_OPTIONS=--max-old-space-size=512 corepack pnpm@10.32.1 exec vitest run \
  apps/www/test/contrast-projection-identity.test.ts -t 'transition primary/' \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

The verified repaired runner SHA-256 is `7c155ce512fc416b195b7fc35a0f34769b0f1c02b3ce96e64aa75f8f863f4880`; the test source SHA-256 is `27128689406d9c36ccb7f6308c8b4c98c5e5e83bd12c2eb4b830966987aeb148`. Old-branch and repaired-branch receipts remain separate in the implementation handoff. These are observer regressions, not native input or paint acceptance.

## Required native follow-up

Run `PROTO_UI_CONTRAST_FAMILIES=transition` against the integrated candidate's independently supervised source-bound server. All **four hosts × two themes** require fresh terminal results, retaining the original three planned states, failed states and any unattempted states. There are 24 planned frames if every case completes. The original eight failures remain historical.
