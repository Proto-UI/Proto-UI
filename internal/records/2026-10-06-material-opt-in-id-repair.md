# Preserve the private material implementation's opt-in boundary

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

Exact Finf source: fc5effc99779aca637acaa06789937cef1414cf1.
Material workflow 37530646628, job 112498864175, correctly rejected three
ordinary Runtime/React/Vue build graphs: the new shared Feedback declaration
conflict check imported OWNED_MATERIAL_ID from private owned-slot.ts, thereby
adding the private v1 semantic implementation to those graphs.

The identity now lives in a side-effect-free declaration-id.ts. Shared Feedback
reads only that leaf. The old owned-slot path imports/re-exports the same single
constant, preserving its private API and retaining the actual binding only for
opted-in WC consumers. No graph assertion was loosened.

PASS locally: all four existing actual esbuild tree-shake tests and 14 focused
Runtime/material-observer tests. The private fixture's full source/dist browser
workflow is still required on the repaired integrated head; no optical paint
result is claimed from these graphs.
