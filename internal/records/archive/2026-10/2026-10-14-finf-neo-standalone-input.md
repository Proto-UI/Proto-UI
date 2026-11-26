# Neo standalone Input candidate

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

## Scope and reference

This local candidate follows PR #887 baseline `9c448af9e3f3e0bb1b8a5aa61ed732e2a9026516`. The full tree had Textarea, InputOTP and FieldControl but no standalone Brutalist Input source, package subpath or family preview. Those components do not substitute for this missing projection. No Field, Compiler/IR, Runtime or PR #888 implementation was changed.

Static source: [ekmas/neobrutalism-components input.tsx at 3306a802](https://github.com/ekmas/neobrutalism-components/blob/3306a802724874a85f93079702b2795370a279d4/src/components/ui/input.tsx#L5-L18), Git blob `8887ff487008dbb5fd5a0ab91924f3b7f5253366`, read 2026-10-14. No upstream third-party code was executed. The existing package THIRD_PARTY_NOTICES.md retains upstream MIT attribution.

P-BRUTALIST-INPUT inherits the draft P-BASE-INPUT once. Its single host-owned editor preserves the complete current plain-text contract. The projection, root/subpath exports, CLI key, actual website registry/family recipe, bilingual page and navigation are introduced together. h-10 / px-3 / py-2 / text-sm retain rem geometry. The current family typography maps font-base to font-medium. Black focus paint requires the separately reviewable generic `ring-black` renderer repair; a dark theme-ring fallback is not equivalent.

## Evidence and limits

- Base Input 6 tests and Neo Input 5 tests passed, covering one contentless editor, hints, dirty uncontrolled value, controlled refusal/acceptance, synthetic composition, disabled/readOnly repeated updates, physical focus and actual CSS output.
- Generic CSS renderer 58 tests and website projection-family 29 tests passed.
- Targeted CLI registry checks passed (2 executed, 39 skipped); the full CLI run retained a source-scan/generated-preset mismatch and did not pass as a whole. The same failing case was reproduced on an untouched 9c448af9 worktree.
- CLI build and actual website prototype CSS/Shadow generation passed; generated Brutalist preset was updated through its generator.
- New spec lifecycle authoring against the exact baseline passed. The whole prototype-catalog check remains failed on existing catalog debt; all 536 diagnostic lines are identical to an untouched 9c448af9 worktree, and no standalone Input failure remains.
- Targeted prototype and actual-browser test TypeScript checks passed. Whole-workspace TypeScript failed with unresolved existing worktree dependency paths and broader errors; no whole-workspace pass is claimed.
- Initial failed evidence is retained: unsupported ring-black, invalid test URL scheme in happy-dom, outdated registry expectation, missing local prompts/zod resolution. Existing installed dependency links repaired the local resolution gaps without installation; the assertions were corrected without relaxing runtime behavior.

The executable browser entry is `apps/www/src/content/docs/zh-cn/demo-brutalist-input.browser.test.ts`. Run the repository Vitest command against that file in an authorized browser-capable checkout. `PROTO_UI_NEO_INPUT_EVIDENCE_DIR` can choose an evidence directory outside the source tree. The suite is registered in the default browser shards; CI defaults captures to `PROTO_UI_RUNTIME_EVIDENCE_DIR/neo-input`, covered by the existing runtime artifact upload. Independent review caught and corrected the initially missing inventory/upload connection. It captures real prototype previews for four Web runtimes in light/dark, focused and 320px/200% root-font states, with HEAD, dirty flag, current source-tree digest and screenshot hash beside every PNG. It checks actual keyboard/pointer editing, Tab skipping disabled, readOnly preservation and source-relative geometry. Synthetic composition is labeled separately and does not prove OS IME.

No browser was launched locally because the previously verified EPERM restriction remains respected. The browser entry is typechecked, not executed. New-candidate screenshots, real OS IME, browser visual review, independent review, hosted exact-head checks, Compiler and native targets remain outstanding. Existing upstream arbitrary types/file controls, DOM forwarding and placeholder styling gaps remain open, as does upstream focus-offset/default theme comparison; this candidate is an increment, not full upstream conformance or completion of #872/#887.
