# Calibrate the finite dark seed fixture without weakening admission

Baseline: published `342955e238e6a632dbc010b70aa59d1a373ce440` (tree `11effd22f7b28598e40a8fd0534879b3bebc3fd5`). Scope: the private initial-paint fixture, its native driver and source controls. No production renderer, shader, foreground resolver, contrast threshold or seed admission rule changes.

## Observed boundary

The new official initial-paint artifact `11624057394` records 13 light server-to-live frames from 178.4 to 728.4 ms with the same PNG and owner and no `background-image: none` sample. The light continuity assertions passed. The workflow then failed waiting for the dark producer to become self-optical. Its observed state was opaque fallback with reason `rendered-contrast-unsafe`, rather than a GPU error or a media-preference mismatch. The retained artifact ZIP SHA256 is `83278715ac359c4eab6af002b7249e38c9915e15bf04616c0cef2eae5c3d4b51`.

The fixture uses Surface `outline`, which selects regular material and dark foreground `#f5f5f7`. The existing sink checks actual CSS foreground against that resolved color before rendering. The original dark scene's `#7bafae` centre has modeled contrast about 4.922:1 after regular tint alone, but about 3.684:1 after an additive 0.08 highlight. This supports the observed whole-surface rejection. It is not a measurement of the rejected framebuffer or a claim that the centered glyph pixels failed text contrast. The inherited shader uses reversed-edge smoothstep; mathematical evaluation does not replace exact-engine evidence.

## Bounded change

Keep light pixels, geometry, layout, material props and the original three dark bands unchanged. For the positive dark seed-continuity fixture only, change the rose band from `#ae626b` to `#70464c` and the centre from `#7bafae` to `#486464`. Producer and consumer draw through the same scene helper. The darker source supplies modeled contrast headroom, but the unchanged real per-pixel guard still decides whether a seed may be captured.

Retain all five original dark colors behind the explicit `unsafe-dark-control` query. A new native negative case requires `rendered-contrast-unsafe`, opaque fallback, no background image and rejection of `artifact()` with `no-admitted-static-paint-captured`. It records the refusal and a dedicated screenshot before running the original light/dark producer/consumer loop. Existing native waits, continuity assertions, preference guards and source-revocation checks are unchanged. If the negative no longer refuses or the positive still fails, the workflow remains red.

## Verification and limits

New source controls check the exact retained unsafe palette, its modeled highlight failure, conservative headroom for the positive dark palette and unchanged light inputs. The original two colors substituted through a read-only Vite transform make the new positive-headroom check fail; the candidate passes. The complete seed/binding/media set has 134 passing controls (117 seed, 8 binding, 9 media). These are local controls, not native optical evidence.

The first isolated test run passed 114 tests but failed three existing family-producer cases because package-local dependency links were absent. Restoring the already installed fixed links resolved those dependency failures. The first fixture build correctly rejected external `../` dependency paths in its source-binding manifest. A contained local hard-link copy of those same installed dependencies resolved the path issue without downloads or changes to the binding validator. Both failed attempts are retained. The CLI, isolated fixture, targeted types and 18 workflow controls are checked again at the final source boundary; exact commands and exit codes are retained with the candidate evidence.

No native Chromium execution was performed locally. The new unsafe rejection and both positive dark seed/consumer paths require the next exact-head official run. This change does not establish optical parity, dark visual acceptance, four-runtime completion or any new 68-goal acceptance. Public SSR flags, private Card defaults and all production budgets remain unchanged.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.
