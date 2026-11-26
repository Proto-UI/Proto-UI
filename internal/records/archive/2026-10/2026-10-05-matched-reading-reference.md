# Matched reading-reference evidence (2026-10-05)

Execution follow-up: the initial development-server capture failed on the separate HMR origin. The current production-preview procedure and retained failure evidence are recorded in [the follow-up](2026-10-05-reading-production-preview-repair.md). The original procedure below describes the initial tooling revision.

This increment adds observation tooling and an opt-in test-harness redirect boundary above `213d03a10e6572d0d2ac79260055d41a7b9bb6f3`. It changes no authored MDX, fonts, colors, sizes, runtime, semantic source, Base/family implementation or isolation mode. Earlier CI for that revision remains historical when this tooling creates a new head.

## Boundary and authority

`P-BASE-TEXT` content/passive criteria and `P-SHADCN-TEXT` inheritance/consumption criteria remain draft. Native document owners retain their semantics and authored content; the existing family Text and Adapter own their presentation. This observer measures the realization without promoting the draft or changing its owners. The dated reading-rhythm record remains context, not a new acceptance specification.

The source-owned candidate and externally observed production page are distinct evidence classes. Production has no verified source SHA in this packet. A similar appearance, version label, text hash or successful candidate capture must not be used to assign it the candidate revision.

## Independent four-case runner

Run from a clean repository root, with the exact full candidate SHA:

```sh
PROTO_UI_EXPECTED_HEAD="$(git rev-parse HEAD)" \
PROTO_UI_READING_EVIDENCE_DIR=/tmp/reading-reference \
  node --import tsx apps/www/scripts/capture-reading-reference.mjs
```

The independent `reading-reference-evidence.yml` job uses Node 24, existing frozen pnpm dependencies, runner Chromium and Noto CJK fonts. It does not change existing browser matrices. It captures `/zh-cn/start-here/quick-start/` and `/zh-cn/ui-libraries/shadcn/radio-group/`, each light/dark, at 1180×757 CSS px and DPR 1. A fresh browser context uses normal browser zoom, a light system color-scheme preference and no reduced-motion preference. The dark case uses the real Header Theme button and records its native pointer action; actual viewport, scale, CSS zoom and motion observations remain recorded rather than assumed to match another environment.

The runner starts its own loopback docs server through the existing browser harness. An externally supplied base URL is rejected. Browser HTTP and WebSocket requests are restricted to that server, service workers are blocked, and blocked requests remain failures. Admitted HTTP requests use the locked Playwright `route.fetch({ maxRedirects: 0 })` API; every 30x is recorded and aborted before following any Location, including same-origin redirects. Non-redirect asset bodies/status/headers are fulfilled from that original response, then its retained buffer is disposed. Readiness probes opt into `rejectRedirects: true`, which uses manual fetch redirect handling and fails on 30x before a follow; existing harness callers retain their default behavior and matrices. WebSocket HMR keeps its separate native connection and origin gate. The earlier `route.continue()` draft was rejected during independent review because Chromium automatically continues redirect chains without rerunning that admission handler. Dependency installation is a separately visible workflow prerequisite. No login, deployment, publication, Vercel API or production mutation is involved.

Clean Git HEAD is checked before server startup, after startup and after capture. The manifest retains expected head, actual head, event SHA, collector digest, browser/OS/font environment, original/final URLs, timestamps, page errors and failure records. Every original viewport/full-page PNG has byte length, SHA-256, IHDR dimensions and UTC file mtime. A downscaled JPEG is not a matching PNG; the runner never stretches a reference. The viewport PNG must actually be 1180×757. Full-page height is observed rather than predeclared.

## Reusable DOM observation

`reading-reference-collector.mjs` exports a self-contained, read-only `collectReadingReference` function suitable for `page.evaluate`. It has no browser automation, clicks, DOM/CSS writes, runtime selection, network access or dependence on Node APIs. A restricted DOM reader may omit navigator and FontFaceSet iteration; these metadata become explicitly unavailable while core text/geometry observations remain intact. Text traversal uses native child nodes. SHA-256 calculation runs afterward on the host using `hashReadingObservation` from `reading-reference-contract.mjs`.

The actual root is `main[data-pagefind-body]`; the old `.sl-markdown-content p` selector cannot produce a false empty pass. The collector inventories native p/li/h1–h4/caption and pagination, the container's computed values, actual Text-node parent values, real nearest Text surface, backgrounds through ancestors, content boxes, margins/padding/gaps and line/letter/word spacing. Required body/heading absence and existing prose roles with zero actual text leaves are failures. Optional absent roles are explicit. Visually painted aria-hidden titles remain in actual-text measurements with their aria-hidden ancestry; decoration is excluded only from the separately labelled authored-prose matching hash. No fake h3/h4/caption is inserted just to fill a list.

Prose blocks preserve observed original text, normalized text, native semantic role, path and hash. Each text node belongs to its nearest native semantic owner once. Interactive preview, code and toolbar text are separate, so changed wrappers or runtime labels cannot silently make authored prose appear different. Whitespace normalization and exclusions are stated in the result; an equal hash is content evidence only.

Header/sidebar/TOC/pagination/runtime toolbar controls keep their target border/client geometry separate from text-range and glyph geometry. Visible paint candidate boxes account for viewport and overflow clipping; they do not establish pixel segmentation, occlusion or clicked hit-testing. No geometry record is called an interaction pass. Root family, typography runtime, preview/runtime/isolation attributes and open shadow roots are observed, with unknown identity left unknown. Inner viewport, document client width, visual viewport, scrollbar gutter, overflow and overlays remain separate; equal inner width alone is insufficient for a pixel comparison.

## Validation and remaining work

The contract suite executes the collector on structural DOM fixtures, including a restricted capability fixture, missing/empty body cases, real leaf/container color divergence, whitespace, hash separation, source binding and PNG metadata. These structural fixtures are not browser paint evidence. A separately labelled network regression exercises the locked Playwright APIRequestContext against two ephemeral loopback HTTP listeners: the original server may return 302, but the second-origin destination must receive zero requests in each strict branch; a non-redirect binary asset must retain its bytes. A separate compatibility assertion verifies the shared readiness helper still follows redirects by default, using only those same two test-owned loopback listeners. Adversarial transport fixtures also cover all 300–399 responses, including relative and same-origin Locations. This verifies no-follow transport and handler decisions, not Chromium end-to-end interception. The workflow/runner contract checks exactly four cases, bounded deadlines, local-only navigation, independent job registration and retention on failure.

Commands and fresh outcomes belong with the current delivery. Source protocol/type checks, hosted real-browser collection, PNG inspection, independent review and comparison with the source-unknown production reference remain separate stages. A successful capture is an observation, never automatic design acceptance. Runtime/font/scrollbar/raster differences must be reconciled before claiming a matched comparison.
