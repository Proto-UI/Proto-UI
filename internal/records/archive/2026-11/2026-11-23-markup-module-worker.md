# Bounded markup reference after the module Worker repair

The production build repair in `a7fc2e96` changes one of the 31 directly reviewed markup reference members: the Astro configuration explicitly emits the existing module Worker as ESM. The fixed current reference is renewed to the exact committed product revision recorded in `evidence/2026-11-23-markup-module-worker/source-ledger.json`. Every hash is compared with both its actual Git blob and current file; only the reviewed Astro configuration differs.

The preceding reference is preserved byte-for-byte as `website-markup-provenance-9a49049.json`, alongside the older `4adb607` reference. The source inventory, matching algorithm, browser study, rejection cases and all source/HTML/Copy/teardown assertions are unchanged. `sourceAdmission` remains `unverified`: the successful production build is not independent acceptance of the study or its transitive execution closure.

The original 36 discriminator tests pass, with their output retained beside the source ledger. The next native study must bind its own actual head and retained responses.
