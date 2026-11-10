# Bootstrap contrast follow-up after Draft #1381 review

Date: 2026-11-09. Agent: dot for cyjin-yl, current-user development repair.
Review baseline: `bcf3dd6dfd6405233cc6136310ee772563f90713`.

## Findings and repair

The review correctly identified Slider.Value's fixed `#555` on the new dark
`#161616` page, a calculated 2.427:1 contrast ratio. A broader follow-up found
the same mismatch on OTP Separator and enabled Autocomplete, Combobox and
Command editors. Earlier review treated too many fixed control colors as
paired with light backgrounds. That conclusion was incomplete.

- Slider.Value and OTP Separator use semantic muted foreground. Their actual
  WC projections are checked, together with the light/dark palette pairs.
- The three search editors pair `bg-background` with semantic foreground when
  enabled, including focus and readonly. Disabled editors pair the historical
  `#eee` surface with `#555`; returning to enabled restores the semantic pair
  without replacing the physical editor.
- Five Field compositions had the opposite mismatch: `text-destructive`
  resolved to the dark palette's light red on fixed light controls. FieldControl,
  FieldTextarea, NumberFieldControl, InputOtpControl and FieldSelectTrigger now
  use the historical focused-error ink `#953b39`. Its calculated contrast is
  7.09:1 on white, 6.11:1 on `#eee` and 5.68:1 on `#e6e6e6`. Page-level error
  copy retains the semantic destructive palette. This is a bounded adaptation,
  not a claim that every historical Bootstrap color passes WCAG AA.
- The Popover and Dialog Title draft criteria now describe the implemented
  semantic title pair and separate Header box ownership. No lifecycle promotion
  or Base protocol change is claimed.

## Discriminating local evidence

Using Node 24.22.1, pinned pnpm 10.32.1 and the existing frozen dependencies:

- The final search/palette oracle against the published old implementations
  failed 4 tests and passed 24. The candidate passed all 28. Subsequent focused
  and readonly observations also passed. These are source/state tests, not
  browser-computed colors.
- The five public invalid-control compositions each failed on the old paint;
  the independent color calculation passed. After repair, all 6 tests passed,
  covering invalid-to-valid, readonly/disabled plus invalid, ARIA state and
  CSS-lowered state variants, and editor identity. A premature assertion that
  expected a plain disabled token instead of its `data-[disabled]` variant
  failed during test development. It was corrected to check the emitted
  variant and its actual activating state, not weakened to ignore disabled ink.
- Canonical style generation initially rejected the new error-ink token. A
  single finite physical translation for `text-[#953b39]` was added to the
  existing CLI style table, without a grammar or Compiler/IR change. Its
  document, shadow and shadow-split regressions first failed 3/3; the repaired
  translation suite passed all 78 tests. An unlisted adjacent color remains
  rejected. Canonical regeneration and style check then passed (13 checker
  tests), as did the prototype catalog (7 checker tests) and lifecycle authoring
  against the main base (18 changed catalog inputs).
- Independent follow-up review found that a recognized bare token was not
  enough: the generated preset initially omitted its actual conditional
  `data-[invalid]` selector. A joined runtime-token-to-delivered-CSS regression
  failed for all five public controls. The paint Rule now sits beside each
  existing public Field binding and shares one pure paint constant, instead of
  hiding the state dependency behind an ordinary helper parameter. The joined
  six-test suite passed after canonical regeneration. The supported grouped
  `field`, `number-field` and `input-otp` CLI entry paths are also checked
  independently of the full-family preset. No collector grammar, Base protocol
  or semantic owner was changed. Arbitrary single-file extraction of optional
  Field bindings remains outside this evidence; it is not inferred from the
  family aggregate.
- The final affected Bootstrap/website/CLI run passed **26 files, 283 tests**
  with one worker. A separate read-only re-collection of the actual main website
  source graph returned 1354 tokens, including both new conditional error-ink
  selectors in document and shadow delivery. The invalid selector has an
  additional state-attribute specificity over the zero-specificity base text
  rule; this is a static cascade check, not a native painted-color measurement.
- An initial combined type check caught an overly narrow inferred union in
  the new test's heterogeneous Prototype list. The fixture list now declares
  its actual AdapterPrototype element type; no runtime assertion was removed.
  The final combined `check:types` passed with a 6 GiB heap, including actual
  website stylesheet generation, workspace TypeScript and Astro (1184 files,
  0 errors, 0 warnings, 25 hints). Formatting and `git diff --check` passed.
  The exact-commit PR comment binds these local results to the published tree;
  none of them is a native screenshot or a full CI pass.

The final changed source and generated style closure are bound to the subsequent
PR commit. All execution used this user's own project source and trusted
registry tooling; no new upstream Bootstrap or other third-party implementation
version was executed.

## Remaining acceptance

No new native screenshot or browser reproduction exists. The established
Chromium socket EPERM startup blocker was not retried without a changed
prerequisite, and no sandbox or protection setting was weakened. Supported
browser follow-up must inspect the current commit's light/dark Slider value,
OTP separator, all three search editor states, and all five invalid Field
compositions, including readonly/disabled and validity restoration.

This follow-up does not erase the original homepage-suite failures or earn the
whole-family, native, AT, RTL, enlarged-text or independent acceptance gates.
The PR remains Draft pending those separately bound results.
