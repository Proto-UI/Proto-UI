# Sprint 3 isolated candidate consumption by Shenko and Verdant

## Result and source boundary

On 2026-11-22, Proto-UI candidate `830287f95959a4a1a4fb797df68b0bd6889e0bae` (tree `f7b2851e7e6fa6b7d9e64fd1e687d316a4c51644`) passed the unchanged actual Shenko and Verdant consumer commands in isolated local worktrees. All nine commands returned exit 0 between `2026-11-22T11:41:11.987437+00:00` and `2026-11-22T11:42:42.315328+00:00`.

This is an **isolated explicit-pin adoption experiment**. Neither application's main pin was changed, committed or pushed. It adds candidate evidence alongside the earlier main-pin baseline record; it does not replace that baseline, an original historical acceptance, or a release/native gate. The machine record is [2026-11-22-sprint3-candidate-application-consumers.json](./2026-11-22-sprint3-candidate-application-consumers.json).

| Consumer | Actual application base | Main pin retained | Pin in isolated experiment |
| --- | --- | --- | --- |
| Shenko | `972d87950f2a947ca2965852c5a1cd9496732498` | `f29738eb6a804ccfc58510cc5a5bd1692690716e` | `830287f95959a4a1a4fb797df68b0bd6889e0bae` |
| Verdant | `91a775546ebd21a87d76d76568195a6513437719` | `e56b2d1a3d6b688a1cbc6930dab1d6757304d733` | `830287f95959a4a1a4fb797df68b0bd6889e0bae` |

Shenko main had advanced from the earlier `f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42` baseline when preparation queried the remote. The application Web source, `AGENTS.md` and Shenko development skill have no diff between those two revisions. The experiment used the newer main rather than relabeling the older baseline.

The isolated Shenko `upstream-pin.json` updates only `commit` and `migrated_from`. Its package versions remain `0.3.0-alpha.2`, and the actual upstream lock remains SHA-256 `e374ba03f76079fd191d63c2da1f62861b7e90bbeba64a0b310027fc2c15b7f8`. The isolated Verdant pin updates only `upstream.revision`; its embedding workspace GPUI revision stays `e5f2f9db75e97613232b5c1946333e61fa3828ab`. Its producer still requests `gpui-source-v1` with `gpuiDependency: workspace`.

The producers, pin guards, authored prototypes and existing tests were not edited. The upstream candidate remained clean at the exact tested revision before and after every command. The four original baseline checkouts retained their original HEAD, tree, status, full tracked diff digest and selected pin/manifest/receipt/lock bytes. Exact pin before/after files and patches are retained separately from generated output diffs.

## Actual execution

Node was `v24.22.3`; the package manager was Corepack `pnpm@10.32.1`. Commands ran serially under `/tmp/proto-ui-heavy-acceptance.lock`, then `/tmp/proto-ui-heavy-validation.lock`. Both locks were released after completion. `UPSTREAM` below denotes the clean isolated checkout at `/workspace/scratch/828b7e591003/Proto-UI-s3-candidate-consumer`; the machine record retains every exact argument, working directory, environment value, timestamp, exit code and stdout/stderr digest.

| Step | Actual command or operation | Result |
| --- | --- | --- |
| Upstream dependencies | `corepack pnpm@10.32.1 install --offline --frozen-lockfile --ignore-scripts` | Exit 0 |
| Shenko Web dependencies | The same frozen offline install in the isolated App Web directory | Exit 0 |
| Public packages | `node scripts/build/public-packages.mjs --package @proto.ui/adapter-react --package @proto.ui/prototypes-shadcn --package @proto.ui/cli --json` | Exit 0; 42-package closure |
| Shenko build | `node build.mjs`, with `PROTO_UI_SOURCE=UPSTREAM` and the actual successful public-package JSON as `PROTO_UI_BUILD_RECEIPT` | Exit 0; two compiled authored prototypes, 12 hashed assets |
| Shenko types | `corepack pnpm@10.32.1 exec tsc --noEmit` | Independent exit 0 |
| Shenko tests | `node --test tests/*.test.mjs`, with the existing sorted test-file list | 51 tests, 51 pass, 0 fail/cancel/skip/todo |
| Verdant generation | `node frontend/proto-ui/tools/build-proto-ui.mjs --upstream UPSTREAM` | Exit 0; 20 artifacts published locally |
| Verdant fresh comparison | The same producer with `--check` | Exit 0; fresh compilation matched all 20 artifacts |
| Verdant admission rules | `node frontend/proto-ui/tools/check-proto-ui-rules.mjs` | Exit 0; five existing cases passed |

### Public package and Shenko evidence

The requested dependency closure contains 42 of the 47 public packages and 2,326 emitted files. The five omitted packages are the Vue, Vue 2 and Web Component Adapters, Brutalist and Lucide. This experiment does not claim those five package consumers were exercised. The private source-only compiler is not included in the public package count.

Shenko's own `transport-badge` and `message-bubble` prototypes were compiled by the actual candidate compiler to React DOM source. Its nine adopted upstream families continue to use the existing runtime Adapter; the two delivery routes remain distinct in the actual build manifest. The 12 emitted browser assets include four license files. The complete compiler source digest, build-only bundle, generated components, helpers, provenance and actual asset bytes were read back. TypeScript AST inspection found React as the generated components' sole bare import, alongside their generated relative helper imports.

The standalone typecheck and the existing 51-test suite have separate command outcomes and logs. They are not inferred from an earlier combined shell command or from the earlier main-pin baseline.

### Verdant evidence

The unchanged Verdant producer compiled the App's authored `PitchGestureSurface` unit, regenerated its 20 artifacts verbatim, then freshly compiled it again for `--check`. Twenty is the artifact count for one unit, including its native SDK, manifests and source map; it is not a component or runtime-test count.

Five artifact hashes changed from the retained earlier pin: native owner support, `Cargo.toml`, `Component.rs`, its source map and `provenance.json`. The generated patch and all actual output bytes are retained. No expected hash or generated Rust was manually edited. The five existing admission cases keep the single workspace GPUI dependency and reject duplicate or separately pinned GPUI declarations/provenance.

## Evidence integrity and independent readback

The execution receipt has source snapshots before and after every command and preserves terminal rows for the complete selected inventory. The generic Shenko input inventory includes `web/src` and tests but does not enumerate its separate `web/prototypes` directory. The supplemental authored-source receipt therefore binds all three compiled inputs to their immutable App Git blobs, actual file hashes and compiler-recorded source hashes. They match. The original execution receipt was preserved unchanged.

The implementer's 122 self-readback comparisons passed. Root subsequently performed an independent local readback at `2026-11-22T11:49:53.361731+00:00`, checking the nine command outcomes, source/pin/log bindings, original checkout preservation, authored inputs and retained package/artifact bytes. All 2,395 observations passed. **These are evidence-integrity comparisons, not additional application tests, another execution, formal GitHub approval, browser acceptance or GPUI runtime acceptance.** The machine record binds the actual independent review file and its digest.

One evidence-collector failure is preserved: Node's default synchronous output buffer was too small to retain the 2.30 MB Shenko generated diff, producing `ENOBUFS`. The exact original collector and a logged reproduction remain in the evidence directory. Streaming `git diff` directly to the patch file resolved the collection failure. This changed only the evidence writer; the nine real consumer results, App producers and authored inputs were not rerun or rewritten.

The retained session archive is `/workspace/scratch/828b7e591003/s3-candidate-consumer-evidence.tar.gz`, 2,018,924 bytes, SHA-256 `8816dcbbdb6230cc2eb16e50a7d6456267629b0d99940a516a7fa9c10d31bc3d`. It contains the command receipts/logs, before/after pins, exact generated diffs, 2,326-file public-package inventory and 49 retained actual artifact copies. The machine record provides the individual evidence paths and hashes. The separately recorded root independent readback was produced after this archive.

## Remaining scope

No application main adoption or push occurred. No browser journey, OS input, assistive technology, complete Harness task, Rust App build or GPUI runtime was executed by this experiment. `rustc` and `cargo` were not on PATH in the observed local environment. The 0.3 release gates, exact integrated-source CI/native results and original historical criteria retain their own acceptance work. A later candidate does not inherit this exact revision's successful execution.
