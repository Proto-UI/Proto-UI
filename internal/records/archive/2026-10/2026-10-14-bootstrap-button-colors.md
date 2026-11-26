# Bootstrap Button seven-color endpoints

Date: 2026-10-14. Candidate against PR #887 head `61653e5795a8b881b200c4a2f061152cb967ce6b`, tree `23c3452070aa3399f67b93fdbeb210834d20f72a`. This is a draft implementation record, not publication or browser acceptance.

## Source and bounded change

The fixed reference is [twbs/bootstrap v2.3.2 compiled CSS lines 3198–3559](https://github.com/twbs/bootstrap/blob/v2.3.2/docs/assets/css/bootstrap.css#L3198-L3559), blob `b725064aab21e434d29209d259d3892478aa9536`. Its final modern-browser cascade, rather than earlier fallback declarations, determines these seven variants:

| Variant | Gradient start / end | Resting background |
| --- | --- | --- |
| default | #fff / #e6e6e6 | #f5f5f5 |
| primary | #08c / #04c | #006dcc |
| warning | #fbb450 / #f89406 | #faa732 |
| danger | #ee5f5b / #bd362f | #da4f49 |
| success | #62c462 / #51a351 | #5bb75b |
| info | #5bc0de / #2f96b4 | #49afcd |
| inverse | #444 / #222 | #363636 |

Default text is #333 with 0 1px 1px white at 75%; colored text is #fff with 0 -1px 0 black at 25%. Top/right/left borders are black at 10%; default bottom is #b3b3b3 and colored bottoms are black at 25%. Earlier hexadecimal fallbacks do not override these later declarations. The earlier primary active text alpha is also overwritten in the source; no persistent active/toggle ownership is introduced here.

Base focused/hovered states retain the gradient and repeat-x at 0 -15px with its endpoint background. Pressed removes the image but retains -15px when hovered/focused; an exposed press without those facts stays at 0 0. Disabled uses the endpoint without image, opacity 0.65 and no painted shadow. Base clears hover/focus when disabled, so the disabled endpoint is 0 0. Disabled wins over the pressed shadow. The existing stronger focus-visible ring remains an intentional accessibility adaptation.

## Physical token ownership and compatibility

A red implementation exposed the existing Core merge constraint: all background color/image/position tokens share one semantic group, text-shadow-like tokens collide with text color, and directional border colors share a group. This slice does not repair or rename around Core grouping. Instead each finite, explicitly whitelisted recipe owns the complete affected property group: background owns color/image/position/repeat, text paint owns color/text-shadow, border paint owns all four edge colors. No arbitrary CSS, URL, function or injection grammar was added. Prototype and CLI tests check the actual merged result, strict rejection, size/radius/shadow/ring separation and explicit restoration.

Legacy passive paint exports and their existing CLI translations remain unchanged. Independent review compared all 405 preexisting generated tokens with exact-base translation: document and Shadow CSS are byte-identical (SHA-256 `09e179ad0d475d15780ac73a6ee661d3b3902bc3a6af9bf8c27c91a52d26d95d`). The narrower legacy Button consumer output is also unchanged (SHA-256 `20b89ceb8c2efaaa7c107326a3e04488cd86616771531fe299b6fea05aac1324`). Form, AlertDialog and Surface retain their prior appearance; their own upstream conformance gaps remain with their owners. A future neutral Core capability could split physical-property groups with explicit conflict semantics; that requires a separate owner/design review, not a component workaround.

## Evidence and boundaries

The new palette assertions failed on exact base (7 failing, 7 passing). The initial split-token attempt also failed (12 failing, 2 passing), revealing the merge issue above. Complete recipes then passed the targeted tests. The final focused suites cover 20 Button and 10 physical translator cases, including all seven variants, four sizes, switching, genuine raw-prop removal, focused/hovered/pressed/disabled transitions, and legacy exports.

The public demo exposes seven variants through shared prototypes. Eight real-Web runtime/root-font cases (four runtimes at root16 and root32) were added to the existing fixture for exact computed colors, gradients, positions, text shadows, four borders, actual focus ring/pressed/disabled shadows, same-node switching, four-size dimensions and individual pointer/Enter/Space activation counts. Each source-version-labelled PNG/JSON snapshot is authored for its actual variant/state. Browser restoration explicitly supplies defaults because the fixture's patch API cannot remove props. Unit tests perform real removal. Existing root16/root32 dimension tests remain; changing root font size is not actual browser zoom.

Validation completed: seven focused suites pass 197/197. The wider CLI/family run has 680 passing and seven failing tests across five files; exact-base reproduction has 656 passing and the same seven failures across the same five files. Existing failures concern lowered-hook scanning, default preset active-selector expectations, Brutalist generation/reference tokens and the full-family source-vocabulary scanner. These are retained as baseline failures, not counted as green. The prototype catalog likewise reports the same 536 diagnostics with byte-identical exact-base output. Normal CLI build, website generation, generated-token check, changed spec-authoring and targeted website TypeScript pass. Workspace TypeScript initially lacked the generated website Shadow style module, then passed after the normal generator supplied it. No unrelated baseline failures were edited.

No new browser execution is claimed by this candidate. Exact-publication-head native execution and source-bound PNG/JSON artifacts are required next. The 100ms upstream background-position motion, actual browser zoom, legacy palette contrast acceptance, link/block recipes and complete target acceptance remain open. No Runtime, Compiler, IR, collector, global page CSS or other component ownership changed. Historical records and draft lifecycle are preserved.

Agent: dot
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
This role declaration is not authenticated model identity, permission, independent review, or acceptance.
