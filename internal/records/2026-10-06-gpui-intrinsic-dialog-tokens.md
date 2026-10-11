# Intrinsic Dialog token lowering

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
Date: 2026-10-06. Base: `1d166ee703d2653cc32109dec914c31ae28bd869`.

The next frozen style vocabulary has 343 compiled tokens and 6 declaration-free entries. Its exact blob is `a01dd9fcd2aa7f96d52118a1a19e1c8fb5af9d02`, SHA256 `10941884ab2b7ff81503e592e02d3fca0cfeb15dbc0812e29328cbfb08eebb2e`. Compared with the 335-token formal head it adds `flex-wrap-reverse`, `grid-cols-1`, `h-auto`, `min-h-7/8/9`, `pb-1` and `pr-1`.

The five ordinary minimum-size and padding forms already use mapped properties. The remaining three now lower through exact public fields at the unchanged GPUI pin:

- `height: auto` -> `Length::Auto`. Previously height passed through the absolute/percentage length parser, which does not accept this keyword; it was not already supported.
- `flex-wrap: wrap-reverse` -> `FlexWrap::WrapReverse`.
- `grid-template-columns: repeat(1, minmax(0, 1fr))` -> `GridTemplate { repeat: 1, min_size: GridTemplateMinSize::Zero }`.

The last two are the exact fields used by the pinned upstream's public `Styled::flex_wrap_reverse` and `Styled::grid_cols` implementations: [fixed upstream source](https://github.com/zed-industries/zed/blob/62e5991dd0f0c8a3af8d5e7e9c4652490d468db8/crates/gpui/src/styled.rs). The patch does not add a second token compiler or infer arbitrary grid syntax. Synthetic unknown wrap/grid forms and intrinsic keywords remain negative controls.

Two mapper tests and one actual GPUI automatic/minimum-height layout test are prepared. Rust is not installed in this executor, so these new tests are not claimed green; they require the original-pin CI. The existing exact-head 1d166ee Linux Rust and T0 jobs passed, but they predate these new tokens and do not validate this patch. The live fixture is owned by the integrator and is not included or regenerated here. The 31-property/13-value inventory remains unchanged because none of these exact new forms is now silently ignored or newly listed as unsupported.

This finite mapping does not complete Dialog layout, wrapping under every font/viewport, scrolling, focus, accessibility relationships, Material or GPUI projection parity. It is independent of the larger pending AvailableSpace transport/layout slice.
