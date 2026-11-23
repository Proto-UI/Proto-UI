# Sprint 4: original IR10 source recovery and acceptance ledger

The original private IR10 foundation packet has been recovered and independently reverified. Its archive, index, manifest, all 5,225 content objects and retained failure evidence match the identities anchored in [the original #890 receipt](https://github.com/Proto-UI/Proto-UI/issues/890#issuecomment-6222828809). This removes the missing-source obstacle to examining [#913](https://github.com/Proto-UI/Proto-UI/issues/913), [#914](https://github.com/Proto-UI/Proto-UI/issues/914) and [#915](https://github.com/Proto-UI/Proto-UI/issues/915). Original author rights, shared-definition acceptance, an executable public dependency stack and original-candidate technical acceptance remain outstanding.

The [machine-readable ledger](./2026-11-22-sprint4-ir10-recovery.json) contains the sanitized integrity result, all 88 literal definition-reference mappings, the additional shared-boundary definitions, current immutable comparison revision and the 13 delivery nodes. It contains no private absolute paths, original source bodies or complete private manifests. Current public compiler repairs remain independently deliverable; recovery of this candidate does not turn it into their predecessor.

## Identity and custody

| Object | Verified identity |
| --- | --- |
| Original archive | SHA-256 `79c5b57a172b2f74efc350c50af0c1eb9bb24791828fc48175bc28411d812bda`; 38,379,897 bytes |
| Original closure index | SHA-256 `a8d8350b73c7f9c42e5a87be6078c1e3d3869930b4f967e3a1ef5fba8372617f` |
| Original manifest v2 | SHA-256 `35110c1036f441828f060d8fbf239965a8587a99699ead6b5689268b226adb69` |
| Original compiler source | SHA-256 `f2bc1ada0554d37fdf2926dc9f7d16f31fec05dd99a60cf758262215ecf00c8e`; 140 source files |
| Original HEAD | `7ee28b4732970e9df21c409ac19569d16a73c9c3`; IR5 |
| Original planning main | `404a7417ef8dc22c8c7fe6d9ff9f3c8a5d40a17b`; IR5 |
| Original full working tree | IR10, including unpublished source and shared inputs |
| Public comparison base | `dc3b184ba10b0de53e40359c52d012b204b2cd01`; IR7 |

The complete compiler package contains 201 files: 69 match the original HEAD, 74 differ and 58 are absent from that HEAD. Thirteen historical compiler members deleted from the working tree retain their original blobs. A later surviving worktree contains additional changes, so it was not used as the frozen candidate. The retained archive supplies the original bytes.

The user's Sprint 4 instruction authorized recovery and inspection of the existing custody copy. Read access and matching hashes establish possession and identity. They do not establish the responsible original authors' submission rights or supply their DCO signatures. The frozen provenance record explicitly distinguishes task ownership and saved deltas from original authorship. No evidence shows that the current user signed on behalf of those original authors. The archive and full manifests remain in their existing private custody; this change publishes an independently written verifier and a bounded factual summary.

## Reproducible integrity check

An authorized holder of the packet can run:

```sh
node scripts/compiler/verify-frozen-foundation.mjs --packet PRIVATE_PACKET --archive PRIVATE_ARCHIVE
node --test scripts/compiler/verify-frozen-foundation.test.mjs
```

`PRIVATE_PACKET` is the retained packet directory and `PRIVATE_ARCHIVE` is the retained archive file. The verifier accepts the published index hash as its fixed trust anchor. It hashes the archive without extracting it, verifies every indexed artifact and content object, checks exact object membership and Git blob identities, follows repository/installed/virtual-source references, recomputes the compiler fingerprint and checks both dependency graphs. It checks the retained four-debt and acceptance boundaries. It never imports archive code, executes the compiler, installs dependencies or follows the original machine's paths. Its output contains no supplied filesystem paths. Omitting `--archive` verifies the complete packet and explicitly reports `archiveChecked: false`.

The final verifier ran against the original retained packet on Node v26.13.0, supplied over stdin without writing a new remote script. The machine ledger pins its exact source hash. The original retained Python verifier also passed an earlier independent readback in this session. Neither command replays historical tests or reproduces the compiler build.

| Verified set                 |                           Result |
| ---------------------------- | -------------------------------: |
| Indexed artifacts            |                          25 / 25 |
| Content objects              | 5,225 / 5,225; 131,367,939 bytes |
| Repository input files       |                            2,051 |
| Compiler source files        |                              140 |
| Installed packages / files   |                       86 / 2,982 |
| Virtual source-bank files    |                              340 |
| Git blob references checked  |                            3,937 |
| Retained debt evidence files |                          16 / 16 |
| Source graph nodes / edges   |                        128 / 366 |
| Condensation nodes / edges   |               122 / 297; acyclic |
| Delivery nodes               |                      13; acyclic |

Eight small Node tests use newly authored synthetic inputs to distinguish intact closure from same-length byte corruption, missing/extra objects, symlinks, traversal, altered Git identity/reference sizes, graph cycles/missing dependencies, changed failure evidence and invented acceptance. The fixed public entry point rejects even a self-consistent synthetic replacement index. The positive control verifies that reading leaves all fixture bytes unchanged and that source containing an unconditional throw stays inert. These controls validate the tool, not the historical compiler.

## Definition inventory and minimum decision requests (#914)

The original packet includes 936 catalog-discovery inputs and resolves 88 literal source references, including five comment shorthands and the explicit State validation question. Combining those references with the seven shared-boundary groups produces 61 canonical definitions. At the immutable public comparison base, 46 definitions have identical bytes, 15 have changed bytes, and none has changed its lifecycle label. The JSON ledger lists every canonical ID, governing repository path, original/current lifecycle, current content hash, literal references and boundary group. The original revision is the anchored full manifest; comparison does not approve any changed revision or promote a draft definition.

| Boundary and owner | Minimum decision / acceptance request | Blocked dependency |
| --- | --- | --- |
| Core privileged atom; Core/Main and official Hook owners | Bind the exact `definePrivilegedAsHook`, context/definition ABI and caller revision to `C-AS-HOOK-PRIVILEGED-0001`, `D-AS-HOOK-PRIVILEGED-DEFINE-0001`, `C-AS-HOOK-0007` and `C-CORE-SYNTAX-0007`. Resolve ownership against that exact revision. | Shared ABI, official callers, source bank |
| Public declaration types; Core/State/Rule owners | Decide the exact AsHook registration/borrowed-state and `WhenComparable` declaration changes under `C-AS-HOOK-0007`, `C-STATE-0012` and `C-RULE-WHEN-0001`. Preserve the distinction between observed and writable authority. | Shared ABI and source-bank declarations |
| Static data publication; schema and Hit/ExposeStateWeb/Table owners | Bind schema validation and the three publication definitions: `HC-HIT-PARTICIPATION-0001`, `M-EXPOSE-STATE-WEB-0001`, `M-TABLE-STRUCTURE-0001`. Establish identity without admitting Module business bodies. | Shared schema/data, source bank |
| Official authored inputs; Hooks/package owners | Confirm exact revisions and contribution provenance for 22 authored inputs and 43 public entries. Existing package subpaths do not by themselves establish the required atom ABI. | Official callers and source-bank producer |
| Existing primitive contracts; Core/Module/Host owners | Preserve active Props obligations, draft Template/State/setup/declaration status and separate host Root. Accept exact dependency revisions before using the candidate's implementation as evidence. | Frontend and independent target realization |
| Native actions and resource withdrawal; Compiler with Input/Focus/A11y/Rule/Host owners | Retain acquired-instance cleanup and resource ownership. Obtain real SDK/input/focus/resource evidence for the actual candidate; source repair is only one input. | Target realization; later native acceptance |
| SSR request/adoption; shared lifecycle/Props/Adapter owners | Define request-only setup/created/render/abort/dispose and browser owner transfer/adoption separately. Existing acquired-instance created-failure cleanup does not define these lifecycles. Preserve canonical `PUI4001` until admission is governed. | SSR admission only; ordinary browser compilation can proceed independently |

`C-STATE-0006-Q-VALIDATION` remains a separate open question about blanket legacy scalar/setDefault/set validation. Finite-range metadata checks do not answer it. The recovered definition matrix is a minimum decision packet with explicit governing sources and owners; it is not an owner approval. The canonical source-reference inventory is also not a proof that every operation satisfies every referenced criterion.

## Original delivery dependency graph (#913)

These are the actual recovered delivery nodes. Their names identify dependency groups, not published commits. Exact public base/head pairs have not been materialized for this candidate.

| Node | Requires |
| --- | --- |
| `SHARED_CORE_ABI` | None |
| `SHARED_SCHEMA_AND_DATA` | None |
| `OFFICIAL_AUTHORED_AND_MAPPINGS` | `SHARED_CORE_ABI` |
| `EXISTING_STYLE_PRODUCER` | None; consume the existing CLI producer |
| `PINNED_INSTALLED_TOOLCHAIN` | None; retained payloads, no new acquisition |
| `SOURCE_BANK_PRODUCER` | Shared ABI, schema/data, official callers, installed toolchain |
| `FRONTEND_IR10_REBIND_BOUNDARY` | Source-bank producer |
| `GENERIC_TARGET_REALIZATIONS` | Frontend, existing style producer |
| `ACTUAL_RUNTIME_REACT_TRANSPORT` | Frontend, shared ABI |
| `PUBLIC_SOURCE_FILE_PROJECT_CLI_ARTIFACT_API` | Generic targets, actual runtime React transport |
| `BROWSER_BUNDLE_WASM_WORKER` | Public source/file/project API, installed toolchain |
| `SSR_REQUEST_AND_ADOPTION_DEFINITIONS` | Separate owner decision |
| `SSR_CANONICAL_PROFILE_ADMISSION` | Generic targets, SSR definitions |

The source graph includes erased type edges and actual cycles; its condensation is the checked DAG. A 13-node delivery graph is not a demand for 13 PRs. The 2026-10-22 updates in #913 and #915 supersede the old four-PR count cap. Real dependencies, per-layer base/head, source provenance, review and CI remain required.

## Actual migration scope (#915)

The recovered migration packet describes a breaking source recompilation boundary. IR10 removes the IR5 hook/context/static-declaration representation and introduces complete source/module/function/type/effect data, a separate source binding and a source-bank digest. The original candidate does not accept an IR5 payload by relabeling its version. It requires complete unchanged source graphs, matching bank provenance and cold full-data rebind. An early invalid-field diagnostic can precede the version diagnostic; a single universal old-payload error code is not promised.

| Affected boundary | Required execution still outstanding |
| --- | --- |
| Source producers and public source options | Recompile complete original graphs, keeping runtime entry distinct from the selected publication. |
| Validator and target emitters | Move all affected consumers together; retain complete IR validation and lawful refusal behavior. |
| File/project/CLI/cache/artifact APIs | Regenerate and re-admit outputs, preserve old bytes as history, and invalidate old identity/cache assumptions. |
| Browser bundle/WASM/Worker | Bind the same frontend, bank and pinned binary/toolchain inputs. A transport DTO version is separate from the IR schema version. |
| Source-bank producer, conformance tooling and compiler docs | Reproduce the declared generation/check pipeline and document the actual supported transition. |

The current user identified Shenko as the real Harness consumer and OpenGreendam/verdant as another real consumer. The parent task's read-only inventory recorded Shenko main `f3fa6f4d` / compiler `f29738eb`, and Verdant main `91a77554` / compiler `e56b2d1a` / GPUI workspace `e5f2f9db`. These are future migration targets and scope inputs, not executed migration results. This recovery changes neither application.

## Four original failures and replay entrances

All original source bytes and 16 evidence files remain preserved. The exact fixture graphs were privately made available to the current semantic investigation after their retained hashes were checked. The results below are historical observations from the original packet, not fresh original-compiler executions.

| Issue | Original replay entrance | Retained result |
| --- | --- | --- |
| [#892](https://github.com/Proto-UI/Proto-UI/issues/892) | Frozen `source-graph.test.ts`, inert uncalled-function declaration case | Original source-graph selection 42/43; eager body admission rejects `globalThis`. |
| [#894](https://github.com/Proto-UI/Proto-UI/issues/894) | Three-file `v2-6-optional-default-callable-retains-real-helper-effect` graph | Strict TypeScript and cold rebind pass, but the `answer = 42` exposure metadata is absent. |
| [#891](https://github.com/Proto-UI/Proto-UI/issues/891) | Two-file `object-rest-complete-owner` graph | TypeScript 5.9.3 TS2322: literal `13` is not assignable to literal `3`. The original remains invalid. |
| [#893](https://github.com/Proto-UI/Proto-UI/issues/893) | Original `abrupt-return.proto.ts` and rest observer getter | Lawful abrupt-return control has zero TypeScript diagnostics and original compiler PUI1006. |

A lawful rest control must be additive, separately named and pinned, and use explicit type annotation with the same runtime semantics. It cannot replace the original graph, cast away its error, trim source or weaken expectations. Primitive own-key behavior, whole Prototype compilation and native execution remain different acceptance layers. Current public-IR7 probes belong in their own source-bound record; their success or refusal cannot rewrite these historical outcomes.

## Exact acceptance updates

| Original condition | Result of this change | Remaining condition |
| --- | --- | --- |
| #913 complete tracked/unpublished inventory, modes/hashes and inputs | Original packet recovered; every retained artifact/object and source fingerprint reverified | Original contribution rights/DCO and independent acceptance before original-source publication |
| #913 compiler/shared dependency split and real DAG | Original source and delivery dependency inventories recovered; graph integrity checked | Materialize actual public layers and validate each real parent/head |
| #914 canonical definitions, lifecycle/revision, owners and ordering | Full recovered inventory, current immutable comparison and minimum decision requests documented | Governing owners must accept exact revisions and resolve the listed semantic/activation questions |
| #915 schema/producer/consumer difference inventory | Original full-candidate migration scope recovered | Execute and accept the chosen migration on actual source/consumers and real dependency parents |
| #891 original graph and TS2322 preservation | Original whole graph and raw red evidence preserved and privately provided to the semantic work | Any new lawful control, fresh diagnostics and whole-source/native acceptance need their own results |

`NOT_MERGE_READY` remains the original candidate's status. The previous parser 47/47 and 376-file typecheck receipts remain historical scoped evidence. This recovery does not claim original compiler/native/browser/Worker replay, original source publication, a new DCO signature, public exact-head CI, independent acceptance or migration execution.

## Agent provenance

Request paraphrase: complete Sprint 4, preserve the original IR10 materials and criteria, and use actual consumers without substituting current IR7 for the old candidate. The ChatGPT coding agent authored the new verifier, synthetic tamper controls and this dated projection under the current user's direction. The retained original verifier was read before execution; the new verifier was independently implemented from the data format. No original private source body was copied into these changes. Internal source identity and diagnostic records are the applicable evidence; no UI image is claimed as proof of compiler behavior.
