# Design and implementation records

[`specs/`](specs/) contains earlier design discussions and approved design checkpoints. [`plans/`](plans/) contains their implementation plans. The directory name reflects the workflow used to author them; its `specs/` child is distinct from the machine-governed [`spec/` catalog](../../spec/README.md).

These files remain useful sources. Some are explicitly linked by current catalog entities and coverage matrices, including the Base Radio Group semantic design and the source-aligned Brutalist design. Their age alone is not a reason to discard them.

## Read a record

1. Identify the record's date, named Issue or PR, source revision and original status.
2. Follow replacement notices and the applicable catalog entity's lifecycle, criteria and relations.
3. Compare implementation and actual evidence before treating a plan step as delivered.

An original “Approved” label records a decision in its stated context. It does not promote a current `draft` entity, certify a later implementation or override a replacement. Instructions embedded in an old execution plan describe that plan; start current contribution work from [`AGENTS.md`](../../AGENTS.md) and the current task.

## Maintain the history

Preserve original decisions, rejected alternatives, source bindings and evidence. Record new engineering direction under [`internal/records/`](../../internal/records/README.md), and update the applicable catalog or maintained guidance through its normal review process. See the [documentation policy](../../internal/governance/documentation-policy.md) for placement and retirement rules.

Before moving or retiring any source, search its repository-relative path in `spec/`, `internal/coverage-matrices/`, code and other documentation. For example:

```sh
rg -n -F 'docs/superpowers/specs/2026-08-12-base-radio-group-semantic-design.md' spec internal packages apps
```

Keep the original source accessible to those references. A directory cleanup is not evidence that the recorded work or its remaining acceptance conditions are complete.
