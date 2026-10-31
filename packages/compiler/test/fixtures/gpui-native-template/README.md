# GPUI native-template consumer definitions

## Status and provenance

**v9 reconstruction — unexecuted.** No TypeScript, formatter, Cargo or Rust
execution has validated these reconstructed files. Their presence is not native
acceptance, a claim that GPUI is complete, or permission to execute them.

The original unpublished v8 workspace became inaccessible after an execution
environment transition on 2026-10-31. Its source patch was
`226d09588ff6e133dc9311896bf3d04d64c0dd9a105ca5af5c07c3cafad11edc`.
The previously observed v8 results (39/39 new cases, 669/677 original cases in
each subject, scoped strict checks with zero diagnostics) do **not** apply to
this new candidate. Its original raw logs and emitted graph bytes have not been
recovered. Earlier failures remain historical failures; they are not rewritten
as v9 results.

`composed.proto.ts` alone was recovered byte-for-byte, with SHA-256
`32ee71108a670cc76033d2a3394453753fc783a23a81f2ae3f49d9e46d88a1cb`.
The test reconstruction preserves 38 visible historical case definitions from
recovered review/context records. One original case between the sibling-index
and duplicate-slot cases was not recovered; its name and semantics are unknown.
The three additional v9 cases are explicitly new, not substitutes represented
as recovery of that missing case. The Rust snapshot definitions are newly
authored; the consumer retains a recovered visible prefix and a newly authored
late-resource tail and nested-slot rejection check.

The baseline is public main
`9011d271970db883800d086c911b70e1437942c9`. No private IR/source bank, Adapter
bridge or component-specific implementation is used.

## Separate evidence layers

1. `gpui-template-lowering.test.ts` parses real source and calls the actual GPUI
   emitter. It checks emitted-source structure, checked-IR native parameters,
   lexical capture, callable identity/ABI, slot validation, actual fixture
   loading and ordinary setup-result adaptation. These are not Rust runtime
   tests. Frontend rejection of an unannotated helper formal remains a negative
   control, rather than a fabricated successful native source fixture.
2. `snapshot.rs` defines SDK-level native-factory checks: primitive and array
   identity, callable capture, invalid child values, nested/aliased slot count,
   external-slot validation, requested projection and failed-projection
   preservation. The new failed-projection check also requires restoration of
   the previous owner phase; it remains unexecuted.
3. `consumer.rs` imports `generated_gpui_component::CompiledComponent` and an
   ordinary GPUI `Entity`/`AnyView`. A real `TestAppContext` window is intended to
   verify native children, three repaint cycles without authored projection,
   state changes without update intent, one requested projection, stale commit
   rejection, atomic invalid-slot rejection and terminal cleanup. It does not
   start a Node peer or replace the generated owner.

`NativeSnapshot` is a trusted native-consumer API with public Rust fields. Its
slot guard checks the validity and slot-count metadata produced by the normal
constructors; it is not a security validator for an adversarial caller that
manually fabricates fields or closures. The text constructor rejects boolean
and undefined values rather than coercing them into accepted text children.

The source-case recorder is an optional evidence sink only. Set
`PUI_GPUI_EMISSION_ARTIFACTS` to a fresh, existing, real absolute directory per
subject/run. It preserves the full input before emission, the after-input hash,
the returned graph/diagnostics or thrown error, and uses exclusive file writes.
It never selects different product semantics or runs Cargo. An emitter throw
still fails its test. Preserve original stdout/stderr in addition to receipts.

## Intended generated-consumer procedure — not yet run

After a separate fixed-source approval, use the ordinary compiler CLI with
`compile`, this source entry, `--profile gpui-source-v1`, an explicit source root
and a **fresh** output directory. Keep the exact source/IR/output graph and CLI
receipt; an emitter-only JSON record is not itself the CLI write-path proof.

The generated root manifest exposes the ordinary Rust library name
`generated_gpui_component`. Copy `snapshot.rs` and `consumer.rs` into that
generated crate's `tests/` directory without editing `Component.rs` or its
support files. The snapshot fixture reads the actual generated
`.proto-ui/fixtures/style-tokens.json`; do not replace it with a handwritten
empty vocabulary to make a test pass.

The emitted manifests pin GPUI to revision
`62e5991dd0f0c8a3af8d5e7e9c4652490d468db8`, and enable its `test-support` feature
for the root dev dependency. The actual generated consumer's Cargo lock,
complete registry/Git source closure, checksums, licenses, build scripts,
procedural macros, target/system libraries and toolchain still require their
own fixed evidence and authorization. The repository native workspace lock is
not an honest substitute for this generated crate's resolved lock.

Only after those steps may separately approved offline, locked Cargo checks and
tests run in the no-credential, PID/network-isolated environment. Retain all
compiler, platform, assertion, panic and dependency failures. These definitions
do not authorize a native run or a dependency update.

## Open acceptance work

The bounded template/callable slice does not complete typed scalar/state/callback
lowering, reached-only support, numeric string/UTF-16 semantics, all admitted
operation families, authored Button composition, native OS focus/input/a11y or
layout. `TestAppContext` is not real OS acceptance. Generated size, retained link
size and initialization costs remain separate unmeasured requirements.
The full SDK is still emitted. Keep #1056 and the remaining compiler/consumer
acceptance items open; do not infer completion from a source test count.

## Initial v9 source checkpoint: HOLD, not executable acceptance

This independent work-in-progress checkpoint preserves the seven reconstructed
files before the newly discovered native-record ABI repair. Static review found
an admitted case such as `const holder = { child: r.el('span', 'x') }; if (!holder)
return null;` whose record construction currently attempts to place a native
snapshot in `Value` storage. It is a real unresolved generated-Rust type boundary,
not a reason to delete the input, label it Unsupported, or claim this source ready
to merge. Record aliases, per-call identity, nested fields, helper returns and
checked-IR module-config formals require a finite typed native aggregate lowering.
The proposed representation is under separate static review and is not included
in this checkpoint. All new v9 source, unit tests, Rust fixtures and formatting
remain unexecuted. Historical V8 passes do not validate these different bytes.

The old executor became unavailable at 2026-10-31 20:49 UTC. Six historical review
records and the composed fixture were restored with matching hashes; complete
V8 source, raw test logs and emitted Rust graphs were not recovered. This is a
new source version based on published main9011, not a claim of V8 recovery.
