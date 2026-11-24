# Sprint 5: actual GPUI three-tree costs and remaining capability closure

This record supplies separate generated-source, optimized-link and native construction measurements for #1056. It also identifies concrete unused-capability retention relevant to #1055. The measurements are an executed baseline, not an accepted performance budget or completion of the full native operation inventory.

## Actual subjects and source binding

The three independent ordinary Rust consumers are:

1. An authored empty Prototype, compiled through the public `gpui-source-v1` entry.
2. The unchanged original `packages/prototypes/base/src/button/button.proto.ts`, compiled through that same entry.
3. The empty compiled Root containing three instances of that original compiled Base Button and one ordinary native child. It shares one emitted native SDK with the other generated crate; there is no copied Button implementation or special Proto application launcher.

The producer is `packages/compiler/test/fixtures/gpui-ordinary-values/produce-cost.mjs`. The native oracle is `cost-consumer.rs` and the source-bound orchestrator is `run-cost.py` in that directory. The final source receipt has SHA-256 `c97416e2e7a7b38bf88c342e3445deb0f47353876350a3d8630f92be61a2799f`. It retains the actual compiler/core/hooks input hashes, original Prototype inputs, generated package names and artifacts, consumer source hashes, GPUI revision and Node version. The final source-input archive contains the full generated SDK and consumers.

| Generated component | Bytes | SHA-256 |
| --- | --: | --- |
| Empty `Component.rs` | 20,824 | `163af99c7924b04843b5b6269b9f3da449c198d1aff3fd52bd84940ea0884b66` |
| Original Base Button `Component.rs` | 51,247 | `0578945601b1b03eb96811fb639e4fceecb61bf2fca8a83e1c24f7aafccde4d6` |

The shared emitted Rust support totals 691,538 bytes. Counting it once gives 712,362 generated Rust bytes for the empty consumer, 742,785 for the standalone Button consumer and 763,609 for the composed consumer. These figures exclude the measurement application, checked IR, JSON fixtures, manifest/license files and external GPUI dependencies. The receipt separately inventories every supporting artifact; these source byte counts are not optimized binary sizes.

## Native execution and optimized artifacts

The final auxiliary native run executed on Linux with Rust/Cargo 1.98.1 and GPUI revision `62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`, from **2026-11-23 23:36:42 to 23:38:55 UTC**. All three independent packages passed both native tests, giving **6 passed, 0 failed, 0 ignored and 0 filtered**, and emitted **93 ordered construction samples**. Input hashes before and after execution showed zero product-source drift. The full all-feature locked Cargo graph was verified without `--no-deps` or a platform filter. The final lock introduced no new external package/version relative to the reviewed cost-specific lock.

The production measurement uses a separate default-feature optimized `cdylib` retaining native mount/drop symbols. It excludes GPUI test-support and is not a complete OS application. The construction tests use test-support separately and their binary is not used as the production size result.

| Subject | Distinct library name | Optimized bytes | SHA-256 |
| --- | --- | --: | --- |
| Empty | `proto_ui_cost_empty` | 2,606,472 | `fb95d1a49d6911ee0db17eb2ae375173d7d616b6f245cc2713cc0867837a8221` |
| Original Base Button | `proto_ui_cost_base_button` | 3,353,640 | `62f9506ed09338073f33940693c63d3a00d21ebce01f36209af246c266c94b99` |
| Composed tree | `proto_ui_cost_composed` | 9,764,528 | `b3aa49f846f5da368497673eabe77e33fea792244f1b407bbf8b09ad5754ecc6` |

The runner requires the exact three-subject denominator, three distinct library names and matching case/package/Cargo library identity before any native command. It reads each unique output filename. Four deliberately invalid complete input sets independently verified rejection of duplicate library names, a Cargo/receipt mismatch, a wrong case-bound name and an omitted tree. Every control stopped before Cargo or linking; no product assertion was removed.

## Construction and resource observations

The allocator counter measures successful same-thread `System` allocation/reallocation requests during `subject::mount`. An independent 128-byte allocation, 256-byte reallocation and deallocation control verifies **1 allocation, 1 reallocation, 1 deallocation and 384 requested bytes**. Reallocation records the full new allocation request, not a net retained-memory delta.

The real App/Window and counter initialization occur before sampling. Each process records one first construction, then 30 repeated constructions. Formatting, measurement collection, later layout/paint, other threads, OS allocations and GPU allocations are outside the timed/counted interval. Consequently the first sample is not a full application cold-start measurement and requested bytes are not resident or retained memory.

| Subject | First construction | Repeated median | Repeated min–max | Repeated allocations / reallocations | Repeated requested bytes |
| --- | --: | --: | --: | --- | --: |
| Empty | 1.782322 ms | 43.622 µs | 41.712–59.263 µs | 13 / 0 | 5,862 |
| Original Base Button | 2.313039 ms | 249.013 µs | 236.843–298.126 µs | 284 / 3 | 47,069 |
| Composed tree | 4.166396 ms | 735.828 µs | 703.936–988.291 µs | 867 / 9–10 | 144,848–144,912 |

The consumers also independently assert logical resource counts before and after real native layout. The empty owner has zero registered State, Hook, listener, props watcher and native subscription resources. Each Button has three owned States, four Hooks, eight listeners, one props watcher and five native subscriptions; the composed tree contains four logical owners, including its empty Root. Every iteration exercises current generated state/update behavior and then verifies terminal owner retirement. These registration and live-owner checks are separate from the allocator measurements.

## Original failures and corrections retained

| Attempt | Actual outcome | Treatment |
| --- | --- | --- |
| Initial auxiliary environment | `rustc` absent from tmux PATH; execution stopped before compilation | Original failure retained; explicit task PATH/Rustup environment supplied afterward |
| Initial cost dependency closure | Strict guard rejected added `accesskit_consumer 0.38.0` and `hashbrown 0.16.1` | Actual resolved cost-specific lock reviewed and retained; no existing external version was silently changed |
| Initial construction oracle | Old direct `dispose`/`state` calls failed against the actual generated public API | Oracle uses `CompiledComponentHandle` as supplied by production; all assertions retained; initial three release links remain separate evidence |
| Correct API, old library names | 6/6 tests and 93 valid samples, but all three copied binaries had the previous composed `libsubject.so` hash | The old runner's raw `passed` status is preserved. Its binary attribution is explicitly rejected; no old size is carried into the final table |
| Unique library names, first oracle import placement | All three production links succeeded; all construction targets failed with Rust E0753 | The added crate import had preceded the original `//!` crate documentation. It now follows the complete unchanged measurement template |
| Final unique-name and import-order inputs | 6/6 native tests, 93 samples, three distinct validated links, zero product-source drift | Accepted only for the measurements and conditions described here |

The final import-order correction leaves the original measurement template byte-for-byte at SHA-256 `9991cce858e6452ffae6333282bd083c7a988cde3cc3895fc6efd512f2c5ac54`. The final optimized artifacts exactly match the preceding unique-name run's three corresponding hashes, so its read-only `size`, `nm` and ELF dependency observations bind to the final successful artifacts without another execution or a renamed result.

## Concrete remaining software work

Read-only symbol and section inspection prevents interpreting the composed increase as merely the cost of three Buttons. The empty optimized artifact retains `table_refresh` (41,044 symbol bytes), `outward_value::project` (37,853) and `topology_refresh` (17,315), despite no corresponding authored table or topology capability. The composed Button/native-child artifact retains an EXR transfer table (131,076 bytes) and an image decoder entry (43,403 bytes), although none of its authored components declares Image View.

Those figures identify retained code/data symbols, not precise total ownership of all binary bytes. Demangled namespace grouping and the complete GNU `size`/`nm`/`readelf` outputs are retained so an independent reviewer can assess that interpretation. General native paint, detach and topology paths currently retain more support than the selected operation closure requires. This is concrete Compiler/native-support work: narrow reached support while preserving shared SDK identity, native mixing, current view leases and terminal cleanup. A later independently measured change must provide its own before/after input and link evidence. This baseline does not turn that software gap into a human approval or hardware prerequisite.

## Retained evidence and reproducibility

Evidence resides under `internal/records/evidence/2026-11-24-sprint5-gpui-cost/`.

- `native-cost-history-and-final.tar.gz` is **3,078,169 bytes**, SHA-256 `eccc9bf38d66fbe095b229ae0eeeba4023eacb9039770307b410ae6b337c8acc`. It contains 148 original files across six attempts: logs, metadata, actual locks, samples, source receipts and attribution outputs. Its manifest records each original path, byte count and hash. ELF files remain at the explicit source device paths recorded by that manifest; this archive does not embed another copy of them.
- `root-native-cost-doc-order-inputs.tar.gz` is **263,017 bytes**, SHA-256 `1dc7190b3b7fb30866c33420d0efb3ee8a41a4f0951307709050a53f39e9d662`; its import manifest hashes to `10caa4758bcf8dd3d5d5ddabfde0ced55c11fd8beb0efc28121cb2de40cbc47f`. It contains all 40 final frozen producer files, including generated Rust and the actual oracle.
- The earlier input archives and explicit negative-control archive preserve the corresponding original failures and invalid-input witnesses. `manifest.json` lists the complete delivered inventory.

To regenerate, run the checked-in producer through Node 24 with the repository's frozen pnpm dependencies and a fresh absolute output directory. Execute the copied `run-cost.py` with that directory, a fresh evidence directory and a Cargo target directory. Supply the actual Rust/Cargo 1.98.1 and Node executables in the task environment. The runner verifies every producer input and the pinned GPUI graph before using the declared packages. A warm dependency target may accelerate compilation; it does not waive input checks or permit one tree's artifact to stand for another.
