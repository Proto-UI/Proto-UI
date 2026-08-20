# Web adapter conformance journeys

This private test package runs scenario-level fixtures once against every official Web adapter through their shared DOM platform. It complements adapter unit tests and runtime contract tests; it does not prove host-capability correctness by itself.

The current adapter matrix must match `AdapterIds` from the Demo Matrix runtime registry. A new official Web adapter therefore fails the suite until it is explicitly connected to each shared journey.

Run the category with:

```sh
corepack pnpm@10.32.1 test:web-conformance
```

Vitest's root include also collects these files, so `test:runtime` and the default `test` workflow enforce them. Cataloged coverage includes [`T-WEB-SHADCN-DIALOG-JOURNEY-0001`](../../spec/tests/T-WEB-SHADCN-DIALOG-JOURNEY-0001.yaml) and [`T-SCROLL-COMPOSED-CONTROL-0001`](../../spec/tests/T-SCROLL-COMPOSED-CONTROL-0001.yaml).
