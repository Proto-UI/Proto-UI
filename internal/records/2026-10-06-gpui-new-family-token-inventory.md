# New-family token inventory against the current GPUI map

Agent: dot. ModelTrace: not measured (owner-authorized exemption).

Input is the integration owner's frozen style fixture blob
`40c39959f7fb2f75c4afe0131b4da3215c8604d9`, SHA-256
`43a995434efaa6bda356fb8b590ef7b89b37638cb63aafb09891197bcaa9b1aa`:
337 compiled tokens, six without declarations. Relative to Finf689 this adds
22 tokens and changes select-none to emit the WebKit alias too.

Existing gap/padding/radius/max-width/border-top mapping already covers their
new finite values. Outline, text alignment and whitespace remain explicitly
unimplemented properties. New overflow-wrap and overflow-x:auto remain exact
unimplemented property/value inventory entries, not inferred support.

Two bounded production mappings accompany the inventory:
- The prefixed user-select:none declaration is the same non-selectable native
  plain Text policy as the already supported unprefixed value. Merely listing
  it as unknown would now reject entire Label/root projections. Other selection
  values remain rejected; this does not implement selectable passive text.
- m-0 explicitly resets all four native margins to zero. Nonzero, multi-value,
  automatic and percentage forms remain rejected before any partial mutation.

Two Rust tests encode positive and negative controls. They are source-reviewed,
not locally executed: this environment has no Rust toolchain. The existing
original-pin Finf CI must compile, format and run them. No new GPUI source,
renderer, toolkit install or native paint admission is claimed. Text wrapping,
conditional scrolling, full family layout and all material realization remain
required unfinished work.
