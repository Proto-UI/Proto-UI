# @proto.ui/adapter-gpui-peer

Private TypeScript runtime peer for the GPUI host Adapter direction tracked in #687, following `internal/records/2026-09-22-gpui-adapter-architecture-decision.md`.

The peer owns Proto UI semantics. It runs one `RuntimeSession` per protocol session and reaches the host only through `@proto.ui/host-protocol` messages, so the same code can be driven by a Rust process over local IPC, by an embedded JavaScript engine, or by a browser WebAssembly build.

- `src/bus.ts` — the adapter-private event bus. It plays the role the shared Web router's private buses already play, but depends on no DOM and no Node global, and reports each registration so the session can mint one Event lease per registration.
- `src/template.ts` — Template v0 to bounded wire data. The reserved slot marker is the only place host-owned content enters a view; a `PrototypeRef` is rejected.
- `src/transport.ts` — length-framed JSON over a byte stream, plus an in-memory loopback pair. Framing is this peer's implementation choice, not protocol semantics.
- `src/bundle.ts` — the governed Prototype bundle. The host names an entry key; arbitrary import strings never cross the wire.
- `src/session.ts` — the session: capability wiring, one epoch transaction per commit, Event leases, Focus readiness, the A11y reference ledger, and Expose descriptors.

## What this package is not

It does not run or validate Rust, GPUI, native input, `FocusHandle`, AccessKit, `ProtoSurface` behaviour, a real transport, or an embedded engine. It admits no `A-GPUI-*` profile, Host Capability, Module or Contract, is not published, and is not an official Adapter profile. Its tests drive a scripted host built on the protocol model; that is simulation evidence, not conformance.
