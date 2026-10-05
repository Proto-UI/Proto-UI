# Fixed-recipe inspection evidence for #806

Published source: [8b8b158d7c5c2fb5dff08720c4223243c8172559](https://github.com/Proto-UI/Proto-UI/commit/8b8b158d7c5c2fb5dff08720c4223243c8172559). Reviewed tree: `c0fac8f7f79fd38e060534a4cfa08de2a6c7ba55`. Independent review completed on 2026-10-05; the published source has exactly the reviewed tree.

The independent technical review found no new actionable P1/P2 in this bounded static inspector. It verified the seven reported cases: separate shape count and stride, pass/kernel selection, geometry channel encoding, compatible draw domains, fixed extents, required capabilities, and the automatic input inventory. The two recipe policies are separate from audited source declarations; neither policy is presented as the only possible upstream implementation.

## Recorded verification

- Project suite: 81 tests passed, including 994 execution-field and object-extension mutations.
- Independent deletion/type-replacement controls: 4,267 rejected, zero invalid accepts and zero exceptions. Eleven unchanged-value cases and two allowed source-subset deletions were classified separately.
- Independent valid combinations: 22 passed, covering allowed pass ceilings, owned-image/video subsets and equivalent collection order.
- Nine correlated rewrite/order attacks were rejected, including sampler reversal with coordinated slot/reservation changes and reflected uniform reversal with recalculated slots.
- Eleven static source blobs and byte counts matched their fixed identities. Six shader files independently yielded 97 uniform declarations and seven texture samplers matching the registry. The background padding/main ref-distance alias was checked explicitly.

`probe-results.json` and `source-results.json` are the complete result objects. The portable scripts here change only filesystem input/output paths from the reviewed probes. The publisher reran both against the published source tree and the same fixed source bytes; both result objects matched the independent originals exactly. This publisher rerun is not a second independent review.

## Reproduction

Use Node.js 24 and a clean checkout of the published source commit. Download the fixed public source files listed in `sources.json` without executing them. Place each file at `SOURCE_DIR/<repo>/<path>` using its pinned commit. Then run:

```
node probe.mjs REPOSITORY_DIR SOURCE_DIR OUTPUT_DIR
node source.mjs REPOSITORY_DIR SOURCE_DIR OUTPUT_DIR
```

The first probe verifies each downloaded file's Git blob and byte count. The scripts only inspect those upstream text files; their executable imports are the first-party inspector from the selected Proto-UI checkout. Full repository CI is separately tracked at [run37278079753](https://github.com/Proto-UI/Proto-UI/actions/runs/37278079753); these local probes do not substitute for its outcome.

## Limits

This is technical source-review evidence, not a GitHub APPROVE or integration authorization. No upstream Studio/Flutter program was run, and no shader was compiled, reflected or rendered. Include closure, real resource behavior, backend support and native/browser admission remain outside the result. Every inspected graph remains `not-admitted`; the inspector is not a security boundary for hostile JavaScript objects or resource exhaustion.

The fixed sources and their existing notices remain authoritative. This evidence does not redistribute vendor source or change its license. Flutter's separate host-injection cross-check is documented in the official [ImageFilter.shader API](https://api.flutter.dev/flutter/dart-ui/ImageFilter/ImageFilter.shader.html).
