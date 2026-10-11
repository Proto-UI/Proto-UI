# DataTable HeaderRow static entry integration

Date: 2026-10-10 UTC.

## Source boundary

This append is based on the frozen 45-step candidate tree `ebe17788fc6ecf83cab342b7e55456896e382daf`, itself prepared on published commit `fabf2d2b2e971060243e3843df7dde91d27e4440`. Those are distinct tree and commit identities. The original candidate is unchanged.

The reviewed source slice is the independent staged tree `7d6048d78969107e9c4b00774b32d5789ddbadad`, with its patch SHA-256 `beb49221149aa3ab3af0d261d19cbe502a53933c4673e89be0f063a08c4f2535`. Its 36-file patch applies without a conflict on the frozen candidate. This integration preserves its passive HeaderRow semantics, draft P/T, legacy dynamic `DataTableRow.header` behavior and documented direct-Trigger branching restriction. The source record and manifest next to this record retain the implementation evidence and limits.

## Static surfaces

- Each of the five package-root indexes already exports its `data-table` subpath through a wildcard. The new regression imports both real surfaces and verifies the HeaderRow export is the same object; no redundant root export is added.
- Each existing source-only DataTable CLI entry adds its actual `dataTableHeaderRow` part with its family-specific facade names and element identity. No new subpath or public/stable CLI admission is introduced.
- The Previewer receives five explicit literal loaders. Each imports the real family subpath and registers the exact HeaderRow export, using the existing registry path without fallback registration.
- The five authored DataTable DemoSpecs use the new identity. The integration test verifies their source paths against the implementation manifest, traverses all declared prototype dependencies, and loads them through the actual Previewer entry point.
- Normal style-preset generation and checking both pass. This HeaderRow reuses existing static row tokens; the generated Shadcn, Brutalist and draft-family resources are byte-identical to the preceding candidate. No parser, Rule/capture interpretation, Compiler, Runtime or Focus change accompanies the append.

## Reproduction and local evidence

Before the shared entries were added, the new 10-case integration suite failed all ten cases: the five CLI entries lacked the part, and the five migrated demos could not load the new prototype IDs. The unchanged assertions pass after the static wiring.

For every family, the actual website `loadDemo` and `renderDemo` WC path mounts two sorting headers in the same passive structural row, observes a valid four-row/two-column table with three data slots, and verifies the header container is outside the Tab and selection policies. Pointer sorting and Enter sorting each emit one request, reorder the real records, and do not request row selection. Destruction empties the host; a second real mount repeats the journey. This is 10/10 local Happy-DOM entry/interaction evidence, not a browser screenshot or native accessibility result. The source owner's separate 55-case run remains attributed to its original staged tree.

The first complete catalog check exposed five additional errors: the new T entity did not list the five HeaderRow prototypes it exercises, although their criteria and verifies relations were present. The append adds only those five accurate `exercises` edges and retains the failed log. No case, criterion or status is changed.

The append packet records the final integration tree, exact command lines, exit statuses and log hashes for the wider regression and type checks. Historical tests retain their original source identities. The existing eight Form/CheckboxGroup selector failures, aggregate catalog/public-doc debt and unresolved official CI findings are not waived by this bounded DataTable fix.

## Publication and acceptance

This work is handed off as a staged tree and patch, without a direct local commit that bypasses the supported publisher's authentication gate. The authorized publisher must bind the eventual actual source commit and final current proof. No remote CI, screenshot, packed-package, Compiler, GPUI/native or complete DataTable acceptance is claimed. The delivery score and all five historical closeouts remain unchanged.

Agent: dot

ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)

This role declaration is not authenticated model identity, permission, independent review, or acceptance.
