# Native part selectors and synchronous input retirement

## Bounded correction

The Web Component entry dependency parser now recognizes exactly 17 observed native pseudo-element identities as identities of native control parts. A selector containing only those identities no longer makes unrelated trusted input trigger a full entry projection across the stylesheet's scope. Ordinary input-state pseudo-classes, unknown names, escaped suffixes and opaque stylesheet fallbacks remain conservative. Input delivery stays synchronous, and the compiler preview's original 250 ms cleanup acknowledgement boundary is unchanged.

This correction is based on `b8800d4cef9302718d4514b1ba28508860059929`, tree `4dfcdb3d01bc52b0c202a9d4e05a3c7f50a01651`. The normal fast-forward preserved all concurrent React retirement, strict no-style typing, native direction preparation, native fixes, source selection and historical evidence. No public commit was replaced.

The exact tested candidate sources are:

- `packages/adapters/web-component/src/runtime/modules.ts`: SHA-256 `4406d1a05d0249635250457562a843e0ed247eb2855c5abdcc4ed76bcf8c5bfa`.
- `packages/adapters/web-component/test/focus-entry-input-origin.test.ts`: SHA-256 `63f88eb9770d99e338bb64ff6f4105bf4bad1e1f735de3eb987fd464dc16acd4`.

The old module SHA-256 is `075436cbcf17fdcb7ef8e0983048bd2784f993f65f5579b936a7fb1b24172811`. The implementation delta is confined to `selectorMayDependOnInputState` and its explanatory comment. The original 18-test file is an unchanged byte prefix; the additional controls are appended.

## Actual failure and diagnostic chain

The [ea600 hosted record](2026-11-23-sprint5-ea600-hosted-acceptance.md) retains the overall failed formal run: the production canonical journey was 17/20, with the original 250 ms acknowledgement failure, subsequent 30-second cancellation/reopen failure, and incomplete actual Worker history. Its separate native, source/type, production, SSR and selected direction results remain bound to ea600.

One isolated diagnostic then ran the original production entry at the same source, using the installed sandboxed Chrome 145.0.7632.6 rather than the hosted Chrome 157.0.8103.78. The original entry rebuilt 684 pages. A passive wrapper profiled only the first bad-source fill, called the original `locator.fill` exactly once with unchanged arguments and retained the original canonical assertions. That diagnostic also ended 17/20. Its `captured` status means the requested diagnostic was obtained, not successful acceptance. The browser and owned service closed, all 10,686 source inputs remained stable, and production artifacts remained stable.

The bad-source fill produced 331 distinct trusted input events. The input-only trace has 331 `EventDispatch` intervals spanning 769.693 ms. Every event contains exactly 21 invocations of the same entry projection listener, for 6,951 calls and 679.854 ms inclusive time. The original editor input callback's 331 calls total 2.966 ms. The observer's 331 callbacks total 3.581 ms. One layout took 1.033 ms, and one style-tree update took 1.153 ms. Overlapping trace categories are not added together, and the whole 2,301.741 ms CPU-profile interval is not labelled input-only work.

The source chain is the entry projection listener, current projection, descendant eligibility check and composed ancestor/style traversal. The retained observer and driver source reviews explain profiling overhead, the wider observer window and the different browser versions. A recorded disposed message did not match the old iframe's captured Window identity; it is not treated as a strict acknowledgement or a direct measurement of child cleanup time.

## Actual CSS and listener ownership

The static scan used the exact old helper extracted from the source and the production HTML's linked stylesheets. It found 25 triggering rules among 3,196 parsed rules: 23 rules using native part pseudo-elements, and two Mozilla pseudo-classes present in the raw CSS. This was a static served-CSS observation, not the live CSSOM. The initial two analysis attempts only failed to resolve local parser dependencies; their errors are retained and are not product counterexamples.

A separate read-only survey opened the original sealed ea600 production artifacts, without filling, profiling or executing a replacement acceptance flow. Its initial hydrated page differs from the original revision-11 profile checkpoint, and this distinction is retained. The survey completed in 47.551 seconds, closed its browser and service, and preserved 15 critical source inputs and all 4,853 sealed dist files.

The live CSSOM contained 38 sheets, 3,646 rules and 3,275 style rules, with zero access errors. The exact old helper classified 23 selectors as input-dependent. The exact candidate helper classified none of those selectors as input-dependent. All 23 changes correspond to the observed native part identities; no remaining input-dependent selector was removed or omitted from the classifier report. Chromium's CSSOM did not contain the two Mozilla rules from the raw CSS.

All 21 matching listener registrations had the input-state dependency flag true and the external-style-input flag false. They belonged to **two** connected TabsContent targets outside the compiler editor: one had 11 ancestor capture registrations, the other had 10. Neither target contained the editor. These are 21 registrations, not 21 independent owners. This actual topology supports the source explanation for repeated foreign-input work; the original trace independently showed exactly 21 callbacks for every input.

## Exact classification boundary

The added identities are `::file-selector-button` and the following explicit WebKit part names:

- details marker and search decoration;
- date-and-time value;
- datetime edit and its fields wrapper;
- year, month, day, hour, minute, second, millisecond and meridiem datetime fields;
- calendar picker indicator;
- inner and outer spin buttons.

The pattern is fully anchored and names only this finite set. It does not admit arbitrary WebKit pseudo-elements. The parser continues through the rest of every selector, so a known part with `:valid`, `:invalid`, `:dir`, `:checked`, `:placeholder-shown` or an unknown input state retains the input dependency. An unknown WebKit name and an escaped unknown suffix also remain conservative.

No CSS declaration whitelist is introduced. In particular, the fix does not assume that only display or visibility can affect eligibility; custom properties, layout, containers, animation and opaque cases retain their existing treatment. It does not deduplicate events, postpone delivery, alter the listener's relationship checks, or change compiler, session, sandbox, cleanup deadline, Worker count or canonical browser assertions.

## Same-source red and green

The added tests call the actual Focus module API and exercise its existing trusted-event branch in Happy DOM. Native input cannot be created by that host model, so its existing explicit trusted-event fact is used. The tests are not native timing evidence.

The 17 actual rule identities are each checked for both input and change. Eight additional controls exercise mixed real input-state selectors and unresolved names. The existing 18 controls remain unchanged, including synchronous related descendants, nested Portals, slotted ancestors, aggregate form validity outside the form tree, native direction, opaque stylesheets, constructed CSSOM changes and synthetic input.

| Exact source/control combination           | Actual result                               |
| ------------------------------------------ | ------------------------------------------- |
| Old helper with all 60 controls            | 26 passed, **34 failed**, zero pending/todo |
| Candidate helper with the same 60 controls | **60 passed**, zero failed/pending/todo     |

All 34 original failures are the intended unrelated-entry sampling assertion, `expected true to be false`. The old 18 controls and eight conservative controls already passed. The old failure JSON SHA-256 is `6922df095231701e87a821d8a1d175bec1fca021b280251c1b802c64779f4a68`; the candidate JSON is `0d9c4458c19440504783323d9a295010d1534960a8ca6fb4fd1290c6702717c7`. The full original logs, commands and before/candidate source bytes are retained. Formatting and diff checks passed with unchanged candidate hashes.

Root independently read the complete patch, execution status, both original JSONs, the exact CSSOM classifier and the live survey. No blocking bounded source issue remained. These are independent source/evidence reviews, not GitHub APPROVED reviews.

## Durable custody and remaining formal acceptance

The shared [manifest](evidence/2026-11-23-sprint5-native-part-input-retirement/manifest.json) preserves the complete ea600 hosted artifact containers and full logs, original failed production profile, read-only survey and exact classifier, initial static-analysis failures, actual red/green controls, concurrent b880 evidence readback and independent peer records. It binds 208 originals, 65,025,208 original bytes and 29,489,830 archived bytes. Every archived byte stream is checked against its original.

This tested repair still requires an unchanged production canonical browser run at the published candidate, the independent rebuild/receipt check and the applicable final source/type/delivery gates. No additional instrumented run can substitute for those gates. The original 17/20 results and earlier timing failures remain failures; the host-model 60/60 result and offline CSSOM classification do not promote them. No public SSR profile, specification maturity, physical OS/assistive-technology acceptance, Issue umbrella, release or merge decision changes through this repair.
