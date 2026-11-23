# Website markup study: reviewed source reference reconciliation

## Original failure

The browser-2-of-18 job in [CI run 45018250847](https://github.com/Proto-UI/Proto-UI/actions/runs/45018250847/job/137199303843) ran candidate `830287f95959a4a1a4fb797df68b0bd6889e0bae`. Its markup study rejected four changed source files before launching its browser. The job retained 31 passes from other suites, one failed suite hook and 17 skipped study cases; those 17 cases were not executed or accepted. No skip was added by this repair.

The existing current reference recorded revision `4d9a621618a63bace047776fbdf9eb7a20685cbc`. Its 28 listed hashes were checked against that exact recovered Git object: **26 match and two do not**. The saved reference records `previewer-client.ts` as `512567c5f376fbc5a55448aae4589fc2d56814c78216d930ea069e5a63149219`, whereas the recorded revision contains `1f5ae6257c394894840badc6c3952d2819d9d937f661f552b5b76fa6960270e6`; it records `previewer-bootstrap.ts` as `5abf6359d556daf21777892ed99cec3b57d18c5102cfcaa9569987ab76086151`, whereas that revision contains `297a53f8a65cac3073858bae809bf985055ff83b4ecbc57c01b15d755891e5fc`. The two saved hashes match the current files, but that does not establish a complete source closure at the old recorded revision.

The complete old reference is copied byte-for-byte to `scripts/coverage-matrices/test/fixtures/website-markup-provenance-4d9a621.json`; its filename identifies its recorded baseline revision, not a claim of full equality. The existing README already documented #1561's layered `previewer-client.ts` hash with the original revision retained. The reference was subsequently rebound by the explicit post-#1704 commit `2bc88aa5803feaf25041c267a9fd6403e007da59`, which updated `previewer-bootstrap.ts` without changing that field. All **28** old-profile file hashes match their actual Git blobs at this latest rebind commit. This recovers the layered contribution's bounded source attribution and preserves its original meaning; it supplies no missing historical execution. The still older `website-markup-provenance-source.json` is unchanged.

## Reviewed changes and responsibility

| Changed source | Reviewed purpose | Responsible source slice |
| --- | --- | --- |
| `CodePanel.astro` | Keep server-rendered source readable before hydration and without JavaScript; hide the expansion control until the client owns it; localize its labels. | `fbf691e1067ec90d0eea0548fe1db3205c475fc1` |
| `InstallCommandCard.astro` | Extract an explicit lifecycle owner, preserve all commands without JavaScript and localize labels; retain the actual manager-specific command. | `fbf691e1067ec90d0eea0548fe1db3205c475fc1`, with formatting at `05dd06174` |
| Base Transition Chinese page | Name the actual workspace `base-transition` target while retaining the matching-version and publication boundary. | `4ac5bf6c3` |
| Shadcn Button Chinese page | Present both actual npm/pnpm stable commands in the shared card; keep current-source features distinct from a published stable version. | `fbf691e1067ec90d0eea0548fe1db3205c475fc1` |

`install-command-card-client.ts` is now a direct behavior owner imported by the card, so its actual Git bytes are added to the current reference instead of treating the extraction as an unchanged dependency. The new reference has 29 sources and records source `4adb6076a6d9e93ddfd6eb02d07ce06c319eb2d2`. These sampled product files are byte-identical to their integrated source at that commit. Subsequent reference/record commits do not relabel a previous browser run.

## Validation and remaining study

The unchanged `sourceBindingIssues` reports the same four discrepancies against the retained old reference and no discrepancies against the reviewed current reference. All 29 current source hashes also match their exact Git blobs at `4adb6076a6d9e93ddfd6eb02d07ce06c319eb2d2`. The existing 36 discriminator tests pass and still require missing, duplicated, unknown, changed and opaque source members to fail. No current-file checksum is dynamically accepted by the expected reference, and no HTML, source-admission, served-source, response-owner or runtime assertion is relaxed.

The reference continues to say `sourceAdmission: unverified`. This is a bounded source review and CI prerequisite repair, not new execution of the 17 browser study cases, a new result for the old reference, proof of transitive/served source, an arbitrary JavaScript data-flow claim, or completion of #834. The next candidate must execute the original study and retain its real results separately.
