# Homepage observation repairs

The completed full run `45537881490` exposed three observation mismatches in the mobile and density scripts:

- A named nested Canvas helper acquired tsx's `__name` annotation and failed after Playwright serialized it. The same two alpha measurements now use an anonymous array callback; no browser-global helper is installed.
- The enlarged source window was checked against an obsolete fixed 417px cap. Its existing authored limit is `min(36rem, 65svh)`. The observer now computes that upper bound independently from the measured root font and viewport, retaining overflow, positive size, short-source natural height, Copy, and keyboard scrolling assertions.
- Current homepage content flows in `data-home-gallery-stage`. The density observer reads that actual owner and uses the existing native hero link to expand the inert mobile overview before reading interactive content. The immutable historical baseline still uses its original `.home-gallery` owner. Membership and physical spacing checks are unchanged.

The native navigation bridge initializes links in bounded batches. Readiness now waits for every visible navigation row's actual Text and Surface owners, instead of beginning the full observation after only one row has mounted. The observation still rejects missing leaves and unreadable or undersized native destinations, using the same existing wait deadline.

`homepage-evidence-contract.test.ts` passed **23/23**, including serialization, negative geometry, pinned baseline, and bounded workflow controls. The complete mobile and density native workflows are pending on the committed candidate; these source tests are not replacement screenshot evidence.
