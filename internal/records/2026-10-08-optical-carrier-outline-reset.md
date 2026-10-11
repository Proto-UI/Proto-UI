# Optical carrier outline reset

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Real failure and diagnosis

PR #872's exact published head `06d6ff33ba29fe57dcc3b62f236d021c961a868b` retained the test-only pre-cleanup observer introduced after the earlier `0a3fac594103bf1c6fd60fa511ace2e733adb97c` failure. Official [run 37756502910](https://github.com/Proto-UI/Proto-UI/actions/runs/37756502910), job `113242254473`, failed all four ordinary/continuous source/emitted suites at initial optical admission. [Artifact 11540446817](https://github.com/Proto-UI/Proto-UI/actions/runs/37756502910/artifacts/11540446817) was downloaded and its ZIP SHA-256 verified as `979b13eb6947f1fcfc3ed25392d16136792e3e5218aa4fa814fa0828cec2ebaa`.

All four actual failure images were inspected: the scene mounted, and each runtime's Optical action stayed opaque. The failure JSON preserved 24 pre-cleanup computed-style observations: eight ordinary-source, eight ordinary-emitted, four continuous-source and four continuous-emitted. Each set includes Web Component, React, Vue and Vue 2. Although the observer has a global first-32 bound and cannot generally promise complete runtime coverage, this artifact does contain all four runtimes in every suite.

Every observation has `outline-style: none` and `outline-width: 3px`. All other fields in the zero-width guard are `0px`. The owned rule declares `all: initial` without overriding outline width, while `carrier.valid(image)` requires that width to be zero. Evaluating the existing source predicates against the retained values identifies only this zero-width clause as false in all 24 samples. This offline comparison classifies actual recorded values; it is not new browser execution. The rendered scene and GPU/image counters also rule out an absent server or an unstarted renderer as the initial failure described here.

## Minimal production repair

Add `outline: 0` to the exclusively owned carrier pseudo-element stylesheet. Keep the full admission predicate, ownership/source guards, author-conflict handling, shader, host geometry and input semantics unchanged. The correction establishes the already required zero-width owned paint box instead of weakening admission to accept a nonzero width. It does not alter the host's own focus outline.

The CSSOM regression inspects the actual installed stylesheet's explicit `outline-width` declaration. On the unchanged production source it fails because the declaration is absent, with the other three carrier tests passing. With the reset it passes. The composition test now explicitly supplies `outlineWidth: 0px` in its valid controlled style and independently rejects the actual failed value `3px`, even when `outlineStyle` remains `none`. These are stylesheet/controlled-composition tests, not claims of browser cascade or pixels.

## Validation and remaining evidence

The focused carrier/sink suites pass 27 tests and the existing official optical consumer configuration passes 15 tests, including the four diagnostic observer controls. The complete focused material/input suite passes 132 tests across 15 files, and ten selected optical consumer-wall controls pass. The failed official outputs and the before-fix CSSOM failure remain valid negative evidence; they are not relabeled as successful.

The next integrated, exact-head official source/emitted ordinary and continuous runs must establish real optical admission and the subsequent input, invalidation, GPU and visual outcomes. A successful initial admission alone will not settle later continuous-flow failures. Instrumented timing does not establish performance acceptance. Local Chromium's Unix-socket restriction remains respected, and no alternate local browser route was attempted. Full workspace builds, types and package budgets remain the parent integration's serialized responsibility. No source binding, lifecycle or Finf completion claim changes here; complete acceptance remains 0/68.
