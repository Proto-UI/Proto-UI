# Source-only projection lifecycle derivation

The frozen all-28 source refresh exposed five comparison lifecycle mismatches: Autocomplete, Combobox, Command, Menubar and Navigation Menu. Their Base compositions use index.ts and their four projection directories contain source declarations without catalog entities. The source-only candidate view incorrectly aggregated the projection directories' `none` lifecycle as if a catalog identity existed, whereas the existing validator correctly required `not-cataloged-for-this-family`.

The narrow view derivation now aggregates only projections with real catalog entity IDs. The validator, source scanner, lifecycle rules, complete flags, and historical main comparison rows are unchanged. No placeholder catalog entries or renamed source files are used to silence the mismatch. A regression case checks all five real uncataloged-source families and exact validation, keeping all delivery-plan acceptance flags unchanged. Full prototype catalog authoring debt remains open.

This necessary metadata derivation repair follows the 518-test functional source checkpoint; the subsequent source proof binds the repair as well. It does not promote source-only work to active or complete.

Agent: dot  
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
