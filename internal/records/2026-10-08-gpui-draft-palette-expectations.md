# GPUI draft palette fixture expectation correction

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

The official general CI run on `c49ae23037d1a38c3594ad43906d669d38eee9ec` failed the exact draft-theme key assertion in `scripts/gpui/test/style-fixture.test.mjs`. The committed generated theme fixture and source palettes already contain the later legitimate typography/muted additions, plus Bootstrap's destructive color. The test still expected the older common fourteen-key set. Product themes and generated fixture bytes are not changed by this correction.

The exact source/derived inventories differ: Bootstrap has fifteen source variables plus four derived radius variables (19 total); Liquid Glass explicitly declares all eighteen variables in its source, including its four radius variants, with no destructive variable in its current palette. Their common additions are font-heading, font-mono, font-sans and muted-foreground. Bootstrap additionally owns destructive. This correction preserves that precise difference instead of accepting arbitrary keys or silently inserting a new Liquid token.

The focused native Node run passes both the complete-key check and a negative-control test. For each light/dark family palette, every one-key omission and two unowned/double-prefix additions are rejected: 82 mutations in total. Existing exact spot colors, Bootstrap light/dark equality and single-prefix checks remain. The test-only local commit does not claim GPUI material or broader native support, full general-CI success, or validation of the separate Bootstrap visual candidate.
