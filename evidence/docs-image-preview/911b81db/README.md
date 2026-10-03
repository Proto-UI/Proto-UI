# Documentation image preview evidence: 911b81db

Code: `911b81db7401a08fb1a8d02b755b4ba6e99d422f`, tree `c5d0fe606ddf88e840615e91c35d9d89ee026e36`, PR #787 / Issue #780.

[Exact-head browser run 37110423539](https://github.com/Proto-UI/Proto-UI/actions/runs/37110423539) passed all 20 cases. [Complete 61-PNG artifact](https://github.com/Proto-UI/Proto-UI/actions/runs/37110423539/artifacts/11269816452) expires after 14 days. ZIP SHA-256: f1f8f845ae87eb23dda7869751d33c20d37d6ba20cb19120f2e9b3eb6b2e3309.

Chrome 154.0.8037.57; Node 24.21.0; Ubuntu 24.04; fonts-noto-cjk recorded. All six retained images were inspected as pixels from this artifact before publishing. They contain only public documentation or maintained non-personal test fixtures. No private screenshot, account credential or unrelated screen is included.

- whitepaper-zh-cn-1280-light.png: Chinese whitepaper, Shadcn, 1280x900, light
- whitepaper-zh-cn-390-dark.png: Chinese whitepaper, Shadcn, 390x900, dark
- 390-dark-brutalist-fit.png: maintained raster fixture, actual Brutalist facades, 390x900, dark
- 390-light-shadcn-keyboard-focus.png: native keyboard Escape returned focus with visible PUI ring, 390x900
- forced-colors-vector.png: actual forced-colors dialog and border/focus treatment, 390x844
- mdx-safe-inline-svg.png: bounded inline static SVG serialized into inert img; Source/Result labels retained

Coverage: 12 viewport/theme/family combinations (320/390/1280, light/dark, Shadcn/Brutalist); MDX picture/source/alt/caption/static SVG/link/error recovery; four bilingual whitepaper cases; actual loopback HTTP CORS/referrer/fake-cookie observations; forced-colors focus; reduced motion; no-JavaScript content. Native keyboard/touch, original-size scrolling, modal containment/return and repeated dismissal are exercised. Family/theme signals are test-injected, not a user-selector journey.

The image request test observed one shared request per mode, not a second transfer: anonymous/no-referrer had no referrer or fixture credential; use-credentials/origin sent the expected origin referrer and deliberately fake fixture cookie. Preview native policy attributes matched. This does not generalize to every browser/network/cache policy.

CSS-only hidden media is not generally classified by the implementation; explicit hidden/inert/aria-hidden/decorative/interactive/opt-out boundaries are separate. These captures establish shown states at this exact commit; no stable prototype lifecycle, public SVG active-document admission, formal review or merge approval is claimed.

This evidence-only branch must not be merged into product source. PR #787 owns retention and the evidence context.

Co-author by OpenAI Dots
