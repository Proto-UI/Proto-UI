# Incremental discovery of website code surfaces

## Observed problem and repair

The document-level CodeSurface observer rescanned the full document for every child-list mutation, including unrelated Search updates and internal projection changes. Initial bootstrap and explicit rescans still need to discover the whole document. Subsequent mutation delivery now discovers connected added element subtrees belonging to that document and includes a matching subtree root itself. Nested candidates are reduced to their outermost current subtree regardless of the order of mutation records.

Disconnected-root cleanup remains independent of discovery and continues to report cleanup errors. Connected moves retain the existing owner. Removed roots can start a new lifetime after cleanup. The hidden-first visibility gate, renderer materialization, theme handling, page-swap cleanup and existing four-adapter integration assertions are unchanged.

This repair belongs to the website bootstrap observer. It neither changes a prototype definition nor establishes Search's native performance acceptance. In the preserved v12 profile, this scan accounted for about 6.405 ms of an 828 ms ready task; it was a real redundant operation but not the dominant cost.

## Evidence and fixture identity

The initial eight-case regression run against the old source produced **five passes and three failures**. The subsequent green run passed **8/8 with zero skips**. Between those original runs, explicit TypeScript mock-argument types and formatting changed the fixture bytes; that difference is retained rather than described as identical evidence.

A supplementary old-source run uses the final unmodified fixture, SHA-256 `20b085cca91bc02e2b5f34f7c3b3f5df47ac346a32b17c530351a0d30ba1b706`. A single Vite pre-load override supplies the exact old CodeSurface module from published commit `eb2a023499c520933ea1b33499be2d0f4e73b26a`, SHA-256 `45666a175353e1ace9535cd65c02284ab80e89b7802078bcdd38ed54c33dde92`. The original repository configuration and plugins remain in place, the override was loaded once, and the candidate working tree was not replaced. That final fixture again produced **five passes and the same three failures** in 5.194 seconds. This supplements, rather than replaces, the original red evidence.

The new focused fixture stubs rendering while leaving discovery, MutationObserver delivery, visibility gating and scope ownership real. Separately, the unchanged actual-adapter CodeSurface suite and hidden-first gate suite passed **33/33 tests with zero skips**. Selected strict types passed in 11.870 seconds after the disposable type-check configuration included the existing application ambient declarations. The earlier configuration failure remains recorded; product types were not weakened.

The repaired source SHA-256 is `97a44d91efc560c3e2fa9fcbed26c4b07ebe14eeca80315b93fd5294d28d6b98`. Independent review checked the implementation, the actual four-adapter integration results, source stability and the supplementary final-fixture red evidence. Native browser acceptance remains a separate candidate-level gate.
