# Proto UI 0.3.0-alpha.2

> Draft release notes. This version has not been published. npm packages, the Git tag, GitHub prerelease, dist-tag and immutable snapshot evidence remain separate release steps.

Proto UI 0.3.0-alpha.2 opens the next 0.3 alpha preparation train for the Control Label repair candidate. All 47 public `@proto.ui/*` packages use this exact version. Stable `0.2.0` keeps its existing release identity.

## Control Label repair scope

- Clarify the shared association boundary used by public `createControlLabelRef()` consumers, Runtime Adapters and independently generated native source graphs.
- Repair native source compilation for opted-in controls while preserving the target's naming, activation, disabled, controlled value, focus and lifetime owners.
- Exercise the real Base Button, Toggle and Label definitions through the four Web source profiles. Independent consumer checks distinguish compiler admission, ordinary framework imports, mixed Runtime/compiled association and real native input evidence.
- Preserve the existing private Web Component SSR experiment for unpaired Button definitions through an explicit client-only hydration mode. Hydration installs the real association helper; server Props, options, markup and carriers reject association transport. Public SSR profiles remain unsupported, and this repair does not claim server-side ControlLabel pairing.
- Retain located diagnostics for the pre-existing unsupported Toggle Group Root/Item language boundaries. Their typed collection, reflection and publication-queue operations require separate compiler work; this repair does not claim compiled Toggle Group support.

These items describe the candidate scope. The final reviewed source and its actual validation records determine completed behavior; this version declaration does not certify every backend or stable admission.

## Change inventory relative to 0.3.0-alpha.1

- The 0.3.0-alpha.1 train published 43 public packages on 2026-09-20, as named by its published `package-bom-0.3.0-alpha.1.json` release asset; its immutable release BOM, localized note, spec snapshot and checksum are attached to the `v0.3.0-alpha.1` GitHub Release.
- The 0.3.0-alpha.2 candidate BOM names 47 public packages, all at `0.3.0-alpha.2`, and every one of them matches a current public package manifest.
- Against the published 0.3.0-alpha.1 BOM, four identities are new in this candidate: `@proto.ui/module-axis-input`, `@proto.ui/module-native-link`, `@proto.ui/module-control-label` and `@proto.ui/module-table-structure`. The registry holds no npm package under any of those four names and no `0.3.0-alpha.1` version for them, so each still needs its registry bootstrap and protected-workflow configuration before this candidate can be published.
- No package of this candidate resolves at `0.3.0-alpha.2` in the registry, so the candidate is not published.
- The remaining content scope is the Control Label definition and compiler repair described above.

## Known issues and acceptance state

- Same-candidate consumption acceptance is still missing. No candidate SHA is frozen, no rehearsal or consumer receipt is bound to one SHA, and the 24/24 four-Web native consumer result recorded on 2026-11-15 belongs to an unfrozen candidate. The 18/18 `component-consumer-repairs.browser.test.ts` React and Web Component consumer cases and the Drawer/Command density suite results stay bounded to the recipes they exercised.
- A trusted complete regression baseline is not restored. The 2026-11-16 blocker list records 7 of 8 browser shards reaching the 900-second inner limit in cycle 43812576775, and the later cycle 43837651044 again left seven shared browser shards terminated at 900 seconds with browser5 at 7 failed / 202 passed / 17 skipped and the Drawer/Command density suite at 56 failed / 56 passed. The bound source line includes the browser-shard balance change (#1482); no complete trusted cycle is recorded for it.
- Open interaction blockers from that list are partly repaired and partly open on the source commit this note is bound to (`0f0955a9`). The family-switch portal seal repair (#1480) and the Tooltip composition and horizontal Drawer consumer repair (`155d6d206`) are contained in it, while the Tooltip redundant tab stop (#1455), the accessible-name and host-appearance channel (#1454) and the Search journey closure (#848) were still open issues when this note was written (observed 2026-11-18). The consolidated 0.3 regression repair pull request #1490 was open at that observation and its head is not contained in the bound source commit.
- Compiled Toggle Group Root/Item, public SSR profiles and server-side ControlLabel pairing remain unsupported within this repair scope, as stated above.
- The coverage matrix remains a non-normative inventory on an older baseline and must not be cited as release evidence for this candidate.

## Version and lifecycle

The public package set remains globally exact. `@proto.ui/compiler` remains private tooling and is not added to the release BOM. The scoped lifecycle disposition retains the reviewed Control Label and target entities as draft, with independent native-input, lifetime and assistive-technology admission still required. Other catalog drafts remain visible in the lifecycle report and are not given blanket dispositions by this preparation.

## Publication status

This preparation does not publish packages, create `v0.3.0-alpha.2`, move npm `next` or activate `V-PROTO-UI-0011`. Package-local alpha.2 installation examples describe the unpublished candidate; website availability statements continue to follow the last verified release. Publication requires a complete rehearsal over the final reviewed package set, protected release from `main` and a separate immutable-evidence review.
