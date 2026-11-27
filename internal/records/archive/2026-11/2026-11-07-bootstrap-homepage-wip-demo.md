# Bootstrap homepage WIP demo decision

The current user requested a real Bootstrap homepage demo while keeping non-0.3 libraries WIP/Experimental. The implementation uses actual `bootstrap-2-3-2` prototypes and family-owned manifests/loaders; no Base or Shadcn fallback supplies its components.

This is an evaluation surface, not stable support or proof of complete Base parity. The selector label contains WIP, the family remains in the 0.4 WIP/Experimental section, and the previous complete-parity homepage eligibility criteria remain acceptance debt rather than a claimed pass.

Verification on the exact candidate: homepage family selection commits Bootstrap with ten real cards and the shared gradient; docs type-check and prototype-catalog checks pass. The real browser observes family `bootstrap-2-3-2`, runtime state `ready`, ten cards and 477 family-owned projection roots. Focused homepage tests pass 145/146; the remaining Shadcn synthetic hit-participation case is retained as an existing failure and is not counted as a pass.
