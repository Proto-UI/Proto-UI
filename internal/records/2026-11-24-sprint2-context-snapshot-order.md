# Sprint 2: Context aggregates and semantic snapshot reads

## Reproduced gap

After the checked `NonNullable` repair, unchanged Base Drawer Content reached a separate `PUI1006` refusal in `drawer/snap.ts`: its Context update retained the `points` array before reading resolved Props and State. The aggregate-order checker treated every semantic operation as potentially reentrant, including the no-argument snapshot reads.

Two minimal sources independently reproduced the refusal: a shared numeric array followed by `state.get()`, and the same array followed by `run.props.get().value`. Neither snapshot operation invokes authored code or mutates the earlier container.

## Repair and preserved boundary

The shared operation table now supplies the narrow proof: an operation must take no arguments, declare no callback, and have only read effects on State or resolved Props. The current table satisfies this for `state.get`, `props.get` and `render.read.props.get`. Its receiver and all nested eager expressions still undergo the existing order check. This adds no generic helper-purity claim and does not classify raw Props, subscriptions, writes, host calls or arbitrary ordinary functions as pure.

The source frontend and source-free IR validator consume the same semantic argument rule. A helper that mutates the shared array before returning a State receiver remains rejected even though its final operation is `get()`.

## Bounded evidence

Standalone Node probes, capped at 768 MB, recorded both minimal sources failing before the change and passing afterward, including cold JSON IR validation. The effectful-receiver source still reports `PUI1006`. Moving that effectful receiver into an otherwise valid JSON-restored snapshot operation independently reports `PUI2002` with the aggregate-order diagnostic.

The unchanged Base Drawer Content entry compiles successfully for React after this repair. The focused regression adds both positive cases, the effectful-receiver negative and an independent IR mutation. Its Vitest run is queued for the next coordinated integration window; it was not run concurrently with the root's full Compiler suite. These bounded checks do not replace the full Drawer interaction, cleanup, browser or target acceptance matrix.

The corresponding GPUI compile advances through source admission and reports explicit `PUI4003` target gaps for ordinary collection operations and dynamic iteration. It is not a successful GPUI Drawer result; the Base Transition GPUI source result remains a separate narrower receipt.
