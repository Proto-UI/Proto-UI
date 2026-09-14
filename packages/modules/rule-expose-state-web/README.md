# @proto.ui/module-rule-expose-state-web

Proto UI module that provides rule-based web state expose capability for adapters.

## Purpose

Lowers a bounded subset of Rule conditions into internal Web selector style tokens. Authority is [M-RULE-EXPOSE-STATE-WEB-0001](../../../spec/modules/M-RULE-EXPOSE-STATE-WEB-0001.yaml), with partial conformance evidence in [T-RULE-EXPOSE-STATE-WEB-0001](../../../spec/tests/T-RULE-EXPOSE-STATE-WEB-0001.yaml).

The Module consumes RuleIR and Expose State Web bindings, writes through Feedback, and filters successfully lowered rules from subsequent default evaluation. It has no author facade or direct DOM capability. Unsupported inputs, range State, standalone negative conditions, mismatched literal types and values outside the bounded selector encoding retain the default Rule path.

Optimized contributions belong to one view epoch: unmounting/detach revoke them and remount rebuilds against current mappings. Terminal disposal clears candidates and cannot reactivate them.

Official Web profiles currently declare **partial support**. The contract still requires equivalent execution; these tests do not establish arbitrary stylesheet availability, mixed CSS cascade equivalence, independently writable State/native pseudo-class equivalence, or immediate replanning after an attached view changes its mapping/policy. Those are explicit Module open questions. Native variants and the narrow `colorScheme = dark` lowering do not stabilize the evolving Rule Meta API.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-rule-expose-state-web@0.3.0-alpha.0
```

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/generated/`
- `src/index.ts`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`
- `@proto.ui/module-expose-state-web`
- `@proto.ui/module-feedback`
- `@proto.ui/module-rule`
- `@proto.ui/types`

## License

MIT
