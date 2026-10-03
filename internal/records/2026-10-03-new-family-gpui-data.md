# New family data in the existing GPUI path

Date: 2026-10-03

Non-normative implementation record for #798, following #792 / #795 and retaining #687 ownership. Baseline: #795 source `355e0973a5043dd4161306a4d46a14442cf990f4`.

## Bounded data flow

The existing GPUI style-fixture generator now reads `DRAFT_FAMILY_STYLE_TOKENS` produced from the two real Prototype sources. It records only unvarianted tokens, as before; the native default Rule plan produces the applicable flat token list instead of Web selector variants. Theme maps come from each family's actual `renderThemeCss`, using raw variable names before the shared prefix/radius translation, not from copied Rust palettes. Bootstrap keeps its historical palette across schemes; Liquid's opaque fallback has distinct light/dark palettes.

The resulting catalog contains 280 tokens with declarations and the same six intentional no-declaration markers. Added `background-image` declarations retain their exact unsupported-property diagnostic in the GPUI mapper. The Bootstrap primary gradient's existing flat fallback is `#006dcc`; neither that fallback nor successful color mapping proves a gradient was painted. Shadows, outlines, backdrop-filter and other recorded gaps remain gaps.

## Verification designed for this increment

- Generator tests independently pin the new names, source colors, single variable prefix, preserved gradient input, flat state reset, normal font weight, line height and disabled opacity.
- Rust theme tests pin both scheme policies and resolve the generated radius chain.
- GPUI mapper tests assert the supported fill/opacity/radius subset while requiring an incomplete result with the exact missing gradient/shadow diagnostics.
- The existing macOS headless GPUI harness lays out each family's padding/border/radius/fill subset and verifies its actual paint callback runs. The fixture owns explicit relative placement; it does not decide the open implicit-position policy for real Feedback roots in #719. Empty content isolates geometry (Bootstrap 26×10, Liquid fallback 42×18 at 16px rem); this is not full Button rendering or pixel evidence.

Local generator evidence: the two new tests first failed against the original fixtures (missing families and gradient token), then passed after generation. Four focused fixture assertions and direct `node --import tsx scripts/gpui/generate-style-fixture.mts --check` pass. The full existing script suite invokes the tsx CLI, whose IPC listener is blocked locally (`listen EPERM`); no passing full-suite result is claimed. Cargo is not installed in this environment. Exact-head Linux Rust and macOS GPUI CI remain required before acceptance.

## Remaining dependencies

Live dependency check on 2026-10-03 also found open PR #719: it supplies the root Feedback style transport (`ProjectionTransaction.style` / `style.apply`) from the real runtime peer to the Rust host. The new styled-family roots depend on that independently owned stack; source-derived token availability alone does not make those roots render. Its [open reconciliation question](https://github.com/Proto-UI/Proto-UI/pull/719#issuecomment-5857799057) concerns #726 implicit `position: static` diagnostics versus root-style fail-closed behavior; the author reports empty and non-positioned root projections rejected on current main. No accepted resolution was found in the issue comments or reviews during this check. Open #731 supplies application-owned sampled reduced-motion meta, not a mounted preference invalidation guarantee.

This changes no semantic Runtime, host protocol, public Adapter profile or style-lowering contract. It does not register the two Prototype bundles with the native runtime peer, test native Button input/focus/a11y, implement gradients/shadows/materials, or prove Compiler parity. These remain #792 / #687 / #732 / #733 work; reactive preference and material policy remains #793. Flutter and Qt still need actual backends and evidence. The data slice does not complete the user's native-family request.

## Current-main reconciliation (2026-10-03, `bc5acfd6`)

The earlier evidence above describes the original #795-based candidate. A normal local merge now incorporates main `bc5acfd6a1de0c5b70bbf8961ea9955b9e1fb888`, including #800's source-aligned Brutalist palette/radius changes and #801's live preference/support consumer. Both JSON fixtures were regenerated through the generator, not conflict-edited. The current result is 282 tokens: 276 with declarations and the same six no-declaration markers. The exact mapper inventory is 30 unsupported properties: main's 29 plus `background-image`. No mapper implementation changed.

The Liquid source now includes gated `bg-secondary/80` and `backdrop-blur-xs` enhancement inputs. This data slice retains them, and a new mapper case requires the supported alpha fill plus the exact `backdrop-filter: blur(4px)` / `UnknownProperty` diagnostic and an incomplete mapping. The existing shadow and gradient diagnostics remain. Data availability does not supply the native live preference/support capabilities, register a family Prototype in the peer, or make its root style reach Rust paint.

Current local evidence uses Node 24.19.0 and Corepack pnpm 10.32.1:

- Five selected `scripts/gpui/test/style-fixture.test.mjs` assertions pass: conditional declarations, existing Spinner diagnostics, complete single-prefixed family theme keys, gradient/reset input, and exact shadow/blur input.
- Direct `node --import tsx scripts/gpui/generate-style-fixture.mts --check` passes. Four additional direct-Node controls accept an unchanged theme copy and reject a missing Liquid dark variable, a double-prefixed Bootstrap variable and a missing Bootstrap family. These run the actual generator in temporary files; they do not replace the repository's full CLI suite.
- `check:styles:preset`, `check:prototype-catalog`, focused Prettier checks and `git diff --check` pass.
- The full `test:gpui-scripts` suite is not rerun under the already observed tsx IPC restriction. Cargo, rustc and rustfmt are unavailable locally; no Rust compile, lint, layout, prepaint, paint or screenshot result is claimed. Browser processes remain unavailable and were not retried. Broad workspace builds/tests are not part of this local bounded verification.

After approved publication, acceptance still requires exact-head `rust` and `rust-macos` jobs from `.github/workflows/ci.yml`: Rust format, platform-independent parsing/theme/color/length tests, and macOS GPUI mapper plus actual headless layout/paint-callback tests. The callback oracle proves only execution of that test fixture's paint phase; it is not decoded-pixel or full Button evidence. #719's root Feedback transport and #726 reconciliation remain prerequisites for the separate actual Prototype-to-native endpoint.
