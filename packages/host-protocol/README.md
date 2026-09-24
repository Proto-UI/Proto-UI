# @proto.ui/host-protocol

Private protocol-model fixture for the GPUI host Adapter direction tracked in #687. It follows the bounded replacement scope that the maintainer authorized on #467 and the architecture decision record `internal/records/2026-09-22-gpui-adapter-architecture-decision.md`.

The package contains two things:

- `src/wire.ts`: the version 0 wire vocabulary (identities, projection transaction, acknowledgement, Event binding plan, input sample, default-action request, diagnostics) plus a runtime guard that rejects every value the boundary forbids: functions, symbols, class instances, `undefined`, non-finite numbers and cycles.
- `src/model.ts`: a deterministic, in-memory model of the host side of that protocol: session identity, monotonic view epochs and commits, stale-message rejection, install-inactive then activate, retained logical state across epochs, pruning of superseded epochs, idempotent lease release, sample identity, budgeted default-action decisions, and terminal disposal.

## What this package is not

It does not run or validate Rust, GPUI, native input, `FocusHandle`, AccessKit, Slot or `ProtoSurface` behavior, a transport, an embedded JavaScript engine, or Adapter conformance. It admits no `A-GPUI-*` profile, Host Capability, Module, Contract, or support claim, and it is not published. The wire shapes are a proposal until the decision record is accepted; tests here are simulation evidence only.
