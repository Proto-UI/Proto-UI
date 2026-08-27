# Autonomous maintenance experiments

This directory contains operational material for experiments in Agent-assisted Proto UI maintenance. It is not a project truth source and does not define Proto UI semantics.

Applicable `spec/**` entities remain authoritative according to lifecycle. `internal/records/**` may preserve dated observations and experiment outcomes, but remains non-normative. Confirmed semantic changes must follow the normal spec, executable-evidence, implementation, and projection workflow.

## Current stage

The current experiment is Phase 0.1: manually triggered runs routed by the repository-scoped `$pui-maintain` entry skill. Its lazy stage skills keep Observer and Verifier read-only, preserve independent verification and remediation review, and retain explicit semantic and integration decisions. `pui-record` synchronizes supported no-finding, rejected-finding, and blocked terminal outcomes without pretending that remediation review occurred.

See [`phase-0/README.md`](./phase-0/README.md) for the run protocol.
