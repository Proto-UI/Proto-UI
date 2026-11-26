# Button SSR carrier refusal repair

Date: 2026-10-08. Reviewed baseline: `544a1928bd1f2603c3ef35541332e6448a5584ba`.

Independent review reproduced a real fail-open boundary: removing the carrier script or changing its JSON to `null`/`false` on a disabled SSR host caused the truthy carrier branch to initialize a new client-only owner. That changed `disabled=true` to its default false and replaced the server nodes. The source and existing green controls did not justify preserving that behavior.

## Repair and controls

- `readCarrier` now distinguishes an ordinary unmarked client element from an SSR-marked frame. A missing carrier on any remaining source/instance/raw-props attribute or Root marker reports `PUI_WC_HYDRATION_MISMATCH` before ownership or rendering. Parsed carrier data must be an object, and its script MIME type and binding must agree with the emitted artifact.
- Missing, null, false, true, zero, string, array, empty-object, duplicate, incompatible-version, changed script binding/type and partial-marker controls keep the original disabled attributes, tab order, HTML and node identities.
- The unmarked client-only path remains usable with supplied props. Explicit hydration with a different instance's carrier is rejected even after the target was already adopted, without replacing its established owner. Reusing the same carrier remains idempotent.
- The exact-head read-only evidence workflow also triggers for its real imports `apps/www/scripts/runtime-retry-urls.mjs`, `scripts/test/server-readiness.mjs` and installation configuration `.npmrc`.

## Event-channel clarification

`A-WEB-COMPONENT-0001-M`, `C-EXPOSE-EVENT-0001-D/E` and `HC-EXPOSE-EVENT-SINK-0001-A/B` define the existing outward signal contract. A successful activation emits one outward `CustomEvent` named `click`; native input remains a separate event. No source change here stops native propagation. The unfiltered synthetic-DOM control observes `[outward, native-input]` for an enabled activation and only an additional native-input event when disabled. Browser probe and test names now explicitly say `outwardSignals`; native trusted clicks are recorded separately. The earlier unqualified "one app effect" phrase must not be read as a promise that an unfiltered DOM listener runs only once.

## Executed and pending evidence

Before the repair, the expanded source suite had 9 failures and 23 passes. The failures included the independent missing/null/false cases, other falsy payloads, script binding/type, remaining SSR markers and an explicit foreign instance. Duplicate/version and normal client controls were retained rather than invented after a green result.

After the repair, all 36 new source/server/synthetic-DOM tests and 37 existing WC, Context, style, target and artifact-output checks pass: 73 tests across seven files. Generated standalone artifacts still pass strict TypeScript with no Proto UI Runtime/Adapter imports, and the complete workspace TypeScript check passes. Workflow YAML and all shell blocks pass syntax checks.

The native suite now collects 18 tests, adding real-HTTP disabled-host cases for missing/null/false carrier transport. These assert diagnostic refusal, preserved nodes/styles/geometry/pixels and retained disabled semantics. They are not run locally. The workflow strictly requires all 36 source and 18 native tests with zero skipped cases, and retains failure artifacts. Native evidence and fresh independent exact-head review remain pending. All four public SSR profile flags remain false; no website or external publication change is included.
