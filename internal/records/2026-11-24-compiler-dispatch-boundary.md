# Compiler dispatch boundaries and exact-once Scroll evidence

## Integrated failures

The compiler wrapper has two separate reusable inputs, adapter_acceptance and browser_acceptance. Both are optional booleans with false defaults. The browser job requires explicit browser_acceptance. Package-budget and Website evidence remain manual-only. The scheduling test helper still expected only Adapter.

The hosted scheduling controls reported 24 passed / 7 failed at run 45216958587, job 137840587774, head d9958d163436ea08d4a19b325d9e7f5dad3dc951. A local run reproduces that same result. After repairing the exact input assertion, the controls expose a second integration error: 30 passed / 1 failed because the workflow contains two identical unconditional invocations of both scroll_pause and scroll_reader, including identical Cargo flags and output log paths.

## Repair

The test now requires exactly the two existing default-off inputs. Every original mutation remains. Additional controls reject a missing browser input, default-on execution, a required input, a non-boolean type, and an unknown input. No manual-only input becomes reusable.

The workflow removes only the second identical pair of Scroll steps. It retains one complete, unconditional, locked invocation of each original native target, with its original toolchain, manifest, feature flags, serial test arguments, failure propagation and retained log. The original exactly-one assertion remains unchanged. Dedicated duplicate-pause and duplicate-reader controls now exercise that rejection directly.

## Validation and evidence boundary

The complete scheduling-control file passes 31/31 with zero skips, and the separate repository scheduling audit passes. The manifest binds the prepared base, original/candidate test and workflow hashes, original hosted output, 24/7 local red, 30/1 intermediate red, final 31/31 green, exact commands and lossless archived logs. These are orchestration and rejection controls, not claims of executing the native Scroll targets or full release acceptance.

An independent review compared both repeated workflow blocks byte-for-byte and confirmed their identical owner, command, flags, destination and conditions. The technical source review does not replace GitHub approval.
