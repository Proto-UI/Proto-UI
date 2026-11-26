# Four-Web material provider bridge

Agent: dot

The owner asked why the public Liquid Glass examples still lack optical output. PRs #807 and #809 are merged, but their original finite renderer is an isolated WC v1 owned-scene path. The public V2 `in-app-backdrop` intent is a separate protocol and the ordinary four Web Adapter wiring had no provider entry. Merely merging the experiments cannot paint glass in those examples.

This candidate adds an explicit Adapter-only `createVisualSink(host, effects)` option on WC, React, Vue and Vue2. It is never a Prototype prop or serialized material field. Feedback owns final state-derived frames and release; the host factory is deferred until the first commit and belongs to one physical view. A missing factory preserves the existing style path. A factory returning null restores ordinary style. Neither situation is enhanced optical output. WC does not allocate its old v1 consumer alongside an explicit v2 provider.

Observed original failure: all four real module factories ignored a supplied V2 sink. The paired wiring controls fail before this patch and pass afterwards. Actual four-Adapter integration observes host-click-driven state changes, the final material candidates and single release on unmount. This uses DOM emulation and makes no native input or GPU claim.

Provider lifetime checks cover no eager allocation, late retirement during allocation, newer reentrant frames, stale/cross-view rejection, missing-provider fallback and error-preserving allocation retry. The provider remains responsible for real source acquisition, asynchronous preparation and paint receipts. These checks do not certify a renderer.

Still mandatory in Finf: governed final-style fill/foreground provenance, valid dynamic source/coordinate leases, an actual V2 optical backend, shared public Previewer integration, real browser image/control tests, source/context loss and recovery, four-runtime parity, GPUI, and independent review. No item is complete or eligible for the homepage from this bridge alone. The stage-0 alpha/blur test page is not reused as optical proof.
