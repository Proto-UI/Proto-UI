# Issue #1047 — ScrollArea text-scrollbar overlap comparison

## Observation

The shadcn-profile ScrollArea demo renders text content that passes through the
overlay scrollbar track. The vertical scrollbar (10px wide, positioned
`absolute right-0`) overlays the viewport content; the viewport does not
reserve padding to avoid the track.

## Upstream comparison

The reference is shadcn-ui/ui v4 `new-york-v4` ScrollArea at
[`4542a3e26d68a524dc5e504156eb09dd3440a3f5`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/scroll-area.tsx),
MIT-licensed (see `internal/fixtures/shadcn-style-source/NOTICE.shadcn-MIT.txt`).

All eight shadcn style variants in the frozen fixture
(`internal/fixtures/shadcn-style-source/upstream/apps/v4/registry/styles/`)
apply identical scrollbar tokens:

```
.cn-scroll-area-scrollbar {
  @apply data-vertical:h-full data-vertical:w-2.5
         data-vertical:border-l data-vertical:border-l-transparent
         data-horizontal:h-2.5 data-horizontal:flex-col
         data-horizontal:border-t data-horizontal:border-t-transparent;
}
```

The upstream viewport has **no padding reservation** for the scrollbar track.
The track is absolutely positioned over the content area. Text flowing under
the track is the upstream overlay-scrollbar behavior.

## Conclusion

The observed overlap **matches upstream**. Per the issue acceptance criteria:
"若上游同样重叠，记录为预期而非修复" — recorded as expected behavior, no fix
applied.

## Boundary

- #861 covers corner tile/continuity.
- #853 covers contrast measurement.
- This file records only the viewport-content / track overlap comparison.
- No padding, track hiding, or measurement-threshold changes were made.
