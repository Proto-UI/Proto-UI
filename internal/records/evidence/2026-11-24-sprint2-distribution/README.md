# Sprint 2 distribution evidence

Bound source: `4ffc65f2c3d32bcd5d1bd897ab20d9c6f087fb3c`. Full interpretation and reproduction: [2026-11-24 distribution record](../../2026-11-24-sprint2-distribution.zh-CN.md).

- `receipts/pinned-determinism.json`: two fresh artifact builds, all nine files byte-identical.
- `receipts/pinned-cli.json`: isolated registry consumer and all actual CLI/watch outcomes.
- `receipts/native-consumers.json`: four isolated registry consumers; original and edited builds/runtimes passed.
- `receipts/release-families-first.json`: original three successful profile groups and the Vue3 Shadcn compiler failure; no later result is substituted.
- `logs/`: original command streams, including the real pre-fix watch regression and the focused 59-test success, compressed losslessly.
- `archives/pinned-artifact.tar.gz`: all nine delivered artifact files, including the compiler implementation, map, manifest, lock, profiles, provenance and license.
- `archives/pinned-cli.tar.gz`: complete bounded CLI work tree, including consumer sources, output revisions, locks, commands and replacement controls.
- `archives/release-families-first.tar.gz`: complete bounded first family work tree, including the failed group receipt and successful groups' generated/executable sources and runtime traces.
- `archives/native-consumers.tar.gz`: complete bounded four-profile consumer work tree, including original/edited traces, inputs, generated/executable files, locks, type diagnostics and measurements.

[manifest.json](./manifest.json) binds every archive and retained member, including modes and symlink targets. Every archived member was read back and compared to its original payload. Installed `node_modules` and `.npm-cache` are excluded; exact locks and observed package membership/payload digests remain. This is not recovery of the historical private #1154 source archive.

The consumer archives retain the actual symlink controls as symlinks, including their original absolute targets, to preserve what the tests exercised. Review them as evidence; the reproduction scripts create fresh isolated work trees.
