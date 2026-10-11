# Representative evidence: inventory and CJK environment repair

Actual source `14ce5ddee6311b3b8e807f8b5ac24e1ba4173c92` ran the three real journeys in official run 38036693145: Form and Calendar passed, while Drawer captured its 50% snap and then failed the preserved Close interaction because that control lay outside the viewport. That is an open component defect, not a screenshot pass; the component owner is repairing its physical layout separately. Form pixels also exposed missing CJK glyphs.

The new suite was absent from the central browser inventory, causing the separate runtime inventory gate at run 38036692883/job 114168481360 to fail before its browser phase. Register it exactly once in the existing dedicated-evidence bucket and bind its real workflow owner. This retains executable ownership and ordinary inventory fail-closed checks, without deleting the test or running it twice.

The official representative workflow now installs the same public `fonts-noto-cjk` package already used by other repository evidence workflows and retains package versions plus the resolved Chinese font. No local browser execution or sandbox change is introduced. The existing Close interaction and preset gate remain intact.

Validation: six targeted inventory/owner/production-plan checks passed without starting a browser or server. New-head native images and the Drawer layout repair remain pending. Historical images remain bound to actual 14ce and are not relabeled.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
