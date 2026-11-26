# Shared SVG validation without discarded renderer factories

The fixed owned-template snapshot previously created the entire renderer-factory closure at module load and constructed an SVG node only to discard it after validating copied props. That top-level call also kept unrelated template support in small consumers' bundles.

This change moves the existing closed tag schema and allowed/required validation into one internal module. Ordinary SVG factories retain their validation, required field order and errors. The owned snapshot invokes the same validator on its already captured plain copy, preserving scalar/finite checks, getter capture and frozen output. It no longer allocates a throwaway renderer, props copy or node. The shared eight presentation fields no longer require a new Set for every node; tag-specific fields remain separate. The internal helpers are not re-exported from the public core entry.

## Actual validation boundary

The final candidate ran all 30 original core test files: 466/466 passed, zero failed or pending. Scoped TypeScript extending the original root configuration exited 0. The complete source snapshots, reports and toolchain identities are preserved. This is not a newly executed workspace type check or native acceptance.

The comparison uses Node 24.22.3 and esbuild 0.25.12 with the original nine-entry package measurement script. The clean baseline is 03fd99367e397182809cc279e167ab7fe16ad1ad. The final working-tree candidate was explicitly dirty and stable before/after measurement. Its separate CLI fixture dependency edit appears in the source envelope but is absent from every measured bundle's actual input closure.

| Entry | Clean baseline gzip | Final candidate gzip | Change | Ceiling at measured source |
| --- | --: | --: | --: | --: |
| lucide/icons/x | 2941 | 1797 | -1144 | 3000 |
| lucide root | 637391 | 635917 | -1474 | 700000 |
| core root | 12686 | 12605 | -81 | 12600 |
| runtime root | 104143 | 104105 | -38 | 103100 |
| adapter-react root | 172416 | 172338 | -78 | 170600 |
| adapter-vue root | 171179 | 171098 | -81 | 169400 |
| adapter-web-component root | 206747 | 206671 | -76 | 204000 |
| prototypes-base/button | 5338 | 4198 | -1140 | 6000 |
| prototypes-shadcn/button | 7871 | 6741 | -1130 | 7900 |

The retained strict measurement still exits 1: core is five bytes above 12600, and the other four whole entries remain above the older ceilings used in that measurement. This commit does not change any ceiling, failure rule or test deadline. Main 824's separately recorded numeric transaction is retained by the preceding merge; measurement on the final clean integrated head remains pending.

The earlier shared-field-only and shared-tag candidates, their complete reports, and the initial missing formatter-plugin failure are retained. The latter stopped before product tests. Counts across repeated candidates are not added together.

## Evidence

[svg-validation-evidence.tar.gz](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-svg-validation-allocation/svg-validation-evidence.tar.gz) contains 93 individually verified payload files plus its manifest. It is 2323750 bytes, SHA-256 cb9e011de9f9b86707fd66b5396b64ba1f4db621b9b35a3a1fad563150a64c47.

Final source SHA-256:

- packages/core/src/spec/template.ts: b1d9800a9bb71907c85e8de6923048839b4144d8f00898362221b2f7483cb522
- packages/core/src/spec/owned-template-blueprint.ts: 99fc68f49987facedd31c01c0121f92b188d6f2c20769202d47657464a055a75
- packages/core/src/spec/svg-tags.ts: 816196bcb9d6899d9185a4dfd11ebe07398a7717afccdb9b5e56e46f95e30bf0
