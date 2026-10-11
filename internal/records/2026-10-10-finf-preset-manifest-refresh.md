# Preset manifest build blocker

Official exact-head 8989403a6d3668948c7394f4a370d8269ba1a6ec evidence jobs stopped before launching a browser: `check:styles:preset` reported a stale Shadcn token manifest. The observed runs were 38035138248/job114163902340 and 38035138272. No screenshots or browser pass are claimed for those stopped jobs.

Ran the repository's unchanged `styles:preset:generate`. Its first run also exposed three genuinely unsupported Classic Drawer handle tokens: bg-[#ccc], border-[#bbb], shadow-inner. Added finite physical lowering with document/Shadow tests, then reran the same generator successfully. The tracked Shadcn, Brutalist and two draft-family token manifests now reflect the actual current sources. No generator/check was skipped or weakened and no generated file was hand-edited.

Validation: all three `check:styles:preset` stages passed (Shadcn 410 tokens, Brutalist 401, draft-family physical closure current). The 41 CSS tests and the real Brutalist generator round-trip test passed, 42/42 total. Official browser screenshots remain a subsequent exact-head execution step.

Agent: dot  
ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
