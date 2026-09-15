# Autonomous maintenance

This directory contains the governed operating material for Agent-assisted Proto UI maintenance. It is not a project truth source and does not define Proto UI semantics.

Applicable `spec/**` entities remain authoritative according to lifecycle. `internal/records/**` may preserve dated observations and experiment outcomes, but remains non-normative. Confirmed semantic changes must follow the normal spec, executable-evidence, implementation, and projection workflow.

## Current path

Phase 0.1 runs are currently entered through the repository-scoped `$pui-maintain` skill. Observer and Verifier remain read-only and use fresh independent contexts; remediation also receives an independent review. Those evidence boundaries let the workflow move faster: an independently verified drift whose expected result is already fixed by current authority proceeds through remediation, validation, closure, review, and authorized exact-head integration without a repeated maintainer checkpoint. `pui-record` closes supported no-finding, independently rejected, and fully evidenced blocked outcomes directly.

Only two unresolved decision classes interrupt that path: product direction that existing authority does not decide, and a privileged or difficult-to-reverse operation such as publication, release, access, secrets, rulesets, security disclosure, or a provenance exception. Invocation and live mutation still require current-user or standing authorization, exact scope, live permission, DCO/provenance, trusted CI, independent review, idempotency or exact-head binding, and repository rules.

See [`phase-0/README.md`](./phase-0/README.md) for the run protocol.
