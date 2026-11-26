# Bounded Search cold-open evidence

Status: evidence-only branch; never merge this branch. No product changes, new performance threshold, or new merge gate. Existing Search opener 1000 ms acceptance is unchanged and is not replaced by these measurements.

## Request and source boundary

The maintainer requested a bounded before/after performance review of the website's prototype migration. This probe addresses the specific missing comparison between idle-prewarmed Pagefind and lazy first-open initialization. AI-assisted implementation: OpenAI dot, under the contributor's existing public identity and DCO 1.1.

- Historical baseline: `46fa65bb0146d951a08f6368ee4568be57fba3f5`.
- Migration: `8a49c6b7bc3777d682a08ee6f0e0fcda5bf87cbe`. Its only parent is the baseline above (`git show -s --format=%P`). The Search diff removes the DOMContentLoaded/requestIdleCallback call to ensureSearchReady and explicitly makes the service lazy.
- Current comparison: fixed main `4a2320762ba5f4319dec1915ca4e138772dceb0c`, verified 2026-10-05. PR #816 was still open at `d6bf13e18dabb6cab223eda2c81d99666baa5930`; it is not represented as merged or measured here.
- Compare complete production source trees. Other historical changes and differences in the generated search corpus prevent attributing a measured delta solely to this one migration.

## Existing evidence inspected

The startup profile workflow/run [37315550851](https://github.com/Proto-UI/Proto-UI/actions/runs/37315550851) captures historical opener readiness and attribution, not production Pagefind input/results after opening. Its historical application revisions and one-shot timings cannot supply this source pair's cold-open distribution.

Production Search artifacts 11300684292 (source `ec6e5710d0aaeee6d5844f9c996c1d7ca594aa31`) and 11300895640 (source `38adb13a6dbe8ef798a03c8bbcf39e116590638a`) contain real recovery/query/reopen evidence. Their HEAD503 injection and gated retry are deliberately non-natural. They contain input events, but no timestamp for first visible semantic result and no repeated natural cold-open samples. They are useful historical functional evidence, not a speed baseline.

## Measurement contract

One new measurement job. Two locked production builds, serial; no changes to application source. Existing normal repository PR workflows still run under their own policies. Runner-provided Chrome is fixed within the job and its actual version is recorded. The same probe measures both builds, served as static production output over loopback. No account credentials or non-test network requests are used by the browser. Unsupported external requests are blocked and counted. No deployment occurs.

Both sources use `/zh-cn/ui-libraries/shadcn/button/`, 1440×960 CSS pixels, light theme, WC preference, no CPU/network throttling, fresh browser context each sample, HTTP cache disabled and service workers blocked. A context is not a cold OS/process cache. Samples alternate source order to reduce ordering bias.

For each source: 10 early-open samples (earliest automation-after-DOMContentLoaded, including Playwright actionability delay; not guaranteed before idle prewarm) and 10 settled-open samples (at least DOMContentLoaded + 2000 ms). The latter intentionally gives the old idle prewarm a chance; actual click offsets from DCL and opener readiness are recorded rather than assumed. Native Playwright clicks/fill drive interaction. Observer timestamps come from the page's performance clock and first rAF observation, not a Node clock spanning protocol calls. The same observation loop adds diagnostic overhead and frame-quantized observation latency to both trees; it is not a zero-overhead benchmark.

Record independently:

1. Observable opener readiness from navigation and DCL, as descriptive measurements. These are not the existing test's separately anchored 1000 ms gate.
2. First trusted opener click to visible, enabled, non-readonly, focused search input.
3. Actual Button input event to first visible result whose same-origin Chinese Button documentation URL and title both match.
4. Second trusted opener click to the same observable input predicate, on the same page after Escape.
5. Pre-click Pagefind resources and all long tasks; raw resource/timeline facts allow inspection of transferred initialization work. Long-task totals are not Search-attributed CPU time.
6. One separately labelled HEAD503 recovery control/source and one separately labelled trace/source. Neither enters natural sample distributions.

Raw samples, failures, missing observations, source/build hashes and complete inventory are retained. Summary reports min/nearest-rank median/p90/max and every raw value; no percent speedup or equivalence threshold. A missing/failed sample never becomes zero or silently disappears. The 20 s observation bound is diagnostic, not a performance pass threshold. Capture completeness is required for a green diagnostic, while no claim of performance parity follows from green.

## Validation and limits

Before publication: Node syntax check, negative-control unit tests and independent probe review. Real browser execution is reserved for supported hosted CI because the local browser routes were previously blocked. This document does not claim hosted measurements already passed.

No mobile/physical-device, second family, dark theme, warm HTTP-cache, slow-network, CPU-throttling, arbitrary-query or full pre-prototype parity claim. The original opener gate remains separate. Any observed regression requires attribution and a separately scoped decision; this evidence branch does not repair product code or own #815/#816/#845.
