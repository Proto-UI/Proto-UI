# Candidate discovery and implementation packets

Status: public-development, unreviewed, **not admitted**. This is preparation for #748 and a bounded part of #734, not a model result or completion of either issue.

`scripts/benchmark/participant/task-packets.mjs` constructs two explicit tasks:

- **Discovery:** ordinary public profile-sections HTML from `benchmarks/interaction/tasks/tabs-discovery.html`. The specimen is hand authored, with no product/oracle/control imports. It is not a representative consumer codebase or a held-out task. The participant proposes properties and tests, separating observation, recommendation and uncertainty. Blind discovery is the primary #748 outcome; knowledge-visible discovery is later calibration only.
- **Implementation:** standalone HTML for the manual Reference sections journey. The task describes intended behavior, accessible names and removal controls, not evaluator check IDs, fixture code or test implementations.

For each task, the prompt and ordinary material bytes are identical across conditions. Blind has no Proto material. Knowledge-assisted adds only the four allowlisted `P-BASE-TABS{,-LIST,-TRIGGER,-CONTENT}` draft specification documents, including their provenance/lifecycle and reference links, but not linked source or test implementations. A reference path is not permission to read a file; the no-tools participant has no dispatcher. Materials are SHA-256 bound and pass the actual wire validator. Preparation must retain the exact bytes; current working files are **not a frozen source snapshot**. No response from one condition may enter another request.

## Crosswalk is human judgment, not a string-matching score

Keep each raw proposal even if JSON validation fails. `discoveryProperties` only checks the requested proposal structure. `validateCrosswalk` only checks manually authored categories, rationale, attribution, pinned negative-search scope where applicable, and exact quotations/offsets bound to source digests. Offsets are UTF-16 string indices, digests cover UTF-8 bytes. Its status is always `citation-valid-unreviewed / not-admitted`.

The six labels are `both`, `agent-only`, `proto-only`, `equivalent-different-expression`, `genuinely-missing-proto`, and `ambiguous-disputed`. Both-side claims require both citations. “Genuinely missing” also needs a recorded pinned Proto search scope; an Agent-only proposal by itself is not proof that the catalog lacks a rule. A citation/rationale is not proof of correct equivalence. Independent semantic review is still required and may reject a well-formed row. No automatic counts imply independent approval or a spec amendment. An empty/pending crosswalk is not measured discovery coverage.

## Scope and gates

The first comparison is within-model, development-only, and information volume is not matched. It cannot attribute a difference specifically to Proto UI rather than extra guidance. The mature-library path, matched-information control, usable knowledge skill, clean-project example and broader primitive coverage in #734 remain future work, not silently “completed” by these packets.

Before formal admission: independently review semantics and all participant bytes; confirm model channel, snapshot/identity limitations, capability boundary and billing cap; run real Round0; resolve or explicitly exclude disputed criteria; freeze the version; predeclare run order and at least three fresh independent repetitions per task × condition × model. Retain failures and exclusions. Public specimens and synthetic validation never become model results.
