# Matrix shared startup workflow triggers

Date: 2026-10-08. Base: `305ced3afb6b6e3127dee8c0f16859ee8661615b`.

The dedicated Matrix startup diagnostic omitted two real dependencies from its pull-request path filter. The Matrix browser suite imports `browser-harness.ts`; that harness imports `scripts/test/server-readiness.mjs`. A change confined to either file therefore did not request the dedicated profile/artifact even though it could change startup behavior. The ordinary browser suite is not an equivalent diagnostic artifact run.

The workflow now includes exactly those two paths. The focused test checks both actual import statements, both registered trigger paths, and removal controls for each path. Its baseline failed the two added cases and passed fifteen existing cases. The repaired diagnostic and observation suites pass 25/25. Workflow profile mode, original Matrix behavior assertions, timing, case selection and evidence destination are unchanged. This does not establish hosted scheduling, native execution or a passing full Matrix run. No remote write is included; independent review and integration remain pending.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
