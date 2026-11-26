# Contrast audit: latest complete Focus dependency

After the exact #775 `173890a2c75dd6b433ebfee130fba43743bbef1a` native run reached a successful four-shard terminal state, this normal merge integrates the verified latest #832 head `b1f92a59a61432c7469e43bb26ae3daed3befca7` rather than overwriting it with older f3 source files.

## Preserved source and history

- The complete dependency retains its external 5f8d3ad/ee7225 evolution, 0b7e278a reconciliation and b1f92a59 current-acquisition guard. It distinguishes replay-null from an explicit new cancellation, reconciles successful acquisition (including already-focused targets), cancels stale queued adapter frames, and prevents an old Text Control catch from mutating a replacement lease.
- The merged Adapter, Module and Runtime directories are byte-identical to published b1f92a59. Audit probe, popup helper, Astro config and provenance helper are unchanged from verified 173890a2. The #859 main contribution merely repeats three already-reviewed WC paths in the existing Set; it does not add an effective broader exemption. The #857 importer-edge validator remains intact.
- Original dependency measurements/records retain their source-head labels. Fresh carrier measurements were taken on the staged combined code tree `cee979421167b8970d57893fd8619d45c01664a3` before adding this handoff record. The handoff does not relabel those measurements as a different commit.

## Actual carrier checks and pending evidence

- Focus/Text Control/four-adapter retry plus Select Escape selection: 307/307 focused tests pass.
- Complete production graph controls: 241/241 pass.
- Fresh eleven bundle measurements: nine PASS, two diagnostics. Runtime 69183/69200 gzip bytes (17 bytes remaining), React 90845/91029, Vue 90604/90800, WC 99688/104500. Other gates: Lucide X 1735/3000, Lucide root 635820/700000, Core 5153/6600, Base Button 3779/6000, Shadcn Button 4625/7000. Consumer light-DOM 103783 and direct-shadow 103788 are diagnostics. No limit changed.
- Exact 173890a2 evidence is preserved separately: all four shards passed 40 calibrations, with 790 raw / 782 matched-achieved / 8 unmeasured / 40 unexecuted / 0 genuinely unresolved. Native public Root selection facts passed in all eight Select runtime/theme cases; the inspected text PNG and manifests are linked from PR comment 6017686098. Those earlier results do not certify this changed shared source.
- Final combined-head general/type/build/source and native/aggregate evidence are reported separately on the PR after execution. Independent approval, dependency acceptance and repository gates remain required; #852/#853 remain explicit follow-ups. No full accessibility conformance or new unknown exception is asserted.
