# Hover diagnostic import fingerprint renewal

The full coverage command at source checkpoint `a423a2ba78023a22f89e4a70f42839a0dc7838a3` exited 1 after 159.611 seconds with eight consumer-wall findings for `apps/www/src/pages/en/test/liquid-glass-hover.astro`. The Node test stage did not start. The Website Source-scan fingerprint had been renewed, but the separate exact-body guard in `scripts/coverage-matrices/diagnostic-imports.mjs` still retained the previous page hash. This omission was detected by the real gate and its failed receipt remains historical evidence.

The bounded review compares the complete page at `4c2c34019a97b50ea7d486b31c3ee140bc46130e` and a423. Parsing its frontmatter and two scripts confirms that all 15 static module specifiers, type-only flags, order and literal bytes are unchanged. The eight admitted raw Proto imports retain their complete import-declaration bytes and order: the Liquid Glass theme source plus Button, Toggle, Form, Accordion, Collapsible, Select and Dropdown. The only page-body delta is the previously reviewed local overlap-paint helper import and its application destination call/comment, described in [the candidate correction record](2026-11-22-native-candidate-correction.md).

This change renews exactly one existing `sourceSha256` in the diagnostic policy:

| Source | Previous SHA-256 | Reviewed SHA-256 |
| --- | --- | --- |
| `apps/www/src/pages/en/test/liquid-glass-hover.astro` | `f39b2dbc22e2a2ad265b2e7b7e3670aeadbc61a7d8d1af404570aa3a931622c7` | `e5ac9d5ed097908f60abec84790684d1e84570b9747fa3a03ba95faf9b763d83` |

The existing eight specifiers, allowlist entries, validation implementation and blocked consumer ownership remain unchanged. The helper remains bound to `b3610d4249358f84f24a535efcf4a2a82122df4fe2e637f1cc6f635fa7f19fd3`. This source/import review supplies no new browser or optical acceptance, and Liquid Glass remains WIP / Experimental.

The a423 generator's three outputs were archived with byte hashes before restoring only those outputs to committed a423. Its full-gate log SHA-256 is `435fffb122acff6d812afb25b3a31e54c60891f7bd9c36c3f89e2368379179ca`; source snapshots were stable across that failed command. The archived local receipts retain the exact command, timestamps, generated files and eight findings. A new source checkpoint and actual generator/full gate are required after this finite renewal. The a423 failure is not rewritten as a pass.
