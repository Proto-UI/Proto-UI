# Document reading presentation, bounded application composition

The current user authorized improving the evidenced reading differences. This increment consumes existing public Text inputs in Shadcn documentation only. It changes no authored MDX, Prototype API, Base hook, Adapter behavior, palette, isolation mode, control target or layout width. `P-BASE-TEXT` content/passive/input criteria and `P-SHADCN-TEXT` projection/inheritance criteria remain draft; this change does not promote them.

## Observations and their limits

The source-owned before revision is `23df79b86fb67a6352278783696a1075935781f5`. [Run 37289588139](https://github.com/Proto-UI/Proto-UI/actions/runs/37289588139) retained all four Quick Start/Radio Group light/dark PNGs and complete observations, with each collector reporting `errors: []`. The run itself failed because the strict network boundary blocked the development server's other-port HMR connection. Those are useful failed-run observations, not a passed capture or design acceptance.

The externally observed pages at `https://www.proto-ui.com/zh-cn/start-here/quick-start/` and `https://www.proto-ui.com/zh-cn/ui-libraries/shadcn/radio-group/` have unknown production source SHA. Both sets were read with collector digest `6e03822d03aeab6a0b0abcd02e1f2ef68a72516bd50496ac8ca7d35bbca69c3d`. All four authored-prose hashes match. Both reading columns measure 672px, but document client width is 1180px in the source-owned capture and 1165px in the public reference. Font/raster/scrollbar environment and unknown production provenance preclude a strict whole-page pixel-equivalence claim.

Ordinary source-owned paragraphs retain native reading color (`oklch(0.922 0 0)` dark, `oklch(0.269 0 0)` light), while the projected Text leaf's default tone selects the stronger family foreground. The source-owned title measures 36/45px and description 18/29.25px. The public reference title is 30/36px, description 16/26px and ordinary body 15/27px. These observations motivate a supported composition adjustment rather than new public pixel-specific semantics.

## Chosen owners and deliberate differences

- Ordinary Shadcn document body consumes `tone: inherit`, preserving native reading ink through the actual public Text component. It retains `size: base`, normal weight and relaxed leading: 16/26px at the observed 16px root. The difference from the public reference's 15/27px is deliberate.
- Document h1 consumes existing `size: 3xl` and `leading: tight`: 30/37.5px, not an invented 36px line-height token. Description/tagline consumes `base`/`relaxed`: 16/26px and its existing muted tone.
- h2/h3 hierarchy, family font/weight, labels/captions, homepage roles and Brutalist presentation remain unchanged.
- `siteTypographyParticipant` selects this internal application context only in its documentation scope under `main[data-pagefind-body]`. Native Aside/DocStageNotice content is excluded from the ordinary-prose adjustment. `initNoteSurface` already composes the passive public Surface and marks the note title's label role; the existing typography participant consumes Text for note title/body. This change does not retone or reweight either notice.
- Context participates in source revision and refresh comparison. Moving the same paragraph into/out of an Aside can leave its node identity, text and role order unchanged but must replace its reading recipe.
- Native fallback rules match the title/description scale and line box without targeting any `data-pui-style` surface. The entire page scope is excluded when it contains `data-homepage-runtime`, which lives in the sibling Header rather than above main. This preserves no-script homepage appearance as well as projected homepage behavior.

## Executable evidence and remaining acceptance

Red-first participant tests at the before code fail on actual four-Adapter `text-foreground` output where ordinary reading needs `text-inherit`. The repaired tests observe the real WC/React/Vue/Vue2 participant, its public Text style plan, heading/description inputs, unchanged notices/chrome/homepage, family round trips, native source identity, focus and teardown. A narrow mutation removing context refresh comparisons fails all four move-into-Aside cases. The fallback compilation check initially fails against the before stylesheet and passes with the source-owned Tailwind rules; it explicitly does not claim HappyDOM paint or complex-selector conformance.

Focused validation covers participant/ownership/homepage lifecycle/notice Surface, the public Text journey and public compiler, plus workspace and Astro type checks and prototype catalog closure. Exact command receipts accompany delivery. The existing real-browser typography suite now includes no-JavaScript Shadcn document, Brutalist document and homepage fallback cases, so no extra runner or browser inventory is introduced.

Local browser validation remains blocked: after correcting local Corepack/Astro cache paths, Chromium's Unix-domain socket is denied by the sandbox; the permitted escalation launcher fails before command execution on a synthetic bubblewrap mount. No browser assertion ran, and these failures are retained. Fresh exact-head CI, the repaired strict reading capture, PNG inspection and independent review remain required before visual acceptance. The historical before capture cannot stand in for the new revision.

## Before-evidence and registration follow-up

The capture-only successor `0229cda2685ac2bcbe24ccfaa09efaffc6142261` completed the strict production-preview capture successfully in [run 37293005915](https://github.com/Proto-UI/Proto-UI/actions/runs/37293005915). Artifact `11336439219` has SHA-256 `60be9b353d96fd4102ffa47a02163552facf4abec0df36368edf155ea9302fec`. All four cases have empty page, request, network-boundary and collector failures. Eight original PNG hashes and the unchanged pre/post build inventory were verified. The four viewport images were inspected; title 36/45px and description 18/29.25px remain the before appearance. This is a stronger source-owned before packet, not evidence of the appearance patch.

Independent review found that the added fallback suite used an unsupported ordinary `describe` registration in the existing socket-free collector and had not updated its exact case count. The suite now uses the existing sequential convention; the collector requires exactly 33 unique cases and verifies each of the three new fallback cases appears once. The unchanged runtime planning and corrected registration contracts pass 117/117. The initial independent combined focused run also recorded a homepage polling timeout; isolated rerun passed. Neither result is silently substituted for native browser evidence.
