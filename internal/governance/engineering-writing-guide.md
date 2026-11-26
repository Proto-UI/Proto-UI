# Internal engineering writing guide

Write internal Proto UI documents for a tired engineer who has 60 seconds to decide what to do next. This guide is the internal counterpart to the [prototype documentation style guide](prototype-docs-style-guide.md).

## Scope & Limits

- Applies to all authored Markdown under `internal/**` (governance, agent operations, contracts, compiler notes, and dated records).
- Governs structure, placement, and prose clarity; `spec/**` remains the sole normative authority for protocol semantics.
- Automated enforcement runs via `corepack pnpm@10.32.1 check:internal-docs` (blocking structural/hygiene rules with a legacy debt ratchet in `internal/baselines/internal-docs-debt.json`, plus advisory Vale English prose rules in `.vale/styles/ProtoUI/`).

## Six rules for human-readable engineering docs

| Rule | Do | Avoid |
| --- | --- | --- |
| **1. Conclusion first (BLUF)** | Put the decision, root cause, or next action in the first 3 lines. | Burying the takeaway below 8 paragraphs of background and caveats. |
| **2. Single-slot epistemic boundary** | State authority, non-goals, and evidence limits **once** in frontmatter or a single `## Scope & Limits` section. | Repeating "does not claim / prove / establish / certify" in every body paragraph. |
| **3. Narrative–receipt split** | Keep human reasoning in `.md` (target ≤ 200 lines) and structured inventories, SHAs, or matrices in `.json`/`.yaml`. | Stuffing 60 file paths, commit SHAs, or raw JSON/test logs into Markdown paragraphs or list bullets. |
| **4. Living docs vs. immutable snapshots** | Edit living docs in place so current guidance stays clean; store dated observations under `internal/records/`. | Appending undated addenda onto a README until it becomes a 50 KB changelog. |
| **5. Visual rhythm & concrete anchors** | Keep paragraphs to 1–3 sentences (≤ 450 chars EN / ≤ 240 chars ZH). Break long sections with claim headings, tables, or code blocks. | 5+ consecutive prose paragraphs or 1,000+ char walls of text. |
| **6. Zero binary evidence in `main`** | Put screenshots, logs, traces, and `.tar.gz` bundles in PR attachments, CI Actions artifacts, or an unmerged archive branch. | Committing `.png`, `.mp4`, `.log`, `.gz`, or multi-megabyte raw dumps into `internal/records/`. |

## The 60-second teammate test

Before opening a PR that adds or edits an internal document, read it once as a teammate who did not write it:

1. Can you summarize the document's decision or purpose in one sentence after reading the first 10 lines?
2. Is every table cell and list bullet scannable without horizontal scrolling?
3. Did you state responsibilities positively ("X owns Y") instead of chaining 3+ negative clauses ("X does not do A, does not prove B, and cannot substitute for C")?
4. If the document explains a rule, contract, or CLI, does it show at least one concrete example, command, or compact table?
5. If a machine reads the data, is the canonical source JSON/YAML rather than a hand-maintained Markdown table?

## Writing English prose cleanly

When authoring English technical docs, prefer direct active verbs over bureaucratic phrasing:

- Write `reconcile`, `validate`, `emit`, `verify` instead of `perform reconciliation`, `conduct validation`, `carry out verification`.
- Cut empty AI openers (`It is worth noting that`, `Furthermore`, `Importantly`, `In summary`, `It should be noted that`).
- Name the concrete actor ("The compiler rejects X") instead of passive nominalizations ("X is rejected via the enforcement mechanism").

CI runs advisory Vale checks (`.vale.ini`, `.vale/styles/ProtoUI/*.yml`) and local offline checks via:

```sh
corepack pnpm@10.32.1 check:internal-docs
node scripts/docs/check-internal-docs.mjs --warnings --files <path>
```

## Choosing where a new document belongs

| Content kind | Location | Expected lifecycle |
| --- | --- | --- |
| Stable workflow, policy, or checklist | `internal/governance/`, `internal/agent-operations/`, `internal/compiler/` | Living doc; edit in place and refactor before exceeding 300 lines. |
| Transitional contract prose (uncataloged semantics) | `internal/contracts/<domain>/` | Living doc; retire or narrow once the `spec/**` entity stabilizes. |
| Design memo / ADR / active investigation | `internal/records/YYYY-MM-DD-topic.md` | Dated snapshot; promote settled rules to `spec/**` or living docs, then archive when superseded. |
| Historical record (no longer active) | `internal/records/archive/YYYY-MM/` | Frozen history; do not rewrite past observations. |
| Screenshots, browser traces, raw test logs | GitHub PR attachments / Actions artifacts / unmerged archive branch | Ephemeral or external; never committed to `main`. |
