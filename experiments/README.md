# Bounded research fixtures

This directory holds executable probes, comparison scenes and their source/provenance notes. Each experiment owns its question, inputs, execution recipe and evidence limits. Product semantics remain in the [`spec/` catalog](../spec/README.md); production implementations live in their owning packages.

| Experiment | Question or fixture |
| --- | --- |
| [`effect-graph/`](effect-graph/README.md) | Static modeling of pinned effect pipelines, resources and bindings. |
| [`liquid-canvas-transport/`](liquid-canvas-transport/README.md) | Same-render owned Canvas2D pixel/lifetime comparison and stage observations; no production carrier change. |
| [`liquid-elevation-control/`](liquid-elevation-control/README.md) | Matched Liquid Surface elevation variants using the actual family prototype. |
| [`liquidgl-baseline/`](liquidgl-baseline/README.md) | Pinned upstream liquidGL comparison with retained license and provenance. |
| [`material-initial-paint/`](material-initial-paint/README.md) | Initial material paint and source-bound browser evidence. |
| [`material-optics/`](material-optics/README.md) | Backdrop sampling, displacement and shape/lighting probes. |
| [`material-specializer/`](material-specializer/README.md) | Source-specialized material programs and source/emitted consumer experiments. |
| [`material-v2/`](material-v2/README.md) | V2 optical source and emitted-runtime consumers on the four Web Adapters. |

## Run and extend a fixture

Read the experiment's full README before execution. Its linked workflow and scripts define the required environment, source bindings and retained outputs. For example, the effect-graph model can be checked without a browser:

```sh
node --test experiments/effect-graph/model.test.mjs
```

Browser, GPU, native and visual claims require their corresponding observed evidence; passing a static model or generating a bundle covers only that stage. Preserve dated successes and failures with their original revision instead of rewriting them as current results.

Add a new probe here when it needs an isolated executable fixture. Put reusable production behavior in the owning package, benchmark datasets and scoring protocols in [`benchmarks/`](../benchmarks/README.md), and engineering conclusions in [`internal/records/`](../internal/records/README.md). Promotion to a product guarantee follows catalog review and lifecycle; an experiment's location or a passing run does not perform that promotion. See the [documentation policy](../internal/governance/documentation-policy.md).
