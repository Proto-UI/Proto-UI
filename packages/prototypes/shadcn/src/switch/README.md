# Public Switch style profiles

The ordinary `switchRoot` + `switchThumb` composition and optional-Field `fieldSwitch` + the same `switchThumb` reuse Base Switch behavior. `fieldSwitch` is exported from `@proto.ui/prototypes-shadcn/field`; it uses the existing nearest Field for invalid/disabled/readOnly/label relations, not a second validator or checked owner.

`styleProfile` defaults to `inherit`. Supported profiles are `new-york-v4` (`new-york` alias) and `rhea`; explicit selection wins over the nearest shared style scope, then the compatibility New York fallback. Other profiles are rejected. `size` is `default` or `sm` and belongs to the actual Switch Root. Thumb reads its actual anatomy owner, not an unrelated nearby scope.

Fixed source: shadcn-ui/ui `3d98900e9b73c45f035f8109e9d41ba6a51685e7`, `apps/v4/registry/new-york-v4/ui/switch.tsx`, `apps/v4/registry/bases/base/ui/switch.tsx`, and the Rhea stylesheet. NY keeps a border-box hit region; Rhea acquires the common owner-relative self-region lease from #983. A persistent relative-positioned Root box is an explicit host baseline extension supporting safe dynamic acquisition. It does not give New York an expanded hit region.

Both profiles now project the fixed source CSS transition declarations instead of the earlier narrower resident motion writer. The generic transform transition includes independent translate, scale and rotate. Reduced-motion CSS removes transform transitions. Native intermediate motion is a separate acceptance gate.

## Supported composition boundary

Ordinary standalone controls and sibling FieldLabel/FieldSwitch composition retain their own keyboard focus ring. Rhea invalid paint is available only through real optional Field facts. The wrapped card-label outer-ring composition is not supported: upstream ancestor `group-has(:focus-visible)` cannot be replaced by sibling Label focus or a Field-wide focused flag. This limitation remains separate from ordinary Rhea support and requires a future public wrapping-label composition contract.

No drag enhancement from #498, arbitrary CSS, new validation state, caller-node replacement or website-specific paint is introduced. Source/token tests, four-adapter DOM tests, and exact-head native evidence are separate claims.

## Draft dynamic-theme evidence debt

The fixed modern upstream globals use multiplicative radii (`2xl = radius * 1.8`), while the existing generic Proto theme variable uses `radius + 8px`. They agree only at the default 10px radius. This draft's default-radius measurements must not be presented as arbitrary-radius conformance. The shared modern-family radius projection is being reconciled separately without changing generic or legacy New York theme meaning; non-default-radius parity remains an acceptance blocker for this draft.
