# Final bounded repair union validation

Validation-only PR #826 preserves its d5080fc2 history and normally combines Focus/Text Control 20717674, material repair fe21e418, and the independently reviewed numeric proposal 5eb9c545. PR #826 must never merge.

The only product merge conflict captures the existing viewVersion in attachView. Newer exception-safe detach/dispose and generation-based rollback are both preserved. The complete 17-file source delta and the nine-file increment over the prior measured union were independently checked against their source owners. The two numeric files match #824 byte for byte. An actual merge-tree computation produces the same d142890e pre-record tree as the staged integration.

Independent targeted tests pass 84/84. The 44-package build, full types (455 files, zero errors/warnings, four hints), and general suite (4531 tests across 660 passing files; 34 existing todos and three skipped files) pass. Build/types completed before general tests to avoid shared-output races. These are local checks, not native-browser or canonical CI acceptance.

The full union directly measures Runtime 69072, React 91029, Vue 90794, and WC 99919 gzip bytes. The prior React 91000 gate fails by 29 bytes. Separate #824 raises only that ceiling to 91029 with no added margin; all other caps and algorithms remain unchanged. Every one of the eleven artifact hashes, minified sizes and gzip sizes is identical before and after numerical integration, and all nine gates pass. The old failure and earlier 207 + 6a four-byte excess remain preserved in the separate numeric receipt. No source correctness was removed or compressed delta added to estimate the result.

The companion measurement JSON binds the exact parents, frozen trees, toolchain and complete artifact data. Exact-head canonical CI, native browser coverage, rendered material artifact inspection and external review remain pending at publication. This record does not grant review approval or main integration.
