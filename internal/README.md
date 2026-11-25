# Internal engineering documents

This tree contains contributor guidance, readable contract explanations, engineering context, and evidence. Start with the [documentation ownership guide](governance/documentation-policy.md) to distinguish current instructions from historical material. Product semantics follow the applicable lifecycle in the [spec catalog](../spec/README.md).

| Directory | Role and entry point |
| --- | --- |
| [governance/](governance/README.md) | Maintained release, package, contribution, CI, and documentation procedures. |
| [agent-operations/](agent-operations/README.md) | Agent workflow, skill composition, review, and evidence procedures. |
| [contracts/](contracts/README.md) | Readable explanation and transitional fallback for subjects not fully cataloged in spec. |
| [records/](records/README.md) | Dated investigations, decisions in progress, audits, and implementation observations. |
| [releases/](releases/README.md) | Version-specific preparation and source-bound publication evidence. |
| [coverage-matrices/](coverage-matrices/README.md) | Source inventories, current portfolio navigation, and generated coverage views. |
| [compiler/](compiler/README.md) | 0.4 compiler foundation, normative spec links, retirement scope and implementation sequence. |
| [website/](website/) | Website ownership, design and consumer-delivery records; public content lives in `apps/www/`. |
| [agent-harness/](agent-harness/) | Harness consumer coverage and development material. Internal fixtures do not replace acceptance in a real application. |
| [autonomous-maintenance/](autonomous-maintenance/README.md) | Governed maintenance runs and their retained evidence. |
| [baselines/](baselines/) and [models/](models/) | Retained baselines and engineering models; follow their source and measurement boundaries. |
| [fixtures/](fixtures/) and [tutorial/](tutorial/) | Supporting fixtures and examples; inspect each consumer before changing source data. |
| [issues/](issues/) | Prepared or retained issue material; live Issue state must be read from its actual source before a tracking update. |

Place a new current procedure in its owning domain. Place a time-bound investigation in a dated record, then promote settled semantics through spec and update the appropriate reader projection. Keep historical records factual instead of rewriting them to match a later result.
