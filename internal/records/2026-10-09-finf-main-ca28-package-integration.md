# Finf synchronization with main ca28: independent declaration roots

Date: 2026-10-09 UTC. Source commit `a1b11ba1b2e4319ec221cba6f89101153bac9883`, tree `8badc37fab8a1f7d8aaab666e549a1a5c85d5c23`, is a real merge of published Finf `d01d24ffe5c1b85fa6b99e31ebc6fcca1822f3e9` and main `ca28a4db278f948e34c57ae779385673d37d391b`. Main's original authors and all four intervening commits are preserved without re-signing their work.

## Problem and bounded resolution

Main #880 advanced while the prior Finf publication was waiting. The resulting two-file conflict prevented pull-request workflows from starting; zero Actions runs did not mean tests passed. This merge contains no part of the later visual-reference or Select diagnostic batch.

In `public-packages.mjs`, retain Finf's shared `publicPackageSourceEntries` helper, `.ts`/`.tsx`/`.js` source selection, path traversal and missing-source checks, wildcard exclusion, custom output directory and relative ESM/declaration normalization. Extend the helper to recognize explicit `.d.ts` targets by removing the complete declaration suffix. This realizes main's independent declaration-only export roots without requiring root-barrel leakage or reverting installed-consumer repairs. Preserve main's stronger package-name ESM and strict type-consumer regression and its absent-export negative case. Add missing, wildcard and escaping declaration-only root controls.

In `package-budgets.mjs`, retain the already approved Finf ceilings and historical rationale verbatim: runtime 78,500; React 106,000; Vue 106,000; Web Component 132,000 gzip bytes. Main's smaller caps describe its narrower source, not this Finf union. No new ceiling increase or stricter-gate waiver is introduced.

The two bilingual package-surface notes merge automatically. Only five files differ from the published Finf source: builder, two test files and two documentation files; budget bytes are unchanged.

## Fresh validation and retained failures

The main type-only export regression first fails on the unextended Finf helper with missing `dist/internal/input.d.ts`; it then passes with the combined helper. Thirteen building/consumer/negative controls pass. Independent source review separately ran nine controls across the three public-builder files.

All 45 public packages freshly build with declared targets and native ESM smoke. A new 15-package public consumer passes 27 native ESM entries and strict NodeNext/Bundler using canonical release manifests; a separate 15-package private draft consumer passes 18 entries and both strict resolution modes. Both install local tarballs offline, use no workspace links or source aliases, and retain `skipLibCheck: false`. Thirty exact tarballs and hashes are retained in shared evidence.

The first full build stopped because the restored temporary checkout lacked package-local workspace links. Existing dependency symlinks were restored from the installed checkout with local package targets resolving to this new source/dist, then the complete build passed. No install or changes to the selector checkout's artifacts were required.

The combined consumer/budget command was interrupted by a tool-reported registry-access denial after the public-consumer stage. Its unfinished stages were not counted. No registry access was retried. The private Bundler check subsequently passed using absolute existing local Node/TypeScript files; budget checks used installed esbuild with offline/network-disabled settings. The original empty private Bundler log is not success evidence.

Fresh Finf budget mode exits 0 with `withinBudgets: false`; strict mode exits 1. Actual gzip remains React 106,445 (+445), Vue 106,280 (+280) and Web Component 132,030 (+30). Measurements and failed strict comparisons are retained; no result is relabelled green.

Canonical source evidence is regenerated from the immutable merge commit. Counts, the 4,206 bound path inventory, consumer states, 258 draft identities and the delivery checklist remain unchanged. Both source-wall matrices and all 113 canonical proof negative controls pass; exact command, exit and hash receipts accompany this record.

## Remaining boundary

This is a local reviewed candidate until separately published with actual-object proof binding. It is not native browser/GPUI acceptance, a whole-workspace type rerun or a complete documentation-site build. Existing native failures remain open and require new exact-head CI once the merge conflict is removed. Four public SSR completion flags remain false; private Liquid Card stays default-off; completion remains 0/68.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
