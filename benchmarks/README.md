# Benchmark inputs and protocols

This directory contains versioned study inputs, task definitions, public controls, scoring data and study protocols. Executable coordinators and validators live in [`scripts/benchmark/`](../scripts/benchmark/). These inputs are separate from product acceptance in the [`spec/` catalog](../spec/README.md).

## Entry points

| Study | Scope |
| --- | --- |
| [`interaction/`](interaction/README.md) | Public development calibration for Dialog, Tabs and Select, including dataset/scoring boundaries and archive verification. |
| [`interaction/discovery/`](interaction/discovery/README.md) | Primitive-specification discovery inputs, freezing protocol and independent comparison accounting. |
| [`interaction/knowledge-consumer/`](interaction/knowledge-consumer/README.md) | Experimental interaction-knowledge workflow and a separate reference consumer. |

The entry READMEs distinguish prepared inputs, executed calibration and formal evaluation. Preserve those distinctions and the source revisions already pinned by each study. A coherent archive or passing validator does not establish a successful participant run or a product guarantee.

## Work on a study

Use Node 24 and the package manager declared in [`package.json`](../package.json). Run the bounded input and harness checks from the repository root:

```sh
corepack pnpm@10.32.1 benchmark:validate
corepack pnpm@10.32.1 benchmark:test
```

Read the individual protocol before browser or participant execution. Results belong in a new evidence directory selected by that runner, retaining failed and incomplete attempts as well as successes. Do not overwrite source-pinned inputs to make an old run appear current.

Place new study definitions here and shared runner code in `scripts/benchmark/`. Single-purpose rendering probes belong in [`experiments/`](../experiments/README.md); conclusions and follow-up decisions belong in [`internal/records/`](../internal/records/README.md). Follow the [documentation policy](../internal/governance/documentation-policy.md) for maintained guidance and historical evidence.
