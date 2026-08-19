# Autonomous maintenance experiments

This directory contains operational material for experiments in Agent-assisted Proto UI maintenance. It is not a project truth source and does not define Proto UI semantics.

Applicable `spec/**` entities remain authoritative according to lifecycle. `internal/records/**` may preserve dated observations and experiment outcomes, but remains non-normative. Confirmed semantic changes must follow the normal spec, executable-evidence, implementation, and projection workflow.

## Current stage

The current experiment is Phase 0.1: manually triggered runs using the repository-scoped `proto-ui-autonomous-maintenance` Skill. Observer and Verifier stages remain read-only. Its purpose is to test whether an Agent can discover previously unknown, reproducible, valuable maintenance findings without being given a known bug, while preserving independent verification, governed remediation, measurable run state, and explicit semantic and integration decisions.

See [`phase-0/README.md`](./phase-0/README.md) for the run protocol.
