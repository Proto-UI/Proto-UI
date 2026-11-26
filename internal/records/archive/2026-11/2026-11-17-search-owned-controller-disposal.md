# Documentation Search owned-controller disposal

## Why this repair belongs to the documentation owner

Issue #1488-E identifies an error-path leak in
`initDocumentationSearchCommands`, confirmed on
`bf8b1f55f93a89f3c689276d6e339d83891f4dba`. Documentation Search creates an
opener projection controller and, on the first open, an independent Dialog
projection controller. Its previous destroy method awaited the opener first.
An opener rejection skipped the Dialog destroy call, leaving that controller's
active or pending generation outside the teardown. The `alive` guard also let
repeated callers finish before pending disposal and lose its eventual failure.

The underlying projection controller already waits for its owned candidates,
shares an in-progress destroy promise, and propagates the first rejected
outcome. The missing coordination is in the documentation Search owner. The
repair does not change the materializer, the controller primitive, the Homepage
page transaction, or the independent Search data/session owner.

The existing draft `T-HOST-PROTOTYPE-PROJECTION-SCOPE-0001` cases
`CASE-TEARDOWN-AWAIT` and `CASE-EXHAUSTIVE-TEARDOWN` describe the relevant
ownership expectations. This record adds bounded implementation evidence; it
does not promote the draft lifecycle or claim complete contract acceptance.

## Teardown and error policy

The documentation owner starts both owned controller destructions and waits for
all their outcomes. One rejected controller cannot prevent the other from
revoking its leases. It then waits for any still-pending retired controllers,
as before, and throws the first active-controller rejection in stable
opener-then-Dialog order. The rejection value is passed through unchanged,
including `undefined`. No new `AggregateError` or error-priority policy is
introduced.

Retired-controller cleanup retains its existing independent error logging and
`allSettled` treatment. This repair does not add a retired error to the public
destroy result or replace the original active-controller failure with it.

Repeated calls receive the same teardown promise, including its pending state
and final rejection. The real projection controller queues candidate disposal
in a microtask, so a candidate callback that reenters this wrapper observes its
already-cached promise. The regression observes the actual callback boundary;
it does not replace the controller with an artificial synchronous disposer or
make a disposer await its own completion.

## Focused reproduction and validation

`site-search-commands.disposal.test.ts` keeps the real participant, session,
public composition, projection controllers, materializer, loaders, and WC
Adapter. Only the Pagefind resource boundary is replaced. Explicit theme
values on the real reader scopes follow the existing Happy DOM public-mode
fixture; no generated stylesheet is borrowed or substituted.

Failure injection wraps the actual candidate disposer and rejects only after
that disposer completes. A separate gate holds delivery of an already-created
real Dialog candidate to its controller. The pending test observes one event
loop turn with that gate closed, then releases it and checks that the generation
is disposed without activation. The gate and injected error are fixture facts;
candidate activation, cleanup calls, connected hosts and generation surfaces,
retained surface references, and listener unsubscription are observations.

The ten cases cover an unstarted Dialog, an active Dialog, pending Dialog
materialization, concurrent and later repeated destroy, opener-only and
Dialog-only failures, simultaneous failures, an `undefined` rejection, and
successful controls. A callback-reentry control retains the nested destroy
promise for an outside observer and verifies the same pending state, promise,
and original failure. The teardown assertions also exercise later open and
preference events, and preserve the separate data owner's resource lease.

On the unchanged production source, the actual first run collected nine cases:
two passed and seven failed. Three active opener-failure cases observed zero
Dialog disposer calls. Two cases observed a repeated call fulfilling instead
of preserving rejection. With the Dialog gate still closed, an opener failure
let both callers finish; without that failure, the repeated caller alone
finished early. There were no setup failures, skipped cases, or unhandled
rejections in this run.

After the owner repair, the exact same nine-case test bytes passed. Independent
review then requested the reentry control. Its first attempt incorrectly
assumed the candidate callback had executed before the outer `destroy`
returned; that failed precondition was retained as a fixture error, not a
product reproduction. The correction waits for an explicit callback-reached
signal from the real disposer. It adds no controller double or timing grace.

The corrected ten-case fixture was then run on the unchanged `bf8b1f55`
production source: two cases passed and eight failed. The added reentry case
observed both promises completing while the real Dialog gate was still closed.
The exact same ten-case fixture passed on the final candidate. Its SHA-256 in
both runs was
`9f5af06f14f109841469a20806a0e211e0c7a9ac7fac2165ea4b11ef98023085`.
The final candidate production-source SHA-256 was
`7fa9135a6c446af8a8f9b4af9d585c80e85c210d831c429873e12f4dc6b67bf3`.

The focused command, with a JSON reporter added when retaining the raw
receipts, was:

```sh
corepack pnpm@10.32.1 exec vitest run --maxWorkers=1 --minWorkers=1 --no-file-parallelism apps/www/src/components/site-search-commands.disposal.test.ts
```

The final candidate also passed the eight existing
`site-search-commands.test.ts` cases and six
`site-search-commands.theme-lease.test.ts` cases in the same single-worker run:
24/24 total, zero skipped, zero unhandled rejections, exit 0.

An earlier affected run also included `site-search-commands.public-mode.test.ts`.
Its 48 assertions passed, but the process exited 1 with three unhandled
rejections: `[AdapterHost] cannot invoke an exposed callable after terminal
disposal`, through `input-shell/bind-control.ts`'s `retire`/`dispose` path during
Vue2 replacement. This is not a passing integration result. A controlled
comparison using the unchanged `bf8b1f55` production source and the two implicated
existing public-mode cases reproduced the same three rejection stacks (two
assertions passed, 32 cases not selected, exit 1). The error remains an
independent InputShell/Adapter lifetime issue; this repair neither suppresses
it nor claims all public-mode integration passed.

## Completion boundary

This completes the bounded local repair and focused failure-to-pass evidence
for the documentation owner. Independent review and integration remain separate
steps. These Happy DOM results do not establish native-browser portal timing,
four-host browser acceptance, Search performance, or a complete current CI
cycle. The existing Search readiness/performance deadline, including the
1000 ms browser assertion, is unchanged.
