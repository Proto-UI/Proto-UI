# WC Focus entry unchanged-attribute invalidation

## Why

The unchanged production Search recovery case still exceeds its original
1,000 ms runtime-switch poll on some source-bound runs. A bounded external CDP
diagnostic on `9c5cb80c4b015910fc18193b697003e2864b6b18` located expensive
visibility, focus dependency and theme reads. That diagnostic selected one
original case and filtered three: WC to Vue passed, while the later Vue to
React poll failed. It is not a complete production acceptance pass.

One independently reproducible cost occurs in the WC Focus entry observer.
Same-valued `setAttribute` writes generate MutationRecords, and the observer
previously scheduled a complete selector/dependency rebuild for those records.
The observed native profile supports investigating this path; it does not prove
that this one correction alone meets the production deadline.

## Correction and review

All attribute registrations of the current entryObserver retain oldValue.
The callback compares each attribute record with its current value in the same
namespace, and skips only records whose value did not change. Child structure,
text, actual attributes and the existing projected-tabindex ownership rule keep
their refresh paths. Each record is checked independently, so a later changed
record in an A to B to A batch still triggers refresh. Synchronous custom-element
callbacks and their effects on another element remain observable.

The original synchronous eligibility checks, CSSOM observation, current owner
and view-epoch guards remain in place. Independent root source review found no
remaining blocker within this bounded observer change. The final integration
also aligns the callback comment; that extra edit changes no executable code.

## Evidence

- Original product with the final 15-case file: **10 passed / 5 failed**. The
  five failures are real same-valued class/style or namespaced records causing
  one unwanted rebuild. The tests are unchanged between red and green.
- Candidate affected set: **7 files, 150 passed / 0 failed / 0 skipped**.
  Existing childList, CSSOM, shadow, portal, replacement, terminal and teardown
  controls remain, alongside the new real author-callback and A/B/A controls.
- Combined with `fad057af` and its visibility/theme cases: **10 files,
  178 passed / 0 failed / 0 skipped**, with unchanged source and test inputs.
- HappyDOM omits standard namespace metadata. That one test retains its real
  record and oldValue but explicitly supplies the missing namespace/localName;
  it is host-model evidence, not a native Chromium claim.
- The original production four, CodeExample 39 and Search 83 files and their
  deadlines are unchanged. Final combined native acceptance remains separate.

This change composes with the published visibility/theme notification repair
`fad057af5a810de4128b14c89fcb02ed84284c49`; it does not replace that work or
claim all observed layout costs are resolved. Prepared with ChatGPT coding
agents under the current user's continuation request. No release or lifecycle
status is promoted, and this source review is not formal GitHub approval.
