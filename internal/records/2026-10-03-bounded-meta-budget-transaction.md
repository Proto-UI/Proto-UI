# Bounded live Meta capability: numeric budget transaction

This independently reviewable commit adjusts only three whole-entry gzip ceilings for the accepted live preference/support source and lease slice in #801 / #793. The blocking gate, nine entries, minifier, gzip level 9, ESM/browser/ES2020 target, external boundary, diagnostics and all other thresholds remain unchanged. It follows the completed maintainer policy in #654; it is not an automatic allowance for later material, native or Compiler growth.

## Canonical before and after

Both repository jobs use Linux x64, Node 24.21.0, zlib `1.3.2.1-motley-8002e91` and esbuild 0.25.12.

- Main `a1af2e64`: [run 37124560723, job 111207163354](https://github.com/Proto-UI/Proto-UI/actions/runs/37124560723/job/111207163354)
- Capability `139df710`: [run 37128850300, job 111219946780](https://github.com/Proto-UI/Proto-UI/actions/runs/37128850300/job/111219946780)

| Entry   | Main bytes | Capability bytes | Increment | Old ceiling | New ceiling | Remaining room |
| ------- | ---------: | ---------------: | --------: | ----------: | ----------: | -------------: |
| Runtime |     66,024 |           66,620 |       596 |      66,500 |      66,800 |            180 |
| React   |     85,641 |           87,180 |     1,539 |      86,500 |      87,500 |            320 |
| Vue     |     85,384 |           86,900 |     1,516 |      86,500 |      87,200 |            300 |

These deliberately small margins are explicit choices, not rounded-away failures. Future excess still fails. The previous jobs stay red at their original ceilings. This commit must receive its own canonical package build/budget result.

Main minified hashes: Runtime `7c67f7c50e9c12829efdc7534845d88a9404a1a6741e7b1f619ddaf3115310dc`, React `aa71024db33e14b04bd6de52500d95da8a8d631a45e63dcdac66d8364a098318`, Vue `1716f6115332bb238fc959ae2ea1646998bfbdd223d32a60472cbed20734d146`. Capability hashes and the exact source optimization are retained in [the cost review](2026-10-03-bounded-meta-bundle-cost.md).

## Why this cost is accepted

The Runtime increase is fixed-key validation and independent source/lease ownership, including source loss, late callbacks, reentrant replacement and disposal. The Adapter increment also includes the bounded live Web preference observer, explicit finite style-support checks and their paired wiring. Family prototypes and experiment artifacts are not imported by these root entries. The private shared-lease helper already saves Runtime/React 104 bytes, Vue 95 and WC 119. A smaller-looking shared getter snapshot failed the replacement counterexample and was rejected; semantics are not removed to meet a number.

Maintainer-directed review accepted exactly 66,800 / 87,500 / 87,200 after the independent helper review and canonical measurements. This records that bounded choice without changing measurement methodology or treating a functional pass as permission to ignore the gate. Existing records preserve the initial red measurements and failed alternatives.

The capability head has 2,879 general tests and 192 browser tests passing, plus the 17-case fallback/library and 36-case preference evidence jobs. Those results do not replace the numeric gate or final-head review. Nor do these allowances complete Liquid Glass optics, the 106 family targets or native/Compiler parity.
