# Web optical image admission repair

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This is a separate delta over optical candidate `3313262d1d5ac2a79c622a1d66a59e5bbdbbebf60fa328b55c1fb1635cc953e1`.

## Findings and correction

The first candidate read back real GPU pixels and immediately installed the data URL as CSS background. That did not establish that the browser had decoded the image. The repair retains opaque fallback through image preparation and publishes transparent-plus-optical paint only after successful decoding and fresh validation of the same physical view, semantic frame, source, palette, preferences, live context, bounds, DPR, radii, foreground and actual token commit.

Root review also identified a previous-frame `safeFallback` value surviving a new palette getter failure and incomplete safety/geometry revalidation after rendering. The local pre-repair fault controls restore those two old decision conditions and produce two expected failures: an unresolved new palette incorrectly reports `opaque-fallback`, and a transparency change during preparation incorrectly publishes `self-optical`. The repaired conditions pass the same two tests. This is mutation-control unit evidence, not a historical browser execution or GPU image.

Each physical surface owns at most one pending decode and one currently painted decoded image; starting a replacement first retires the preceding image. Source withdrawal, replacement and view release cancel pending work, clear the owned Image source and drop callbacks that retain frame/source/base64 values. A late resolve or reject cannot publish. Decode counters are available only as internal evidence, not capability facts. Late input failures preserve ordinary current style rather than using the old palette. Owned inline changes update the geometry observer's self-write fingerprint immediately.

## Evidence boundary

The provider/image/style/source/program unit suite passes locally. TypeScript and emitted Adapter builds are rechecked for this delta. Source and emitted public-package fixture bundles compile, and the emitted graph rejects public `/src/` imports. The private Liquid Glass Prototype source remains explicit and is not relabeled as a published artifact.

Actual GPU screenshots, zero-refraction/opaque quality review, twenty-surface timings, decoded-image counts and source/emitted browser execution still require the exact-head official workflows. No local Chromium restriction was bypassed, no native evidence is fabricated, and this delta does not close Finf or arbitrary DOM capture.
