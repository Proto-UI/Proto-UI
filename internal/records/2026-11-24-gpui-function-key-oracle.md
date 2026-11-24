# GPUI function-key input oracle: bounded repair

Date: 2026-11-24 UTC. This record is non-normative.

## Observed failure and owning layer

The release candidate's native key-name completeness test rejected `F10` in [run 45385473253, macOS job 138415142319](https://github.com/Proto-UI/Proto-UI/actions/runs/45385473253/job/138415142319). The parent investigation retained the original job failure. This child independently inspected the test and translator, including current main `fd3796c2d70b0efb738b20c764f5fc1c4133fdc5`; the test gap remained there.

Production `named_key` already handles GPUI `f1` through `f35`, including `f10`. The completeness test selected a simulated GPUI input by reversing only `NAMED_KEYS` or accepting a single printable character. `F10` satisfies neither of those two branches, so the test panicked before dispatching a key.

The existing generated fixture contains 15 compared keys, including `F10` from the Context Menu input host. The only existing non-keyboard comparison remains `colorScheme`. This repair does not remove a scanned value, classify `F10` as non-keyboard input, change a production key spelling, or alter the scanner.

## Change

The test's input selector now also handles canonical `F1` through `F35` by selecting `f1` through `f35`. Its range and spelling are closed: zero, values above 35, leading zeroes, signs, lowercase web names, and missing numbers are rejected by the new helper controls. `F10` is also a required scan sentinel, so a future scan cannot silently make this regression disappear.

A new `#[gpui::test]` uses the existing `Harness::press`, real GPUI window dispatch, and `from_key_down` for every function key in that range. It also checks the translated `Shift+F10` key and modifier. The original full compared-key loop still dispatches every admitted scanned key through that same harness. These window tests have been authored but were not executed by this child.

## Executed evidence

The implementation base is `6eb7b37da6675a31bb35bb272f3ee1567b30f655`, whose DCO-only change preserves the preceding candidate tree. Only `tests/key_names.rs` changes executable source. The production translator, scanner, generated fixture, dependencies, and lockfile remain unchanged.

The local executor had no Rust toolchain. A bounded run used an already installed device toolchain in an owned scratch directory, with automatic installation disabled. It ran no Cargo build, GPUI window, browser, or native acceptance lane. Environment: Rust 1.99.1, rustfmt 1.10.0-stable, Linux x86_64. Execution interval: 2026-11-24 12:06:34–12:06:35 UTC.

| Check | Actual result |
| --- | --- |
| Complete changed `key_names.rs`, rustfmt format and check, edition 2021 | exit 0 |
| Exact extracted original Rust input-selection expression and existing production named-key rule | compilation exit 0; one test fails at `F10`, exit 101 |
| Corrected extracted Rust input selector over the unchanged 15-key fixture | passes |
| Canonical `F1`–`F35` input helper and eight rejected spellings | passes |
| Combined corrected standalone Rust probes | 2 passed, 0 failed, 0 ignored or filtered; exit 0 |
| `git diff --check` | exit 0 |
| Full `proto-ui-gpui` crate build and actual window tests | not run |

The standalone probes execute the extracted Rust input-selection code. They do not stand in for GPUI event dispatch. Their baseline first confirms that the existing production function translates `f10` to `F10`, then fails at the old inverse selector. The formatting change affects only the layout of the required-key array; the extracted helper and selector bodies are unchanged.

Final `native/gpui/crates/proto-ui-gpui/tests/key_names.rs` SHA-256: `57eff6f260934bdd55b342464b483460c04e5d2f115d0cced8392c0af65a8e14`.

The [evidence archive](evidence/2026-11-24-gpui-function-key-oracle.tar.gz) retains before/after sources, the unchanged input fixture, exact standalone Rust probe sources, commands, raw stdout/stderr, tool versions, exit receipts, the source patch, and a SHA-256 member manifest. No binaries or external approval claims are included.

## Remaining acceptance

Run the real `key_names` integration target on the final integrated source, including the new range journey and original compared-key loop:

```sh
cargo test --manifest-path native/gpui/Cargo.toml -p proto-ui-gpui --test key_names --locked
```

Linux/macOS native CI and release acceptance remain bound to their actual candidate receipts. This test repair does not resolve unrelated native color parsing, compiler inventory failures, browser startup deadlines, or release gates. No GitHub write or release action was performed by this child.
