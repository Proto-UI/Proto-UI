# Finf terminal state-projection cleanup

Date: 2026-10-10 UTC. Base: `27fec380`. This is a narrow successor fix; no frozen Finf snapshot is rewritten.

## Reproduction and owner-selected boundary

The real Drawer gesture test reproduced nine passes and one failure: after diagnostics confirmed terminal disposal, `--pui-offset-percentage` still contained `45`. ExposeStateWeb revoked subscriptions but never released emitted artifacts. Component-local cleanup would conceal the shared owner defect.

The owner-directed scope selects terminal-only conditional restoration. Non-terminal detach, host replacement and mapping/mode changes continue to retain their snapshots; their subscriptions and old callbacks are revoked. At terminal disposal, the Module restores its recorded attribute/CSS baseline only when the target still matches the last Module write, including CSS priority. Consumer writes after that write are retained. An observed consumer overwrite followed by a new Module write becomes the new baseline. Repeated bindings and colliding entries within this Module share one artifact baseline. Cross-owner and indistinguishable same-value-write arbitration remain unresolved.

The draft Module criterion and its ownership question were narrowed to match this implementation, without promoting lifecycle status or resolving unrelated open ownership questions.

## Changes

- Add per-target artifact leases in `packages/modules/expose-state-web/src/impl.ts`, retaining original absence/value/priority through suspension and rebind.
- Publish lease ownership before potentially reentrant DOM writes. Invalidate old generations and isolate subscription arrays before unsubscribe callbacks; release a newly returned subscription if subscription creation synchronously disposes/rebinds.
- Restore still-owned artifacts across all prior targets on terminal disposal; clear lease references and make repeated disposal inert.
- Ten owning-layer cases cover baseline/priority, external writes, new baselines, mount epochs, former/mirror targets, duplicate bindings, boolean removals, setter disposal, subscribe disposal and unsubscribe reentry.
- Correct the Group C Resizable lifecycle test: twenty microtasks after removal had already caused terminal disposal, so its former retained-variable assertion was testing residue rather than suspension. It now distinguishes same-turn reconnect from diagnostics-confirmed terminal cleanup and fresh-instance resynchronization. No Runtime delay or Drawer assertion was changed.

## Verification

- Focused Module, Runtime, all four actual Web Adapter consumers, Drawer and collection-composition tests: 40/40 passed across nine files. Drawer terminal test passes unchanged.
- Full six-file Group C suite: 49/49 passed.
- Scoped Module and composition TypeScript passed. The prescribed workspace type check reached only two absent ignored generated-style inputs in the existing shadow analysis fixtures; no full-workspace success is claimed.
- Native GPUI/Rust, real-browser visual geometry and complete Finf acceptance were not run.
- A generic `tsc --noEmit` invocation incorrectly included unrelated whole-repository docs/scripts tests and failed on existing declarations, aliases and ignored generated style inputs; it is not a passing type gate.
- `check:spec-authoring` was blocked before validation: tsx attempted a Unix IPC listener at `/tmp/tsx-1000/18.pipe` and received `EPERM`. No permission workaround or gate bypass was attempted.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
