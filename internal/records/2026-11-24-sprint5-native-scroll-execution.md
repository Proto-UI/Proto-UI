# Sprint 5: Qt/Flutter axis synchronization and generated GPUI Scroll execution

This record binds bounded native results to their actual sources for #1144 and #1056. It supplements the [GPUI composed Scroll record](2026-11-23-sprint5-gpui-composed-scroll-native-consumer.md) and the separate Qt native consumer record. It does not promote the dormant Qt/Flutter public profiles, accept every backend operation, or substitute offscreen execution for physical input and platform accessibility acceptance.

## Existing axis operation and independent review

`C-SCROLL-AXIS-SYNC-0001` defines callback-only changes to `axes`, with omitted or unchanged values preserved, setup-owned projection/follow policy unchanged, detached intent retained for a new physical view, and host facts authoritative. The definition remains draft. The implementation repair follows that existing boundary rather than adding a backend-specific public API.

The original Qt guest lacked this operation. Its bounded control suite passed four of eight cases before the repair and all eight afterward. Qt now validates the axis before mutation, leaves setup policy intact, and writes only to the ready current native root. Four explicit old/new-root witnesses remain guest protocol evidence; the later real Qt consumer supplies separate native evidence.

Flutter retires the old request/controller generation and pending movement when the axis changes. It preserves retained intent while detached and obtains new facts from the attached native controller. `ObjectKey(controller)` prevents a horizontal Scrollable from reusing a vertical ScrollPosition. Horizontal-only content uses a top-start `OverflowBox` under the finite existing viewport; the native viewport still clips paint and hit testing with `Clip.hardEdge`.

The source emitter's generic finite-record configuration bridge evaluates its argument once and converts the admitted record to the native map representation. Optional field presence remains distinct from explicit values. This fixes the actual authored `scroll.sync(...)` consumer without admitting arbitrary records or activating `flutter-source-v1`.

The frozen author tree is `09a74823cf24645c803f5aa7f69465572b94189f`, based on `2df421b1fc55cc0649be6675c0ee46a69ad9316f`. Its 11-file patch has SHA-256 `decd5e09314ae0f181f6e41c61285ee4b8898e2427487e8de80e28c5f1bff20f`. The independently reviewed final Flutter production hashes are:

| Source | SHA-256 |
| --- | --- |
| `packages/compiler/src/flutter-native-modules.ts` | `870cf3d50a26d2f693590216a5039167905a5a660ac987c4df047f197ffd87de` |
| `packages/compiler/src/flutter-source.ts` | `53b7d3f8915515462c8f9ad6c81ae2daa29898b86cb341d6a5b157715029e928` |

The separate reviewer executed five Qt guest probes and reviewed the final Flutter delta. The final v2-to-v3 native oracle diff adds four assertions and deletes none: physical size, viewport dimension, clipping, and fresh position identity are all retained. This is technical source review, not a GitHub approval or an independently repeated native SDK execution.

## Actual Flutter SDK results

Execution used Flutter 3.47.5 / Dart 3.13.4 on Linux in the existing native container. The emitted Dart and the real Widget test were produced from authored source through actual parsing and cold IR validation. Generated product files were not hand-edited.

| Frozen attempt | Observed result | Disposition |
| --- | --- | --- |
| Original record bridge | Native compilation failed before any of the 17 cases executed | Preserved; zero native test passes |
| Bridge repair, before axis geometry repair | 15 passed, 2 failed | All 14 original cases passed; the new tests exposed 1400px cross-axis overflow and reuse of the retired ScrollPosition |
| Final bridge and physical-axis repair | **17 passed, 0 failed** | Original 14 plus all three new axis journeys; generated artifact drift was empty |

The final native result is an actual `flutter test` execution. It is not a claim that the Vitest orchestration wrapper ran in this auxiliary environment. The registered hosted lane separately requires one executed wrapper and all 17 native cases; an unset SDK or skipped wrapper supplies no acceptance.

The final input archive is 65,473 bytes, SHA-256 `fe9cec4f3a0a4ad91aa23b351cc22f167dcae2b46ac4e3bbe2c7cf7c2da0fa10`. The final native archive is 7,254 bytes, SHA-256 `94200d11df637597e59a2c25158713cc6e3d75e4ccc404cd4294dbe9dd43f404`; its native log hashes to `0edbace6e85a7bd4b7da3274c1b1770451a0daad6089c6306de7c9ac2604d772`. The native source receipt hashes to `3a245bbeae8bfc49bfeb3285961d5a35eefddc71abcf4557fd1daa5b71866a76`.

After integrating the 11-file patch into the root candidate, a fresh actual producer regenerated all 18 payload files byte-for-byte. That continuation preserves the native result for those exact generated files; it does not describe a second SDK execution. Later Qt-only request changes do not relabel this receipt as full-current-tree Qt acceptance.

## Source and GPUI evidence boundaries

The root axis/record/call selection executed **82/82** tests in three files on the then-current combined source. A strict production dependency closure rooted at the two Flutter implementation files and Qt controls checked **298 source files with zero diagnostics**. This bounded check is not the full workspace type check. An earlier missing-`zod` authoring setup failure remains in the archive; the real root authoring invocation subsequently passed the changed axis test definition.

The generated GPUI composed Scroll consumer has a separate exact-source record: 39 modules were produced, the full locked Cargo graph and default published SDK check passed, and **4/4 actual native cases** executed. Those cases exercise geometry, retained paint, native platform events, replacement and duplicate-view lease retirement. Module counts are not test counts. The original official Base Viewport handle-array refusal remains recorded and is not rewritten into a pass.

The integrated CI evidence controls initially exposed a stale expected Flutter count of 14. The count was corrected to the actual 17-case oracle; the original integration failure is retained. No timeout, original assertion, public-profile admission, dependency-graph filter or native execution requirement was relaxed.

## Retained raw materials

All files below are under `internal/records/evidence/2026-11-24-sprint5-native-scroll/`; the adjacent manifest records their exact bytes and SHA-256 values.

- `native-axis-source-and-review.tar.gz` retains the original source red/green reports, frozen patch and manifest, strict closure output, authoring attempts, root byte-continuation receipt, and all three independent review rounds.
- `native-first-attempts.tar.gz` retains the first real Flutter compilation failure and the separately bounded GPUI preparation failures.
- `flutter-v2-native.tar.gz` retains the actual 15/17 result; it remains a failure.
- `flutter-native-package-v3.tar.gz` and `flutter-v3-native.tar.gz` retain the exact final authored/generated inputs and successful native execution.
- `composed-14480b8f-native.tar.gz` retains the GPUI test compilation failure, actual corrected native 4/4 result, source hashes and dependency receipts.

Final combined hosted acceptance, original full-operation inventories, all required consumers and the separate performance/physical/owner decisions retain their own criteria. This record closes neither complete execution Issue by itself.
