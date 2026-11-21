# Native browser premise repairs after the first candidate

This record preserves failures from [run 44930338506](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506) at `031d9b661025312244d31506758eed989cc71f94`. It explains two test-premise repairs; it does not certify their replacement candidate. The accompanying [JSON record](2026-11-22-native-browser-premise-repair.json) binds the original artifacts, observed values, changed test sources and static comparisons.

## Liquid boundaries must be exercised during contact

The React hover [artifact 14717556584](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506/artifacts/14717556584) retains six failing `negative-idle` observations: `source-edge`, `neighbor` and `accordion-tight`, each in light and dark. Each waited for opaque fallback until the existing approximately eight-second readiness budget expired. Actual receipts were `self-optical`, `rendered`, contact `rest`, and Base `pressed=false`. Their actual carriers matched the host's unexpanded dimensions. The old observation expected maximum contact expansion even at rest.

The current sink reserves expansion for active contact, pressed keyboard state and the finite release tail. These three fixture layouts intentionally intersect that expanded footprint while permitting the ordinary host footprint. The test now establishes that idle and hover have zero expansion, validates the actual visible canvas geometry, and then uses trusted `page.mouse.down()` to exercise the original rejection boundary.

| Fixture | Preserved rejection under native press | Independent layout premise |
| --- | --- | --- |
| Source edge | `source-bounds-unavailable`, safe opaque fallback | Host fits the actual canvas at rest; its nearest canvas margin is below the maximum contact bound. |
| Neighbor paint | `source-overlapping-content`, safe opaque fallback | Actual neighbor begins 1 px beyond the host, overlaps its vertical span and lies inside the maximum contact bound. |
| Tight Accordion | `source-overlapping-content`, safe opaque fallback | Actual portal destination gap remains approximately 1 px, greater than zero and below the maximum contact bound. This is not evidence about the ancestor border's admission. |

The maximum contact bound is independently computed from native host dimensions as `ceil(max(width, height) * 0.08 + 1)`, preserving the existing displacement, dilation and antialias allowance. A rejected surface has no carrier, so its actual fallback paint outset cannot establish the proposed expanded footprint. Actual canvas and neighbor bounds are now retained in the same raw capture as the existing host and portal geometry.

All opaque fallback, opacity, contrast, image absence and carrier absence assertions remain. Release and pointer exit must restore the same source's zero-expansion optical surface after the finite tail. The existing eight-second observation and 240-second case bounds are unchanged. `authored-before` and `clipped-source` retain their original idle/hover/press/release fallback journey: the archived receipts respectively report `contact-carrier-pseudo-conflict` and `source-not-visible-or-composited`.

No native press or release result is invented from those earlier idle captures. The next exact candidate must prove these journeys, including the separately repaired release lifecycle.

## Menubar observes resolved focus paint

[Browser shard 8, job 136925440952](https://github.com/Proto-UI/Proto-UI/actions/runs/44930338506/job/136925440952) completed with **70 passed and 10 failed**. Eight failures were the four runtimes in both themes stopping at the same obsolete token assertion, `data-[focused]:bg-accent`. The actual token list already contained `bg-accent text-accent-foreground`.

The applicable definition is `menubar/item.proto.ts`, which wires Base `focused` and `focusVisible` into `setupMenuItemPaint` in `dropdown/visual.ts`. Its default focused Rule supplies those concrete tokens. The test now requires native focus in the captured frame and exact membership of both resolved tokens. Every original computed background/foreground check, keyboard navigation, activation and geometry assertion remains. Those later checks were not reached by the failed historical runs; this repair does not claim that they passed.

The other two failures are retained as product observations. At 100% font size, the WC placeholder textarea measured 91.296875 px against a React/available width of 88 px with reset disabled, and against 84 px available space with reset enabled. The original differences **3.296875 px and 7.296875 px** still exceed the unchanged **1 px** threshold. Neither that test nor its product source is changed here.

## Verification and remaining acceptance

Both changed test files parse and pass formatting and whitespace checks. Static AST comparison against the historical candidate confirms unchanged case declarations and deadlines. Liquid preserves 136 of 137 original assertion expressions; the one replacement measures the same Accordion gap against the independently derived contact bound. Its `optical`, `fallback`, `sameGeometry` and `settle` functions are unchanged. Menubar preserves 39 of 40 original expressions, replacing only the stale token expression with three focus/token assertions.

No local browser or full type check was run for these two changes. Historical native failures remain failures. The next exact candidate must supply native acceptance for the repaired Liquid and Menubar journeys and continue to report the unresolved textarea geometry observations.
