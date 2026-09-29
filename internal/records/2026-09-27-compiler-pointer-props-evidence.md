# Executed Button pointer/props evidence checkpoint

## Scope and authority

Human-assisted work, explicitly requested by the current coordinator. This is a bounded private compiler conformance case, not a spec promotion or general compiler/Adapter equivalence claim. No merge, history rewrite or human DCO signature is authorized by this record.

- Worktree: `pointer-props-implementation` (separate from the preserved implementation checkout).
- Branch: `feat/compiler-pointer-props-evidence`.
- Implementation commit: `7e5205bba2f96e0ee40cdb8d48245211263ab124`. This record's follow-up changes checkpoint metadata only; the PR head may therefore be a later documentation-only commit.
- Publication labels: `enhancement`, `area: adapters`, `area: core`, `advanced contribution`. Final PR/head/CI identifiers and exact-head command receipts are recorded in the project-local `.cache/compiler-pointer-props/publication.json` and the draft PR body, avoiding a self-referential commit hash in this tracked file.
- Pinned dependency: draft #742, `c74b698dc651d11aea842336218de745287deeba`, branch `codex/compiler-layout-hit-browser`.
- Dependency CI: [run 36317065052](https://github.com/Proto-UI/Proto-UI/actions/runs/36317065052), completed SUCCESS at that source head; `test` and `type-check` passed. Public-package release jobs were SKIPPED, not counted as executed evidence. DCO remains author-owned.
- Stack observed before editing: #736 `8e782e0f29b45dc8d517aad054df497b9d284a8a`; #739 `ab8031e2b62809170848035dc015c1efcb22a8a0`; #742 as above. No existing branch was modified.
- Existing installed public-project dependencies are referenced from the new worktree; no dependency install or source edit was performed in the clean implementation checkout.

## Intended finite observation boundary

`button.pointer-props` retains its ten Button criteria. Two already cataloged cleanup criteria (`C-LIFECYCLE-0002-G`, `C-EXPOSE-STATE-0001-I`) are added for the requested terminal checks: twelve scoped criterion oracles, not twelve fully closed contracts. The case adds a held press before disabling and an actual disabled release, then real key deletion, restored activation, leave, terminal cleanup and explicitly synthetic stale-target dispatch.

Both paths use the unchanged Base Button source, one logical owner, React/Chromium/lockfile, consumer CSS and ordered inputs. Seed `20260927` drives safe horizontal pointer coordinates using the existing LCG helper; the action sequence remains registry-defined. No `isTrusted` override is used. Native attempts—including disabled clicks—are issued through Chromium mouse automation, not DOM dispatch. Outward `click` name, void payload and action-associated order are recorded independently.

## Preserved initial red

The initial red is an intentional generated-only duplicate-signal fault, **not a claim that the unchanged compiler had that defect**. Its generated code executes an extra outward `click` at the first pointer release. In an actual Chromium run:

- Reference contracts: all twelve PASS.
- First difference: checkpoint `2`, `up`, path `[2, "data", "clicks"]`, reference `1` versus faulty generated `2`.
- Outward stream: one versus two `click` signals with `{kind: "void"}` payload at `up`.
- Exit: `1`, from the deliberately unsatisfied parity assertion, not missing collection or a code-string-only check.

The red run is retained separately under `.cache/compiler-pointer-props/red/`; exact command, stdout, stderr, initial test and source snapshots are in adjacent `red-*` files. Public review copies are in [evidence/2026-09-27-compiler-pointer-props](evidence/2026-09-27-compiler-pointer-props). Red artifacts are not overwritten by green evidence.

## Current implementation checkpoint

The bounded runner now separates unchanged generated execution from the single faulty generated path. Healthy paths must pass independent oracles before comparison; the mutant must retain an equal two-checkpoint prefix and fail at the exact `up` checkpoint/path. The collector requires a real `button.pointer-props` report. Event expectations use structured equality so payload and order are tested rather than reduced to a count.

Verified locally: focused pointer test PASS; full compiler **8 files / 49 tests PASS**; workspace typecheck exit 0; criterion collection **6 PASS / 1 UNTESTED**, 57 catalog rows. Both pointer paths independently satisfy all twelve scoped oracles across twelve checkpoints. The missing-pointer-report negative exits 1/BLOCKED. The single emitted mutant is rejected at checkpoint 2, `up`, `[2, "data", "clicks"]`, 1 versus 2, after two equal checkpoints. Browser/version, lockfile/CSS/source/harness hashes, seed and ordered inputs are retained in `green-replay.json`.

Commands (with `CHROME_PATH` set to installed Chromium; local run used 145.0.7632.6):

```sh
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/browser-pointer-props.test.ts --minWorkers=1 --maxWorkers=1
COMPILER_EVIDENCE_DIR=.cache/compiler-pointer-props/verified COMPILER_EVIDENCE_RUN_ID=pointer-props-verified COMPILER_POINTER_SEED=20260927 corepack pnpm@10.32.1 exec vitest run packages/compiler/test --minWorkers=1 --maxWorkers=2
COMPILER_EVIDENCE_RUN_ID=pointer-props-verified node --import tsx scripts/compiler/collect-conformance.mjs .cache/compiler-pointer-props/verified
corepack pnpm@10.32.1 -s check:types:workspace
```

**Provenance correction:** the committed `green-replay.json` (`sourceRevision`) and `green-case.json` (`revision`) contain `c74b698d…` because `GITHUB_SHA` was manually supplied during a dirty working-tree run. This value is a dependency/base tag, **not the exact executed tree**. The pointer test did not exist at c74. These retained artifacts must not be described as exact-c74 execution evidence. Their original contents and checksums are preserved, not relabeled.

The recorded source, lockfile, CSS, fixture and harness hashes identify consumed file contents only. The harness hash matches the test later introduced in implementation commit `7e5205bba2f96e0ee40cdb8d48245211263ab124` and present at `4f6ee4d5948684912c9131a2ee2d004b2eac65d9`; that match does not establish an exact commit or clean-tree execution retroactively. See [the separate correction receipt](evidence/2026-09-27-compiler-pointer-props-provenance-correction.json).

Separate committed-head evidence exists for 4f6ee4d5: the producer's post-commit command receipts and raw reports under `.cache/compiler-pointer-props/exact-4f6ee4d5`; main CI [36323808604](https://github.com/Proto-UI/Proto-UI/actions/runs/36323808604), SUCCESS; and the coordinator's independently reported replay of the exact tree (8 files/49 tests, full typecheck 232 Astro files/0 diagnostics, 6 PASS/1 UNTESTED). The coordinator additionally reported generated-only payload and prop-omission mutants rejected with reference contracts passing. Those are independent review results, not extra producer tests or an enlarged finite claim.

## Separate inherited RepoSteward shadow failure

The main `CI` workflow above passed. Separately, RepoSteward shadow run [36323728419](https://github.com/Proto-UI/Proto-UI/actions/runs/36323728419) failed before jobs at 4f6ee4d5: the API reports zero jobs and zero check runs. The same workflow failed at #742/c74 (`36317062624`), #739/ab8031e2 (`36316254048`) and #736/8e782e0f (`36313565533`). All four heads contain identical workflow blob `ba71b4328b6560dcb84c16eef2110856a8af0126`.

Static diagnosis: `.github/workflows/reposteward-portfolio-shadow.yml:31-35` uses `${{ runner.temp }}` in job-level `env`; [GitHub context availability](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability) excludes `runner` there while allowing it at step level. This is an inherited configuration defect consistent with startup validation failure. No annotation/job log was exposed by the inspected API, so this is not presented as a server-supplied diagnosis or a RepoSteward program failure. The workflow is not changed by this pointer/props task. Main CI success does not waive this separate failed workflow or author-owned DCO/review gates.

## Preserved inherited fixture issue

The first full run had 48 PASS / 1 FAIL in the inherited #742 element-PNG equality probe. An isolated diagnostic found matching DOM/styles but differing raster origins: reference x=28, candidate x=273.09375, caused by font-dependent inline whitespace. Applying a shared `body { display: flex; }` input rule made origins x=28 and x=268 and restored exact PNG equality. The new branch includes that one shared layout rule and its explanatory comment; no comparison or visual negative control was weakened, and no other branch was edited. Original/aligned PNGs and geometry are retained alongside the red evidence. All inherited visual controls pass in the final full run.

The first workspace typecheck also exposed absent `vue`/`prompts`/`zod` dependency links in the fresh worktree. Existing installed project dependency directories were linked; no application source or host-wide packages were changed. The subsequent workspace typecheck passed.

## Remaining limits

The CSS is a fixed `base-unstyled-with-consumer-css` consumer fixture, not a styled-family guarantee. Keyboard, retained-owner, nested trigger, portal, other target/version, accessibility-technology and packed-consumer claims are not enlarged by this case. `button.native-presentation` remains uncollected unless separately executed. Issues #732/#733 and all stacked drafts remain open for independent acceptance.
