# GPUI numeric accessibility repair

This bounded user-directed repair implements the draft criteria in `C-COMPILER-GPUI-A11Y-VALUE-0001`. It starts from `16393dd0258eccd3953397cd71ad9767063a1593` on an independent branch; it does not rewrite the headless-data/shared-SDK branch or edit emitted Rust.

## Observed failure and repair

A rendered native Slider had no AT-SPI Value interface. Its authored `valueNow/valueMin/valueMax` bindings existed in the owner, but the production `Semantics::write_a11y_info` match omitted the AccessKit numeric properties. Separately, the GPUI accessibility callback discarded its action data and did not map `setValue`. A role or stored owner State could not prove that numeric platform input existed.

The native Element now projects finite numeric value and range facts and keeps the existing disabled/readOnly projection. The real GPUI callback passes its data to the SDK numeric bridge; only finite `ActionData::NumericValue` enters the configured owner-local route. Authored code still owns range, cancellation, revision, disabled and controlled commit policy.

The compiler derives a distinct host payload schema from a preceding checked declaration and rechecks it at the IR boundary. This is structural declaration evidence, not an instance-execution guarantee for conditional declarations. Ingress validation closes that boundary even for direct host dispatch. Review found an initial omission when callbacks declared zero or one parameter; guard selection now follows the checked route as well as the payload proof. Native onceZero/onceOne assertions cover that regression.

## Executed evidence

- Node 24.22.3, pnpm 10.32.1, full frozen dependency installation, unchanged lockfile.
- 107 focused Vitest cases passed across numeric action schema, shared SDK compatibility, GPUI capabilities, native interaction configuration, numeric Runtime transport and the existing Accessible handle contract.
- A focused TypeScript program containing the new compiler test, authored native fixture and Runtime test checked its 738-file imported closure with zero errors. This is distinct from a whole-workspace typecheck.
- Lifecycle authoring checked both new catalog entities against the exact base.
- Six real generated Rust consumer tests passed on Linux with Rust 1.98.1 and workspace GPUI `cyjin-yl/z3rm@e5f2f9db75e97613232b5c1946333e61fa3828ab`. Full offline Cargo metadata contained exactly one GPUI package and one SDK. Tests exercise the actual SDK bridge, invalid input before once consumption, owner detach/disposal, authored rejection, and the production Element's projection into a real AccessKit Node. The node assertions include zero, fractional values, range, State updates, boolean changes and invalid facts.

Native source bindings from the final producer receipt:

| Input | SHA-256 |
| --- | --- |
| `value.proto.ts` | `65edf44ea8a0fb1d64b03f124f11c79a1159227c20a608a171442a87f168a263` |
| `consumer.rs` | `56e1c0f9361cfa084a93e06be3b8f247410ef7412b3af65b9702522dacd35b81` |
| Workspace native SDK inventory | `f83fcd1dbf8bee0a3de1c8f1f8e298d90c60b7544191b69d6dd83ab3a160e774` |

The generated component is `generated-gpui-94940dcdadb49033a6b90fe823c9a63e`. Its emitted Rust and SDK were written by `writeCompilation` and copied unchanged into the consumer. The receipt, full metadata and native log are retained with the execution output under `/home/ezra/proto-a11y-native-consumer-final`; the complete log is `/home/ezra/proto-a11y-native-consumer-final.log`.

## Evidence limits

GPUI's pinned `Window::handle_a11y_action` is private and its test platform does not expose an action-injection entry. The consumer calls the identical bridge used by the registered callback; it does not impersonate a platform accessibility client. A separate real OS setter/readback is required to prove the whole platform route. Native Windows/macOS execution and the default `zed@62e5991` source profile remain CI/platform evidence, not this Linux result.

An attempted whole-workspace `tsc` exhausted its available Node heap. Its failure remains in the working evidence and is not converted to a pass by the focused check. The `tsx` CLI also could not create its IPC socket in the local environment; running the identical authoring checker via `node --import tsx` completed without that CLI socket. No environment permission or check was bypassed.
