# Internal Records

This directory is for short-term project direction and daily engineering records.

These documents exist to preserve:

- what the project is trying to do next
- what actually happened
- what problem was observed
- which alternatives were considered
- which decision was taken for now
- what remains open

They are intentionally:

- not normative specifications
- not external-facing engineering guides
- not durable release commitments
- not substitutes for spec entities or executable coverage

Records may contain roadmaps, priorities, milestone hypotheses, audits, implementation logs, design explorations, and temporary decisions. Their authority is time-bound: a newer relevant record may revise short-term direction from an older record, but no record overrides an applicable entity under `spec/**`.

Read records by topic and date. Do not assume that the newest file in this directory supersedes every earlier record, and do not interpret an old plan as current merely because no one edited it in place.

If a decision later stabilizes, the relevant parts should be promoted into one or more of:

- `spec/knowledge/*`
- `spec/decisions/*`
- `spec/contracts/*`
- `spec/prototypes/*`, `spec/modules/*`, or `spec/host-caps/*`
- `spec/tests/*` and executable coverage
- `apps/www/src/content/docs/*/specifications`
- `apps/www/src/content/docs/*/build`
- readable contract documents where additional explanation remains useful

Recommended structure:

1. Context
2. Observed facts
3. Problem statement
4. Decision
5. Rationale
6. Rejected or deferred alternatives
7. Follow-up work

For a short-term direction record, also make the comparison baseline, review trigger, and non-goals explicit. For an implementation record, include exact paths, commands, versions, or evidence when they matter to reconstruction.

Naming suggestion:

- `YYYY-MM-DD-topic.md`

These records should prefer factual reconstruction over retrospective cleanup.

When direction changes, add a newer dated record and link the previous baseline. Do not rewrite an old record to imply that the later decision was always known.
