# Homepage Label migration evidence oracles

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Exact source and failure

This bounded human-assisted follow-up starts from `f1c66b89068e91ce0bcbbe8270d951e813cc8575`, following reviewed combination `e85f251f08687f8c1816b6e33735d3ee9faf41bd`. Official Homepage run `37726400843`, job `113145444801`, belongs to `b0392134d488103faad977ff586bb86caf996556`, not this unsubmitted candidate.

The b039 capture artifact `11528137207` (SHA-256 `720011d1ea337c2de2ed1eef39e808ba0eff49cf46e3246ab6f697b93349f32f`) reports eight font scenarios with 19/20 samples. In every case only `task-result-title` is absent. Its selector `.home-gallery__choice-label` no longer exists. The actual Homepage gallery intentionally renders four choice captions through `${family}-label-root` with naming and activation associations, replacing four former Text instances. The focused browser inventory likewise expects those four captions to remain Text: its actual/expected diff has four extra Label and four missing Text entries.

The existing gallery implementation is the source being verified; no content or design changes are made here. Draft `C-CONTROL-LABEL-0001-NAMING` and `-CONTENT` distinguish real Label subjects from independent copyable descriptions. These checks must inspect actual rendered subjects rather than reintroduce obsolete wrappers or substitute unrelated Text. The browser assertion still validates the exact multiset, owners, generation and portal coordinates.

## Repair and discriminating checks

- Candidate font sampling now targets the actual choice Label marker. The list still contains exactly 20 samples; immutable baseline selectors and font/layout thresholds are unchanged.
- The exact inventory remains 97 instances, now correctly 37 distinct kinds, with 24 Text and four Label instances.
- Source-built plain-DOM fixtures execute the real browser assertion bodies and real capture-selector declarations. They cover both homepage families, all four renderer marker variants, and existing missing-part/owner/generation/portal negatives. They are not native rendering or Adapter parity evidence.
- Prior source: 58 checks, 49 pass / 9 fail. Adding migrated-Label font selector controls before repair gives 60 checks, 49 pass / 11 fail.
- Repaired controls also reject replacing a Label with the old Text marker, and reject unrelated Text as a substitute after the Labels are removed. All 62 checks pass.

## Remaining native work

No new browser screenshots or visible-font pass are claimed. Exact integrated official CI must establish 20/20 actual visible samples and the full projection journeys. The four styled-family Label drag-selection failures remain separate: the target is a passive description box, not an actionable Label. The existing mouse drag follows the description box centerline; wrapping/hit geometry remains a hypothesis, not an established cause. The official artifact did not retain that suite's default temporary-directory screenshots. No text-selection threshold, native input, product style or Label bridge is changed in this increment.
