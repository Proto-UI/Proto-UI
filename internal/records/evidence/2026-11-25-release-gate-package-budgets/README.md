# Accepted 0.3 package cost transaction

This candidate changes only the React, Vue and Web Component whole-entry ceilings to 181900, 180800 and 218400 bytes. Their measured costs are 181862, 180720 and 218353. Each ceiling uses the preceding positioning transaction's next 100-byte boundary, leaving 38/80/47 bytes. The other 6 limits and every measurement/strict failure control remain unchanged.

Three original canonical reports are retained byte-for-byte under gzip. The prior 47ae cost is the exact input to the already recorded positioning transaction. Its original report failed the earlier ceilings; it is not relabelled green. The 4d report failed WC by 209 bytes. The 798 report failed React/Vue/WC by 62/120/253 bytes after a successful frozen install, complete build and 28 controls.

The source comparisons retain every closure input and its old/new hash and retained bytes. All 3 Adapter roots and Runtime have identical input membership in both comparisons. Gzip changes are actual whole-entry measurements, not sums of module deltas. Current 8b inputs match the 798 report for all 9 entries. This source equality is not a final-head CI pass.

The authored transaction records accepted behavior, investigated/rejected implementation refactors, environment, hashes, margin and rollback. Independent review and the final committed head's canonical strict measurement remain pending.
