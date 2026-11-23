# Sprint 2 complete official queue at 50269330

The original sequential Sprint 2 queue passed on the clean integration source `502693304fc8d7509402fdfb586b283681915231` (tree `a7725b5b8507d59551ed54875f9c7a729e6618ac`). The source receipt reports an empty tracked patch and no untracked files. This record binds that result to its source; it does not transfer the result to later commits.

- Workflow: <https://github.com/Proto-UI/Proto-UI/actions/runs/45160089679>
- Job: `137642970502`, `sprint2-consumers`, completed successfully.
- Started: `2026-11-23T10:53:37.351Z`; finished: `2026-11-23T11:14:37.134Z`.
- Artifact: `14814645223`, 62,035,984 bytes, 987 ZIP members.
- Downloaded ZIP SHA-256: `c6a5acb4a47747a38ac028fce5c25dd55b26e060c756f9977b1545ae599c6326`, equal to the GitHub artifact digest.

## Independently checked complete selection

The receipt's full suite selection is exactly equal to the original `d0392fb3` receipt, including the same families, hosts, patterns and expected case IDs. All 13 stages report exit 0, no process signal and no timeout. Public package builds, formal website style generation and the workspace type check passed before the ten functional suites ran.

| Suite                                      | Selected / passed | Failed / incomplete |
| ------------------------------------------ | ----------------: | ------------------: |
| Input                                      |           72 / 72 |               0 / 0 |
| Collections                                |           36 / 36 |               0 / 0 |
| Geometry                                   |           36 / 36 |               0 / 0 |
| Form / Select                              |           36 / 36 |               0 / 0 |
| Ordinary linked consumers, Node / HappyDOM |           12 / 12 |               0 / 0 |
| Compiled native consumers                  |           20 / 20 |               0 / 0 |
| Site                                       |           42 / 42 |               0 / 0 |
| Preferences                                |             4 / 4 |               0 / 0 |
| Collapsible                                |           23 / 23 |               0 / 0 |
| Accordion                                  |           23 / 23 |               0 / 0 |
| **Total**                                  |     **304 / 304** |           **0 / 0** |

Of these, 292 are native browser cases and 12 are ordinary framework consumers in Node / HappyDOM. The existing three-family selection excludes 18 Collapsible and 5 Accordion cases; these remain explicitly `notSelected`, and are not counted as passing cases. No selected case is missing.

## Evidence and remaining boundaries

[The archived receipts](evidence/2026-11-23-sprint2-502-official/source-receipts.tar.gz) contain the exact original overall receipt, all ten report JSON files, all 13 stage logs, GitHub metadata, ZIP inventory and independent count verification. [The manifest](evidence/2026-11-23-sprint2-502-official/manifest.json) hashes each archived member and the complete upstream ZIP. The archive does not repackage the browser images or trace archives as newly reviewed visual evidence.

This head predates the Sidebar fallback radius correction (`d3734c98`) and Bootstrap Text scale correction (`b8edd09b`); both still require their later source's native run. The result also does not certify physical touch, OS IME, assistive technology, non-Web delivery, the real Harness session journey, or historical acceptance. No issue acceptance or author-review status is changed by this record.
