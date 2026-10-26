# Historical #1005 diagnosis

The following original record is retained from #1005 at `4ecb49e09e9ebda35a76d5d768ec25b764572a01`. Its preparation and current-state wording refer to that carrier, not the subsequent #955 combined tree.

# Language selector bundling: complete-preview delivery diagnosis

Recorded 2026-10-25 UTC. Related work: #933, #982, and the website inventory delivery follow-on #999.

## Reproduction and classification

At #999 head `8be2ca58c7017ca037ea94170b9be7967fd6b744`, [the canonical docs-preview job](https://github.com/Proto-UI/Proto-UI/actions/runs/40165610490/job/121085918036) checks out the exact head, builds651 pages in62.51seconds, then rejects the complete ZIP because expanded size exceeds104857600 bytes. The log does not disclose its total expanded bytes. Compilation succeeded; delivery admission did not. Do not describe this as a successful preview, a compiler semantic failure, or a missing-check pass.

This uses the delivery/installation distinction recorded in the [cumulative composition audit at exactee40](https://github.com/Proto-UI/Proto-UI/blob/ee40d097383321316237210f799c6c73e3e07768/internal/coverage-matrices/composition-delivery-parity.md). That record is on the separate #1001 branch; this link is evidence context, not a source dependency or claim that its changes are included here.

## Existing repair extracted, not reimplemented

The production repair and two tests are identical blobs from our existing [#982 commit e394249](https://github.com/Proto-UI/Proto-UI/commit/e394249a4b1ec75e89154911224e7b5648120a1e). Both current main4d075 and #9998be retain the original LanguageSelect blob97edb99 and test721c716. The inline initializer repeats per rendered instance/page; moving it into the existing Astro processed module shares its payload while keeping both controls and existing per-root, DOM-ready and Astro-page-load lifecycle behavior.

Exactly three existing source/test blobs are reused, plus this diagnosis. No feature/UI component, content, route, archive budget, assertion, dependency, lockfile or security setting is removed or relaxed. Context snapshots, Rhea/profile changes, Header/sidebar close repairs and reserved runtime-client/native-links/startup-theme tests are excluded. #999 inventory/resolver/config/generated-manifest ownership is untouched.

The preparation initially targeted #999 for current website inventory/build integration order, not because LanguageSelect bundling semantically depends on that resolver. During preparation #999 merged at2026-10-25 06:03:38UTC as357068f0f371dd40826b81da43bd4ef5df73bee7. The carrier therefore targets this actual main successor, whose tree is identical to the checked #9998be tree; no obsolete branch is used as a fictitious open stack. Existing #982 keeps the same fix and is reconciled after upstream integration; no duplicate Issue or second completion credit is intended.

## Evidence boundaries and acceptance

Historical controlled evidence:652built pages/3857files were retained, expanded output108082012→104629960 bytes (3452052-byte reduction), and15focused units passed. Later exacta59 hosted complete documentation admission passed. These are historical results on a different closure, not proof that current651page output will fit; the old remaining margin was small and current overage is unknown.

Current preparation checked both changed test files with standalone TypeScript options:0 diagnostics, and transpiled the Astro processed script with0 syntactic diagnostics. This is not a whole-site typecheck or a behavior test. Current preparation retained an actual Vitest startup failure before collection: Rollup native loading is rejected by the unchanged bounded environment with ERR_DLOPEN_DISABLED. No15case current pass or native result is claimed. Exact-head CI must execute the real suites when preceding public-doc/release checks permit; early prerequisite failures are not test passes.

Required acceptance remains full canonical docs build and complete ZIP admission under the unchanged100MiB limit, all current baseline routes/resources preserved, with actual expanded/compressed counts and exact head. Dedicated same-head header/sidebar locale initialization, cookie/storage/navigation and browser screenshots remain uncovered in this small extraction. Existing #982 native evidence and its later sidebar-close fix cannot be borrowed as this candidate's verification. The carrier remains Draft pending required validation, review, DCO and conflicts; this does not waive unrelated red checks or establish long-term bundle capacity.


## Shared-parent carry on #955, 2026-10-25 13:23 UTC

The [designated counterpart decision](https://github.com/Proto-UI/Proto-UI/pull/955#issuecomment-6398116080) selects the existing three-file repair from #1005 at `4ecb49e09e9ebda35a76d5d768ec25b764572a01`, before counterpart-owned native stack synchronization. The inspected parent is `9152794c4aa5a4b48646c353a7042a6ef3b54a61`. Both existing source/test preimages match #1005's parent exactly; the lifecycle test is absent. This carry reuses the three source/test blobs without editing them, preserving their original contribution and sign-off provenance. This record is the only additional documentation path.

Reproduction: [the exact-parent docs-preview job](https://github.com/Proto-UI/Proto-UI/actions/runs/40195139379/job/121174255275) completes the docs build but rejects the complete archive for expanded size above 104857600 bytes. The repair targets duplicated per-instance inline language initialization; it does not remove controls, routes or assets. The gate, its assertions, the source inventory and the 100 MiB ceiling stay unchanged.

Validation performed for this carry is limited to source/preimage and complete Git-tree inspection. No local compilation, build, test or browser execution was performed. The counterpart's 53 focused tests on #1002 and #1005's earlier size result are separate-head evidence, not acceptance of this combined tree. Fresh full docs build, complete ZIP admission with counts, focused lifecycle behavior and exact-head native screenshots remain required. The prior 91 source/server and 21 browser private SSR passes and full typecheck belong to parent 9152794; they are not re-run results on this carry.

The diagnostic workflow is: bind head/base and failed job; distinguish build success from delivery admission; compare the proposed repair's exact preimages; preserve source ownership; carry only the bounded source slice; then re-run the unchanged complete-build/archive checks on the combined tree. Preserve both failed and successful evidence rather than increasing the cap or borrowing historical margin.

The existing private SSR repair, renderer token map, publicSSR false/PUI4001 boundary, all other source paths and original ancestry remain untouched. Four missing lifecycleRationale entries remain a separately coordinated preflight blocker. No descendant ref is rewritten, #984 is excluded, and #998/#1000/#1005 remain open. Native DCO, independent review, other failed checks and integration remain separate gates; this Draft carry is not production publication or merge acceptance.

Co-author by OpenAI Dots

## Shared-parent lifecycle metadata follow-up

On the exact carried parent `eb6d11ef944fff9eabe0424804687f38f8240e2a`, the counterpart added localized `lifecycleRationale.en` to `C-FIELD-TEXTAREA-0001`, `T-FIELD-TEXTAREA-0001`, `C-PLACEHOLDER-COLOR-0001` and `T-PLACEHOLDER-COLOR-0001`. Each rationale retains the existing draft boundary and names the evidence absent from its current synthetic or finite Web coverage. Status, version boundaries, executable mappings, criteria and revision history are unchanged; this is not lifecycle promotion or new conformance evidence.

The real `check:spec-authoring -- --base 90b4de66945aefb2a34310e635a4dbee3e13ea30` command passed, checking all 30 changed catalog inputs against the actual PR base. This resolves the four reported missing-rationale preflight errors locally, not the separate full-build/archive, native browser, DCO or integration gates. Publication and descendant synchronization require their own exact-head receipts.

## Shared-parent current-main composition, 2026-10-25 14:04 UTC

The [bounded counterpart decision](https://github.com/Proto-UI/Proto-UI/pull/955#issuecomment-6398570843) requests an ordinary two-parent source merge into #955: first parent `a296afa27c5be75fcb30e25c935f4ebb0ad80a75`, second parent current main `448c9f84be75cb083c79536528336eaca1946c4d`. This record describes the prepared composition and its verification debt. It is not a claim of publication, a native stack sync, a successful combined build or merge into main.

The unchanged Git merge algorithm reports six conflicts. Five are the four `P-SHADCN-TABS*` entities and `T-SHADCN-TABS-STYLE-0001`: their complete parsed YAML structures are identical on both parents, including criteria, relations, revisions, mappings and lifecycle rationales. Each conflicting scalar-layout block retains the parent wrapping without changing its value; the complete resolved structures equal both originals. The sixth conflict in `packages/prototypes/shadcn/src/index.ts` retains the parent's explicit FieldTextarea value/type exports. The rest of the combined tree is Git's ordinary merge result, not an entire-file ours/theirs replacement or a flattened source replay.

The auto-merged Shadcn token vocabulary is left unedited. Its owning generator is `scripts/styles/generate-shadcn-style-tokens.ts`, which follows `collectFamilyStyleClosure` through family and actual Base value dependencies. Static inspection traces the current-main `leading-[1.1]` and `tracking-tighter` tokens to `shadcn/src/text/root.proto.ts`, and the parent Textarea tokens to `shadcn/src/textarea/visual.ts`. The combined vocabulary retains both input vocabularies. The sole parent verification runner must execute the owning generator's `--check` on this combined source; static union and source references are not a generator pass. No generated output was hand-edited.

The private SSR renderer additions remain intact, including the existing `renderPrefixedThemeCss` variable-declaration behavior and the legitimate token contributions from both parents. The fixture README retains the complete main text plus the parent's prior diagnostic section. The four public SSR profiles remain `implemented: false`; the unchanged `PUI4001` rejection guard and negative test remain intact. Original author and contribution objects remain reachable through the two proposed original parents. The #955-only range has 56 commits relative to `90b4de66`; the counterpart's archived 59-commit portfolio also includes #1001's three separate child commits, which are not imported or rewritten by this source bump.

Only static Git/object inspection, YAML data comparison, conflict composition and source provenance checks were performed on this source seat. No repository build, formatter, generator, unit test, browser test or debugging command ran. Fresh combined catalog/graph and base-aware authoring checks, generator check, full types, complete docs build/unchanged archive admission, original SSR tests and affected native journeys remain required on the designated validation runner or separately bound hosted CI. Prior #1002, #955 and #1005 successes or failures remain historical evidence, not combined-head results.

The counterpart retains native stack #1007 coordination. #1001 and other descendant refs, #984, Issue state, package budget and repository protections are outside this source operation. Keep #998, #1000 and #1005 open. No ready, approval, acceptance or production claim follows from this preparation.

Co-author by OpenAI Dots
