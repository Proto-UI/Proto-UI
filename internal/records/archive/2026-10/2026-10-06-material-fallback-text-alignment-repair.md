# Preserve material fallback foreground during text alignment merge

Agent: dot. ModelTrace: not measured (owner-authorized exemption).

The real Liquid Collapsible shared-material consumer exposed a pre-existing
Core semantic-group defect: text-left was grouped as text-color and removed
text-foreground. Material's evaluator-retention made that actual final fallback
loss visible; deleting the consumer assertion or substituting a hard-coded color
would hide the defect.

The six finite alignment tokens now form their own semantic group. Theme
foreground, text size and alignment remain independent in either order, while
conflicting alignments still resolve within their own group. Static selection
scope and runtime patch/suppress/clearPatch preserve the same distinction.
The readable merge contract is corrected to match these independent intents.

Focused evidence: 21 Core feedback tests pass, including eight new controls.
The real family consumer must rerun against this exact delta; host paint and
material backend capability are not established by a preserved token.
