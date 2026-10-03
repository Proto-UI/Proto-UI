# Bounded Meta bundle-cost review (2026-10-03)

Proposal/evidence only. This change does not modify any budget ceiling or admit new semantics. It accompanies #801 / #793.

## Measured sources and method

- Official initial #801 head: `1afeb4c31601740087f98a16e7a83f7368095d6d`; the ordinary CI tested merge `3fef97fa29da83b7a0edbb0faf0fa9a69904f755` over main `a1af2e64fe16f2d6dd96f701feaeea98e651511c`.
- [Official public-package job](https://github.com/Proto-UI/Proto-UI/actions/runs/37125827050/job/111210828561) built all 44 public packages before the unmodified `scripts/analysis/package-budgets.mjs` gate.
- Local baseline is `927afec4` (same measured package source, normal main merge plus fixture-only repairs). Local main comparator is exactly `a1af2e64fe16f2d6dd96f701feaeea98e651511c`.
- The independent checkout built all 44 public packages without modifying another checkout's workspace links or dist. After the helper change only `@proto.ui/module-rule-meta` was rebuilt through the official `buildPublicPackage` function, including declarations and JavaScript import smoke.
- The budget script bundles the declared source entries. Root tsconfig paths resolve internal workspace imports to source; it is not a dist-only measurement. Settings are unchanged: browser ESM, es2020, minification and tree shaking, external non-workspace dependencies, gzip level 9.
- Local: Node v24.19.0, zlib 1.3.2.1-motley-3246f1b, esbuild 0.25.12, linux x64. Official: Node v24.21.0, zlib 1.3.2.1-motley-8002e91, same esbuild/platform. Despite the environment version difference, every initial baseline minified SHA-256 and gzip byte count exactly reproduced the official job. Final CI still owns final environment validation.

## Gzip measurements

| Entry | Main | Initial candidate | Shared lease | Delta from initial | Existing ceiling | Remaining excess |
| --- | --: | --: | --: | --: | --: | --: |
| runtime root | 66024 | 66724 | 66620 | -104 | 66500 | 120 |
| adapter-react root | 85641 | 87284 | 87180 | -104 | 86500 | 680 |
| adapter-vue root | 85384 | 86995 | 86900 | -95 | 86500 | 400 |
| adapter-web-component root | 88820 | 90456 | 90337 | -119 | 104500 | 0 |

The Runtime increment over main is portable source/lease ownership and fixed-key validation. The additional Adapter increment includes Web preference observation, finite support checks, default-reader handling and capability wiring. The family prototype consumer is not imported by these root entrypoints. These whole-entry deltas are not additive estimates of individual file gzip sizes.

## Minimal optimization and preserved semantics

`createKeyedMetaLease` is private implementation machinery, not a public generic reactive bus. Each invocation owns independent source, keys, generation and disposer closure state. Preference and style-support capabilities remain separately paired and subscribed. The old colorScheme code and Web provider are unchanged.

The shared call site samples authored keys, getter and source separately for each lease. This preserves reentrant host behavior when the preference subscription synchronously replaces the getter or the support source; a snapshot captured for both capabilities would incorrectly retire the replacement support lease. Dedicated Runtime and helper counterexamples cover that interleaving, source loss, one capability's recovery while the other stays active, old callbacks and reentrant release during subscription.

A class-based helper saved less gzip. A descriptor bridge and a reference-counted Web provider did not improve this bounded result and were discarded. Source-line reduction alone is not the compression result. No identifier-obfuscation, functional omission, budget-script change or threshold increase was used.

## Review decision still required

The optimization does not restore all existing ceilings: Runtime remains 120 bytes over, React 680 bytes over and Vue 400 bytes over. Review the remaining measured capability cost explicitly rather than silently treating green functional tests as budget approval. One separately reviewed numeric proposal could preserve the old values in the historical comments and use Runtime 66,800, React 87,500 and Vue 87,200, leaving only a few hundred bytes of headroom at this candidate. These are discussion numbers, not accepted thresholds; retain the current gate until a maintainer accepts an exact bounded proposal with final-head evidence.

Alternative: authorize a separately scoped investigation of established runtime/adapter paths. This cleanup does not alter old colorScheme or remove required fallback/lease semantics to force a few hundred bytes under a ceiling.

## Artifact fingerprints

### Initial exact-reproduced baseline

- runtime root: minified 265296 bytes, SHA-256 `4eeca4abad86f1829247cf2268df5b657cb4e3b2baa6965bc572c3563c22e40b`
- adapter-react root: minified 329941 bytes, SHA-256 `5a60a1f6a40f5c34b9d0164fbf74d1e4c715513fdc27801b09df175e10d8492e`
- adapter-vue root: minified 328712 bytes, SHA-256 `ccab1b3ed268fb1d326eae8a9cc6e7297c542b17f9f98721ccdf9788578ce910`
- adapter-web-component root: minified 341857 bytes, SHA-256 `8efb69e998d42613f2e608e5043e509fa7a2b75fbad6f82245e4724f25f4d394`

### Shared-lease candidate

- runtime root: minified 263424 bytes, SHA-256 `ffaed50da1f7cc53a7f3e341eeb9d89e12a5f84b2615a871064f7fb9e9600ffe`
- adapter-react root: minified 328069 bytes, SHA-256 `2fa5b2eea2c22bc0b9defe4ef1666f0a43e287e8a55593d2be9fbbc245e01099`
- adapter-vue root: minified 326840 bytes, SHA-256 `95260a91aed6a8e103dab56b3cd8ba915f564ca7974828089b3c25254dac8db9`
- adapter-web-component root: minified 339985 bytes, SHA-256 `aecf7af2969bb241e86d028d4f9cfbc75ade266a74979a8e915f72437321edd5`

## Validation scope

- Final focused source run: 62 tests passed across 11 files, covering preference/style-support lifetime, legacy colorScheme, Web providers, the actual Liquid Button and new isolation cases. The unsafe shared-getter-snapshot variant failed the new Runtime counterexample (`unknown` instead of the replacement support value `true`); restoring per-capability reads passed it.
- The targeted public package TypeScript build/import smoke passed. One full workspace type check was killed by the OS (exit 137); that interrupted check is not a type pass. A separately coordinated retry or exact-head CI is required.
- Browser behavior is unchanged by design but must still be revalidated on the combined consumer head through its existing exact-head workflow. This record does not substitute for that paint evidence.
