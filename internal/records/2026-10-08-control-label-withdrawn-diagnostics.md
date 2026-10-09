# Withdrawn ControlLabel diagnostics

Date: 2026-10-08. Base: `305ced3afb6b6e3127dee8c0f16859ee8661615b`.

`C-CONTROL-LABEL-0001-UNIQUENESS` remains draft accepted implementation direction. Its explicit withdrawal diagnostic requirement was not satisfied by the removed participant: registry refresh only updates still-registered participants. Two real Runtime session negative controls reproduced a healthy participant remaining `null` after presence withdrawal and a removed association retaining `foreign-tree-scope`. Association effects themselves were correctly withdrawn.

The module now updates its own diagnostic before releasing the retired lease. An intended but nonpresent association reports `missing-binding`; removing explicit association intent clears old errors. Missing anatomy-domain and unsupported-anatomy diagnostics stay specific. Updating before cleanup is deliberate: cleanup can synchronously restore presence and install a successor, whose fresh registry diagnostic must remain authoritative. No registry owner, reference, semantic name or host disposal mechanism is changed.

Evidence: the two new negative controls failed against the unmodified base. All six ControlLabel suites pass after repair, 72/72 tests. New positive controls check restored naming after presence resumes and a reentrant disposal which installs a fresh live successor without losing its healthy diagnostic or disposing its lease. Existing anatomy, host, activation, registry and failure-recovery controls remain passing. This is module/Runtime source evidence, not native-browser or assistive-technology acceptance. No remote write or integrated acceptance is claimed; independent review remains pending.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
