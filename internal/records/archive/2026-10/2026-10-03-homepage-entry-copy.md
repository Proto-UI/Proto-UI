# Homepage entry copy alignment

The product-direction context in [PR #777](https://github.com/Proto-UI/Proto-UI/pull/777#issuecomment-5962939409) clarifies the intended audience and meaning of the existing example; it does not restart design or add acceptance scope.

This bounded follow-up keeps the four accepted Chinese/English hero lines unchanged. The example heading connects framework switching to reusing interaction definitions. Its `.demo.ts` source is labeled **Website demo configuration**, because the file composes website examples from Prototype references; it is neither a Prototype definition nor a public application-integration API. Runtime/library changes continue to update that same configuration link.

The existing **Get started** / **开始使用** actions now lead to their localized, hands-on Quick Start pages. The header's documentation entry still leads to the introduction, so the two action labels retain distinct promises. There are no new product entries, sections, complex examples, Compiler promises, or protocol requirements in this change.

Source-bound presentation tests preserve the slogans, check the source-kind label and reusable-interaction explanation, and verify that both action destinations resolve to existing CLI-based Quick Start content. These tests establish copy and route boundaries, not rendered visual quality. New exact-head screenshots and complete CI remain required evidence for the continuing homepage work; historical screenshots remain bound to their original commits.

## First restored-head browser findings

[Run 37095494332](https://github.com/Proto-UI/Proto-UI/actions/runs/37095494332) executed the restored and main-integrated `b00276a6cbc21807c092c274d2761c96b54de122` tree. All 12 documentation capture journeys passed. The eight homepage cases retained their initial screenshots but stopped before runtime transitions because the ownership probe queried a nonexistent `data-projection-controls` attribute. The composition marks individual controls with `data-projection-control`. Previously, the preferences group also contained a theme Button whose content root masked this selector mistake; the revised header deliberately separates those controls. This is a probe defect, not permission to admit an empty or placeholder-only group. Its regression executes the actual ownership function, including same-generation and nonempty real-content assertions.

The six focused browser suites passed 23 of 26 tests. Two stale expectations referred to the former generic menu label and a fixed 36px trigger height; the current application owns a distinct page-contents label and a 40px mobile density token. The remaining failure is a real narrow-header defect: an overflowing Runtime Select chevron intercepts the neighboring page-contents button. The corrective evidence must retain native click dispatch, measure chevron containment and separate hit targets, and exercise both menu/contents orders. Force clicks or removed ownership assertions would not establish a fix.

The follow-up probe opens the actual navigation/settings menu, verifies visible native content and the same committed generation, captures that state, and closes it with Escape and focus return. The original failed run and revision-bound screenshots remain historical evidence; none is relabeled as a subsequent candidate.
