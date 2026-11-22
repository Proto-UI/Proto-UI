# Private Rust data artifacts

The draft contract is `C-COMPILER-RUST-DATA-0001`. This is an explicit private data-compilation boundary, not a complete UI target profile or a new component method invocation rule.

## Why this boundary exists

A headless session may need an authored pure decision function while a native view needs GPUI, ownership and rendering support. Importing a generated component crate for that function pulls the UI dependency closure into the session. Calling without a `Window` does not remove those Cargo dependencies.

The data artifact compiles the checked function itself. The source remains the single authored decision implementation; the compiler does not reproduce the application's state machine. Domain writes, pointer identity, project revision guards and effect execution remain consumer responsibilities.

## Selection and ownership

Callers explicitly select source method names. Each name must resolve uniquely to a statically identified pure module function. Its parameters, defaults, result, local computation and complete transitive helper closure are checked. Owner operations, state, mutable captures, unsupported expressions and ambiguous selections reject rather than falling back to a component owner or ignoring a requested method. Serialized IR is independently validated.

The selected name is a source extraction selector. Compilation does not execute setup or assert that an instance condition registered that method. The generated crate has ordinary Rust functions, not a forged exposes record. Applications that need an actual component method continue to use the component handle and its instance lifetime. This keeps draft `C-EXPOSE-0003`, `C-EXPOSE-0004` and `D-EXPOSE-METHOD-CALL-0001` unchanged.

## Native representation and dependency closure

Public Rust functions use generated typed inputs and outputs. Expressions and control flow lower directly to Rust. Private support may implement reached portable language semantics, such as number conversion; it must not interpret IR, dispatch domain protocols, allocate an owner or import GPUI. Unsupported type or operation combinations produce a diagnostic at compilation.

The initial representation uses `f64`, `bool`, `String`, finite enums, typed arrays and records with concrete fields. Record and array identity is preserved when the authored function compares references. Numeric-to-text conversion may reach `serde_json` for its shortest-rounding primitive; the generated dependency inventory records that language support. Ordinary numeric decisions need only Rust's standard library. Object spread, dynamic record or string indexing, and mixed string/number-union addition are currently rejected. These are compiler coverage limits, not restrictions on otherwise valid Proto source.

A stable caller-supplied Cargo crate name separates application manifests from source fingerprints. Provenance records the selected functions and checked type schemas, actual source hashes, generated inventory and required language-support dependencies. A content change changes these identities without silently changing the requested package name.

## Sources and publication

`compileRustDataFile` uses the same static source graph as component compilation, including declared `proto` package exports and relative helpers. It records the complete loaded source and resolution closure. It never executes input modules or guesses hidden package source paths.

`compileRustDataPrototype` accepts an already supplied source graph; `emitRustDataSource` accepts checked portable IR. The distinction is explicit: an entry string alone cannot certify unseen files or installed toolchain versions.

The generated entry is `lib.rs`. Artifact publication uses the existing checked create-only writer, including safe relative paths and ownership-aware rollback. It does not delete a destination because `provenance.json` happens to exist. Read-only comparison is retained-artifact evidence, while a fresh source compilation is separate evidence.

## Acceptance boundaries

Tests independently cover source/IR rejection, aliases and transitive helpers, typed native execution, source mutations, the resolved Cargo dependency graph and safe publication. A generated crate and dependency graph cannot prove window input, pointer capture, keyboard focus, accessibility or OS routing. Those remain the GPUI component and application integration's separate acceptance work.

The compiler remains private. Neither this document nor a passing data consumer promotes a stable compiler profile, the Expose contracts or the Move capability.
