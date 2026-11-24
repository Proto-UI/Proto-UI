# Sprint 1 Search positioning repair

Date: 2026-11-24 (Beijing). This record is a bounded repair, not complete acceptance of #848 or #1178.

## Actual failure and owner

[CI 45238253018](https://github.com/Proto-UI/Proto-UI/actions/runs/45238253018), on `81c103bd462b73910f7279122fab5f282d172d56`, failed three original Search 200% font cases. Original captures and geometry show the Runtime Select popup below its anchor with the last option outside the visible panel. One Shadcn case has panel y=764, height226 and final option y=996..1060 in a1000px viewport. The existing `ownsCenter` and text-bound assertions correctly reject this.

The host published `--proto-ui-available-height` as a prior positioning result. Later geometry measured through that same CSS cap. Content/font growth could therefore appear to fit the preferred bottom side while its options overflowed. The independently reduced host test starts with short content, grows it beyond bottom space, and then shrinks it; the original implementation fails its required bottom→top transition. This is a modeled host-unit geometry witness; the retained original browser captures are distinct native evidence.

`C-ANCHORED-POSITIONING-0001-C/D/E/F` locates the existing flip/shift, available-size and lifetime responsibilities in the positioning host. Its draft lifecycle is unchanged. The repair releases only its previous size claims before a new solve, then publishes fresh values under the current computation generation. It retains author values/priorities and replacement-owner writes. No family-specific exception, timeout extension, fixture answer injection or viewport/inventory reduction is used.

## Independent reentry review

The reviewer supplied real custom-element style callbacks and found three failures across the candidates: restoration could dispose the owner and the suspended call would reacquire a fixed strategy; a synchronous disposal during `setProperty` could leave the new variable because the old code recorded its claim only after the setter returned. A later counterexample also showed a settled old owner resuming after a successor wrote coordinates and overwriting the successor. All original failing reports remain in the separate [independent review archive](./evidence/2026-11-24-sprint1-lifecycle-select-review/manifest.json).

The final code checks computation ownership after restoration. The shared style lease uses a detached browser CSS declaration to normalize the intended value, publishes its ownership record before the observable setter, and checks identity/value/priority after it returns. Every computation also verifies that its available-size lease remains current before publishing coordinates. Old continuations cannot reacquire or overwrite a retired/replaced claim.

## Executed checks and exact limits

The original reduced regression failed1/9 for the intended bottom→top assertion. The first full positioning run passed294 tests, but independent review subsequently found two reentry failures and then the successor continuation failure; that earlier green is not final acceptance. The final positioning run passed **300/300 across21 files**, with0 pending, including six independent ownership controls. The earlier299/299 run is retained as a historical stage before the third finding. The first attempt's incorrectly modeled viewport is retained separately as a fixture error.

The actual command was `corepack pnpm@10.32.1 exec vitest run packages/modules/positioning/test --no-file-parallelism --maxWorkers=1 --minWorkers=1 --reporter=default --reporter=json --outputFile=/workspace/scratch/62ffef219b8e/search-positioning-final-successor.json`. Source snapshots and raw reports are in the [manifest](./evidence/2026-11-24-sprint1-search-positioning/manifest.json). They bind the repaired slice after the runs; they do not claim an entire final committed-tree check.

The new source/test files enter the Sprint1 focused checks. Search disposal's12 native cases enter both the complete runtime inventory and the existing dialog-observer selection. The original420s outer lane,180s ownership lane,80-minute total selection,1000ms production publication and60000ms Matrix initialization limits remain unchanged. Any exhausted outer lane must retain a failure, not a skipped/pass substitute.

Actual current-candidate Search200% layout/hit-testing, all host journeys, production publication, and the complete scheduled regression still require native CI. The local Chromium launch fails before page execution with `socket() Operation not permitted`; no native pass is inferred from these unit checks. Physical IME/AT is not represented by this repair.
