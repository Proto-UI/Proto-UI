# Reuse bounded successful Shadow selector validation

This is a source-bound performance repair within the existing Shadow artifact v1 ABI. It does not change the admitted CSS language, object schema, owner lifetime, original Matrix test deadline or Sprint acceptance criteria. Codex authored it while continuing the user's unfinished Sprint work.

## Original native observation

The original Matrix initialization case failed again at its unchanged 60,000ms gate in [official run 45173568117](https://github.com/Proto-UI/Proto-UI/actions/runs/45173568117), on exact published source `502693304fc8d7509402fdfb586b283681915231`. The diagnostic captured 5,322 CPU samples over 45,851.014ms. Grouping each sampled stack by its nearest source owner attributes 2,754.719ms to `shadow-style-artifact.ts`; this is sampled diagnostic attribution, not an independently measured wall-clock stage or a performance acceptance result. Anatomy and other work also remain substantial.

The complete 313,231-byte official artifact is retained beside this record. Its SHA-256 is `29c283e7f056786f27f2656f3f01af259ca70c15cb0149fc835d912f11eb2bbf`. It preserves the original failure, source and environment receipts, CPU profile and bounded observation failures. No missing snapshot is replaced by an invented zero count.

## Change and invariants

The selector ABI validator operates only on a primitive immutable CSS string and fixed v1 rules. The Adapter now reuses a successful result for the exact complete string. The cache retains at most 128 entries and 1,048,576 UTF-16 code units in total. It evicts the least recently used successful entries. Oversized input still receives full validation and is not cached. Invalid input never enters the cache, and no hash or shortened key substitutes for string equality.

Every invocation still reads the current own keys and accessor-backed `kind`, `version`, `cssText` and `environment`, checks the original exact schema, and returns a new frozen Adapter-owned copy. No artifact object, owner, stylesheet, target or DOM state is cached. Reentering validation from a getter cannot publish a partially validated cache entry. Separate owners retain their own stylesheet and disposal state.

## Verification

Four complete original test files passed together: artifact validation, stylesheet ownership, split resources and split resource generations. The final run contains 89 passes, zero failures and zero skipped cases. Its source files have identical SHA-256 values before and after execution. Four additional controls cover repeated accessor reads and fresh immutable copies, changed CSS/schema and thrown accessor identity after a warm validation, reentrant getter validation, and independent owner rejection/disposal. Existing escaped selector, host theme, negative ABI and lifecycle controls remain intact.

A separate agent independently read the complete implementation and first three added controls and found no semantic or reentrancy blocker. Its requested reentrant getter control was subsequently added and passed in the full run. This engineering review is not a platform approval or native acceptance.

The baseline source file is byte-identical at both historical `50269330` and the implementation base `ead42f5e`; its SHA-256 is `5c09f68e69e94baceb4c2f1c88ab5c7e9f8b8b76f57a8686e43b17127c6c4b68`. A bounded diagnostic imported that original file and the actual candidate, then validated the same real generated stylesheet of 598,859 UTF-16 code units 30 times per run. The original took 828.82ms before the candidate run and 937.05ms afterward. The candidate took 30.92ms including its first full validation, then 0.20ms for a subsequent warm run. Each call still asserted a distinct frozen result with identical CSS. These Node measurements demonstrate reduced repeated parser work only; they do not predict or satisfy the full native Matrix deadline.

The [manifest](evidence/2026-11-23-shadow-selector-cache/manifest.json) binds the complete official artifact, exact candidate/test hashes, complete test report and logs, benchmark source and results, and derived profile summaries. The generated stylesheet and both benchmark source versions are identified by their recorded hashes. The first local test launcher returned before its child ran; it produced no test evidence and is not counted. An initial command also named a nonexistent third test path; only the two actual matched files were counted before the correct four-file final run above.

## Remaining gate

The original full Matrix native case, all four cases in its file, and trusted integration CI must still run on the integrated candidate. Search, Shadow native journeys, source-rights and physical-device criteria retain their separate original obligations. The original 60-second failure remains a failure until the unchanged native gate passes on the new source.
