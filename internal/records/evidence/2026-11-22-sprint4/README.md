# Sprint 4 evidence and Verdant source attribution

This directory contains source-bound test observations, two actual consumer
screenshots and a temporary downstream migration patch. The
[integration record](../../2026-11-22-sprint4-integration.md) states the exact
revisions and limits of each result. These files are evidence, not a new runtime
dependency or an application release.

## Verdant material retains its original license

**The Verdant-authored and translated business-source portions of
`verdant-consumer-migration.patch` retain AGPL-3.0-or-later. The Proto-UI
repository's MIT license does not replace their upstream license.**

The baseline is [OpenGreendam/verdant at
`91a775546ebd21a87d76d76568195a6513437719`](https://github.com/OpenGreendam/verdant/tree/91a775546ebd21a87d76d76568195a6513437719).
That revision's `NOTICE.md` declares Verdant source to be AGPL-3.0-or-later;
`frontend/Cargo.toml` uses the same workspace license. Copyright and authorship
remain with the upstream contributors as recorded in their source and history.

The complete original notices and the authored source consumed by both the GPUI
view and the pure decision producer are preserved here byte for byte:

| Local evidence | Exact upstream source | SHA-256 |
| --- | --- | --- |
| [VERDANT-LICENSE.txt](./VERDANT-LICENSE.txt) | [LICENSE](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/LICENSE) | `8486a10c4393cee1c25392769ddd3b2d6c242d6ec7928e1414efff7dfb2f07ef` |
| [VERDANT-UPSTREAM-NOTICE.md](./VERDANT-UPSTREAM-NOTICE.md) | [NOTICE.md](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/NOTICE.md) | `412f5f569a204cea328ec1bfb14b078f686f913952e9a6ac73b3d4f2a4ebeddf` |
| [verdant-pitch-gesture-surface.proto.ts.txt](./verdant-pitch-gesture-surface.proto.ts.txt) | [frontend/proto-ui/src/pitch-gesture-surface.proto.ts](https://github.com/OpenGreendam/verdant/blob/91a775546ebd21a87d76d76568195a6513437719/frontend/proto-ui/src/pitch-gesture-surface.proto.ts) | `9e1add6f335945f024db95ecdde0b65b960f84f0c12d69995fdbb2971e5e5e78` |

The `.txt` suffix keeps the verbatim TypeScript evidence outside this repository's
prototype compilation inventory. It does not change the original file's bytes.
The upstream notice is retained as a complete historical document; its relative
links resolve in the pinned upstream repository. Its other voice, artwork,
model and research references do not imply that those materials are included
in this patch or these tests.

## Scope and changes in the temporary patch

On 2026-11-22, ChatGPT coding agents working for the current contributor prepared
the temporary consumer migration: compiler pin and workspace bindings, the
data-artifact producer, calls to the three generated gesture decisions, and
regenerated artifacts/receipts. These task-authored Verdant migration changes
are provided under the same AGPL-3.0-or-later terms for the Verdant material.
The patch includes its producer changes and exact artifact/source provenance;
the pinned upstream tree supplies the unchanged application sources and tests.

The original authored file and
`frontend/crates/verdant-session/tests/generated_gestures.rs` are unchanged. The
patch SHA-256 remains
`cb8814139b17136bc31632a7cefc9a8276a5dccfc45cc69cd72fed5bd2f29b8f`.
The recorded compiler is
`ef60557fbd2c486ca15885c3e38d92f599f140a3`; the complete app check and seven
EditorSession tests are temporary consumer verification, not publication of
this application or generated crate.

Proto-UI's independently authored compiler templates and GPUI SDK/support retain
their own MIT attribution. In particular, the separate
`.proto-ui/gpui-native` support crate carries its own MIT notice; that declaration
does not license Verdant's authored gesture decisions or translated component.
The migration patch does not make Verdant application code a Proto-UI package
dependency or change the licenses of unrelated files in this repository.

## Retained generated-manifest defect

The historical generated data artifact
`frontend/proto-ui/generated/gesture-decisions/Cargo.toml` contains
`license = "MIT"`, emitted by the existing `rust-data-source.ts` producer.
**That hardcoded metadata does not relicense the input source or its translated
business logic. It is not evidence that this Verdant-derived crate may be
published as MIT.** The GPUI component's own manifest has no license field;
the separate SDK's legitimate MIT attribution is a different matter.

The exact generated artifact, patch and past receipts are retained without
hand-editing them. Before publishing a downstream crate, the Compiler/consumer
owner must make the authored-source license selection or inheritance explicit
in the producer contract, regenerate the manifest and revalidate provenance.
That publication-metadata work is an open boundary, separate from this
temporary consumer's behavioral verification. No distribution-ready claim is
made for the patch.
