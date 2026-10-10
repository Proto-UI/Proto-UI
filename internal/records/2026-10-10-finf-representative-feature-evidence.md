# Representative Finf feature image pipeline

This is a source checkpoint, not a screenshot or full visual acceptance result.

## Scope

The official workflow captures the actual Shadcn Form, Calendar and Drawer documentation demos through the React Web projection. It edits and resets a Form editor, selects a Calendar date, and opens and snaps Drawer through its accessible handle. Each PNG has a sidecar binding the checked-out commit, Git tree, route, runtime, viewport, observed state and PNG SHA-256.

The workflow retains normal frozen dependency installation and the preset manifest check. It reuses the existing documentation server harness and installed Chrome, keeps Chromium sandboxing enabled, and prevents test-page HTTP requests outside the local documentation origin. It does not request local native execution or use a sandbox bypass.

## Validation and boundary

- Workspace TypeScript check passed after adding the test.
- Source review matched current demo refs, labels, fixed Calendar dates and Drawer snap points.
- Native browser execution and actual images are pending official CI on the published commit. No older screenshot or synthetic rendering substitutes for that evidence.
- Browser failures preserve real failure screenshots when available, page error logs, and exact source identities. An empty artifact or failed build is not a successful visual check.
- Three component journeys cover neither all families nor all Adapters, native backends or complete Finf acceptance.

The actual 8989403 baseline failed the preset manifest gate before browser startup. The adjacent proper-generator repair addresses that source-generation failure; this record does not retroactively declare that run successful.
