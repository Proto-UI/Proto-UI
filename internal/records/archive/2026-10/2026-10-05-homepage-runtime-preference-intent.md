# Homepage runtime preference across generation supersession

This bounded repair addresses #777 review claim `4184647329` on `c4b6be34b67dc79cad3dd047aeb6f6e59cb5dd65`. It changes only the homepage consumer's preference ownership, its regressions and this record. Projection controller epochs, renderer ownership and readiness budgets are unchanged.

## Reproduction

Preparation locks the live controls, so invoking a family callback during that interval alone would not establish a user-reachable failure. The actual gap is after a new runtime generation has committed and unlocked its controls while its request still awaits asynchronous retirement of the previous generation. A subsequent live family request supersedes the old runtime observer. Previously that observer was the only one allowed to save and broadcast the runtime preference.

The regression uses the real homepage coordinator, projection materializer, gallery, public WC components and installed React. A controlled wrapper delays disposal of the old real Typography candidate; it does not replace the renderer. After WC to React commits, the test verifies that the new generation's family control is live and unlocked, then invokes that active composition's family callback. This is a consumer callback test, not a captured browser gesture. On the old source, the new family successfully commits React but storage remains empty and an independent adapter select remains WC. On the repaired source, storage, the independent select and exactly one preference event agree on React.

## Repair and boundaries

An immutable pending user-runtime intent survives family/component observer supersession. Only the latest live observer may consume it, and only against a ready, nonzero committed generation whose runtime matches the intent. Consumption happens before storage and event side effects. A failed superseding request may publish an already committed runtime retained by the controller; a never-committed runtime is not published. Explicitly choosing the previous runtime replaces the intent. Valid external preference events and teardown cancel it. Storage failure still permits the existing document notification.

Coordinator regressions cover superseding family/component requests, both failure cases, repeated same-runtime requests, choosing the old runtime again, teardown, storage failure and external cancellation. The component callback case exercises the private coordinator boundary; the current homepage does not expose an additional component picker. These tests use controlled asynchronous materializer boundaries, while the separate retirement regression uses real materialization.

## Validation and limitations

The real retirement regression was red at the preference assertion and is green after the repair. All 24 homepage coordinator tests pass. Full type checking completed with 397 Astro files, zero errors and zero warnings (three existing hints). A related aggregate run passed the new real regression but an unchanged pre-existing gallery test exceeded its initial 1000 ms preparation poll while type checking ran concurrently; an isolated serial aggregate is recorded separately rather than weakening that assertion. An initial cold new-fixture poll timeout and a discarded dispatch-method spy that counted Happy DOM event propagation multiple times are fixture diagnostics, not product reproduction evidence; notification assertions use actual document listeners.

Independent review and exact-head hosted acceptance remain separate checks. No browser timing benefit, whole-PR merge readiness, or new Search acceptance is asserted here.

Co-author by OpenAI Dots
