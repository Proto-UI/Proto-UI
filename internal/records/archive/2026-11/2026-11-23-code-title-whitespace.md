# Exact code-file titles after Astro formatting

The original [browser shard 9](https://github.com/Proto-UI/Proto-UI/actions/runs/45146424504/job/137596891592) at `d0392fb31513b12f55b9e99b1fcf26a6338569c9` failed 15 code-surface grammar cases. Actual filenames had surrounding whitespace (`index.html` and `proto-ui/config.json`). A separate scroll-chain failure in that shard remains distinct and is not fixed by this change.

`CodePanel.astro` placed its dynamic title on an indented child line. The actual locked Astro compiler emits those newlines around the escaped value, and the browser exposes the resulting spaces. Replacing that child with `set:text={title}` keeps the title as escaped text and emits exactly its authored value. It preserves the icon, title branch, scrollability, tabstop and Copy controls. No filename is trimmed, fabricated or accepted through a weaker comparison.

The actual Astro compiler transforms both original and repaired files with zero diagnostics; retained output shows only the repaired title has no template whitespace. Existing CodePanel, highlighter, CodeExample, Tree and generated-file browser tests pass **65/65**, zero skips. An independent agent reviewed the exact source change without a blocking finding. [Raw logs, transform observations and hashes](https://github.com/Proto-UI/Proto-UI/blob/cae25ae39f926e9556ec40fe2c7ed46a2025091f/internal/records/evidence/2026-11-23-code-title-whitespace/validation.json) retain the original failure and focused result.

The original native browser assertions remain unchanged. Their complete rerun is still required on the final integrated candidate. Local compiler output and Happy DOM cases do not replace native copy, pointer, forced-color or visual acceptance; the local review is not GitHub APPROVE.
