# SSR CSS-wide context boundary repair

Date: 2026-10-08. Base: `305ced3afb6b6e3127dee8c0f16859ee8661615b`.

The bounded dependency analyzer certified consumed custom-property declarations with `inherit`, `unset`, `revert`, or `revert-layer` as closed values. These definitions depend on inherited or cascade state which this analyzer intentionally does not model. The same gap exists at official `8e8c4ca21801378c11ea055f8f39796f86eeeda6`; it is not repaired by the template-projection changes in this local base.

The repair rejects these four whole, unquoted, ASCII case-insensitive declaration values when dependency traversal consumes them. It does not claim the values are always guaranteed-invalid. In particular, a consuming `var()` fallback cannot make an unknown inherited or reverted value closed. `initial` retains its distinct guaranteed-invalid behavior and can use an outer fallback. Unconsumed definitions, unused fallback branches, quoted strings, multi-token values, and keyword tokens in ordinary `var()` fallback position remain outside this declaration-specific rejection. This is not property grammar validation or a CSS cascade engine.

Authority: [CSS Variables defining custom properties](https://www.w3.org/TR/css-variables-1/#defining-variables) and [CSS Cascade defaulting](https://www.w3.org/TR/css-cascade-5/#defaulting). Existing internal experimental SSR closure scope remains unchanged.

The new source controls failed four cases and passed twenty-one before repair. They cover environment and local definitions, whitespace, comments, uppercase, `!important`, consuming fallback, quoted/multi-token controls, unused branches, `initial`, and the actual `font-sans` compiler rejection path. After repair the CSS-boundary suite passes 25/25. A first accompanying server-suite run passed 7/8; generated closure typechecking failed because this new worktree lacked the existing workspace's nested `@floating-ui/dom` dependency links. This is retained as an environment failure, not hidden as a product pass. Existing dependency links were then supplied and the identical tests rerun: both files passed, 33/33 tests, including generated closure typechecking.

No browser, full build, remote write, public SSR admission or integration is included. Independent source review and final combined checks remain required.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Independent review: conditional cycle candidates

The first repair `0d232643749a52b75c0852a02649c8e6c1c8176a` still accepted a consumed name with both a cycle-producing declaration and a context-dependent alternative, including an `@media` alternative. The union graph marked the name cyclic before the new keyword check, so an outer fallback concealed the unknown cascade branch. Four additional actual-compiler negative controls failed while the prior twenty-five cases passed. The same issue can occur through another member of a multi-name strongly connected component.

The follow-up retains SCC membership and validates context-dependent candidates of the consumed name and its SCC before treating the cycle as guaranteed-invalid. It does not walk outgoing unused fallback branches or globally reject unconsumed definitions. A guaranteed-invalid self-cycle with an outgoing unused context-dependent fallback remains accepted via its outer fallback. After this correction the CSS-boundary suite passes 30/30 and the generated server suite 8/8, total 38/38. The first candidate's false-green boundary is retained here; fresh independent re-review remains required.
