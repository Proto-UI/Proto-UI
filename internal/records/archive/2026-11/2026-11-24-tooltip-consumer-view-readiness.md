# Tooltip consumer view-readiness validation

The original Tooltip Button browser case waited for the semantic `root.open` value and then immediately read the content ID. In the retained failing execution, React still exposed the closed, pending content shell at that point. The actual content view committed later and received the expected ID and description binding.

This change adds one preparation step before the existing identity assertions:

```ts
await node(page, 'content').waitFor({ state: 'visible' });
```

The existing semantic-open wait, nonempty content-ID assertion, exact `aria-describedby` equality, activation count, Tab/Shift+Tab, Escape, disabled and cleanup assertions remain intact. The shared case still covers all 12 Base/Shadcn/Brutalist × React/Web Components/Vue/Vue 2 combinations, within the original complete 84-case file. No timeout, retry policy, fixture, product implementation or browser sandbox setting changes.

## Source and observed failure

The initial integration source was `4f8c56486825afbb563c3aa159c7ad76a1d3d82a`, a local normal merge of the Portal carrier `f753c05a69f84d47cf3842f6bd5d8a8fb7454b90` and main `6d6c3f7868e3415a79792dd5706dbcf20f34e294`. That local merge was not pushed. Another actor subsequently integrated the public Portal PR #1770; this follow-up starts from actual main `1cc4ad159da621d58e2b668d0d2ef0a22be6ed1b`.

The complete original browser file on the local integration source returned **83 passed, 1 failed, 0 skipped**, exit 1, in 108,837 ms. The failure was the Base React Tooltip Button case at its original content-ID assertion. Five separately retained runs of that unchanged single case returned four passes and the same one failure. The 83 unselected cases in those diagnostic runs are not counted as passes.

The earlier complete 84/84 result on Portal source `cd684a20ba60c1f382c88eeaea5b25eb29a0f6c5` remains a distinct historical observation. The 545 captured source-input hashes for that run and the new integration run differ only at `packages/modules/positioning/src/web/target-alignment-host.ts`. That comparison does not prove the Select implementation caused the timing.

## Timing diagnosis and contract boundary

A separate observation probe used the same actual public fixture, style collector, browser build and sandboxed Chromium. It observed the original case prefix on ten independent pages; two reached the original ID assertion boundary before the content commit. This is bounded reproduction evidence, not a statistical reliability estimate or replacement acceptance suite.

In the retained fifth probe, the semantic value was already open at 964.3 ms, while the element was still:

```html
<div data-pui-root="" data-pui-view-detached="" data-pui-view-pending="" data-demo-ref="content">
  Save this document
</div>
```

At 980.5 ms, a later React commit replaced that pending shell with the actual content node, which had `id="pui-tooltip-1-content"` and a matching button `aria-describedby`. The seventh probe shows the same ordering. The timing probe recorded no page errors. The first probe attempt failed during diagnostic setup because a transformed local evaluation helper referenced `__name`; its source, failure and log are preserved, and it supplies no passing observation.

The independent review checked the actual lifecycle, attachment, shared visibility, Tooltip and React adapter source. [C-LIFECYCLE-0008](../../../../spec/contracts/C-LIFECYCLE-0008.yaml) separates semantic/ViewIntent state from actual committed view attachment, and [C-HOST-VIEW-ATTACHMENT-0001](../../../../spec/contracts/C-HOST-VIEW-ATTACHMENT-0001.yaml) excludes pending/detached shells from the usable view. The existing shared visibility implementation hides those shells. Waiting for visible current content therefore observes the intended preparation boundary; it does not wait for the desired ID or ARIA value. Permanently hidden content still fails the preparation step, and visible content with a missing or incorrect identity still fails the original assertions.

The independent reviewer compared eleven relevant source, fixture and contract files between `04052a7ea70cd69c062a804b438d99ae7d900e6a` and the follow-up base `1cc4ad1`; all eleven were byte-identical. No new synchronous-open guarantee or lifecycle amendment is introduced.

## Candidate validation

The exact tested candidate was main `1cc4ad159da621d58e2b668d0d2ef0a22be6ed1b` plus the single added wait. It was an explicitly recorded modified working tree during execution.

| Check | Actual result |
| --- | --- |
| Complete original component-consumer browser file | **84/84 passed**, zero skipped, exit 0, 127,635 ms |
| Original React Select keyboard and presence/remount files on clean main `1cc4ad1` | **16/16 passed**, zero skipped, exit 0, 10,194 ms |
| Independent lifecycle/readiness source review | One-line preparation change supported; no product change required by this evidence |

Test-file SHA-256 before the edit: `2a20178558cf57bbfa6ee74c7f9666545f7b10560f720346939fa2714123006f`.

Test-file SHA-256 executed with the edit: `3cd0b01fa078f3b3a1fcef76b56eb5d2ca659f3a37046f65a8f882eb4867f909`.

The complete browser file used Node 24.22.3, pnpm 10.32.1, Vitest 2.1.9 and Chromium 145.0.7632.6. The original 300-second outer bound and all original case/setup deadlines were retained. A short owned temporary directory avoids the previously reproduced Chromium temporary-path startup issue; no sandbox disabling or skipped case is used.

The 16 Select cases are the two publicly identified failing files from #1773. They now pass on the integrated main containing #1770 and #1773. The other six paths in #1773's historical eight-file comparison were not publicly specified, so this record does not invent an eight-file rerun.

Two representative successful Base/React and Shadcn/React captures were inspected. They show the deliberately minimal source fixture, not production presentation parity. Browser/DOM/AX observations do not establish physical-device or OS assistive-technology acceptance.

## Evidence and remaining scope

The adjacent [evidence directory](evidence/2026-11-24-tooltip-consumer-view-readiness/) retains the original failure, the five original-case diagnostics, the timing observations, source inventories, candidate report, selected captures, runner sources and independent review. Its manifest binds every retained file by size and SHA-256. These are explicitly selected public repository fixtures and owned execution receipts; no unrelated device directory is included.

The implementation is authored and signed by Codex. The independent agent review is technical evidence, not a GitHub approval. Normal hooks, exact committed-byte readback and ordinary platform review/CI are recorded separately when performed. This bounded test repair does not close the complete Sprint 3 profile, the fifteen-stage release rehearsal, strict package-budget overruns, or all seven Sprints.

Related: #1770, #1773, #1743, #1455.
