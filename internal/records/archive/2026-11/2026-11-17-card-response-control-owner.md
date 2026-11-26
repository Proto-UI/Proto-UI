# Card response controls own their complete HTTP chain

## Observed failure

The scheduled native run on `bf8b1f55f93a89f3c689276d6e339d83891f4dba` completed the original 18-case Liquid Card producer with **15 passed / 3 failed**. The failed controls were `success`, `http-error`, and `request-abort`; the other three response controls and twelve Card cases passed in that run.

The [actual job](https://github.com/Proto-UI/Proto-UI/actions/runs/44038705347/job/133895795460) and [native artifact](https://github.com/Proto-UI/Proto-UI/actions/runs/44038705347/artifacts/14309676349) bind the negative observation to the current source. Its first owned `301` response pointed at the next control URL. That successor reached Astro, which returned a locale `302` and then a 521,756-byte HTML `404`. The expected font, 20-byte error body, and terminal request failure were never reached. Browser route fulfillment did not own the subsequent HTTP requests.

The source file at that head has Git blob `b8e0a66eb4fa2781c5bac49a63fe11f3594cefc6` and SHA-256 `c03297e0bab6d4b5c4eabe16747566ddcab53442d88ddb9aa70813032d9e4aff`. This is a fresh implementation after the previous temporary workspace was lost; it does not claim that an earlier local candidate survived or was integrated.

## Bounded repair

Each of the six existing controls creates a real Node HTTP server on an ephemeral `127.0.0.1` port. That server owns the index, all five `301 / 302 / 303 / 307 / 308` redirect responses, and the terminal font, HTTP error, or socket abort. The three malformed/unknown redirect arms retain their original status and Location inputs. The browser route retains its origin/path guard and continues owned requests to that server. No product or Astro route is added.

The server starts only after the browser context exists. A nested `finally` closes the server and its connections even if context cleanup throws. Unknown paths and invalid step indices close the response instead of escaping to Astro.

The response collector, all original six-control assertions, the other twelve cases, the global hooks, and the 30-second control deadlines remain unchanged. The existing checks still require actual reciprocal Playwright Request identities, no redirect body reads, the complete successful chain and font hash, and explicit failure evidence for every negative arm.

## Evidence boundary

The focused transport probe executes the candidate's actual server function, extracted through the TypeScript AST. Real Node HTTP clients observed all six arms: the exact five-hop success and HTTP-error chains, the original font bytes and hash, a terminal `ECONNRESET`, and the unchanged missing/invalid Location and unknown-status responses. Each server's port refused new connections after cleanup. A second real Node `fetch` client confirmed automatic redirect following and the expected terminal results. These are transport observations, not browser Request identity or collector acceptance.

Byte comparisons against the exact main source verified the unchanged collector, global hooks, twelve other cases, original six-arm list, and complete assertion block. Full-file syntax parsing and strict TypeScript checking of the extracted HTTP owner produced no diagnostics. The initial formatting check found only new helper layout and record wrapping; those were corrected before the final source freeze. The receipt retains that initial failure separately from the final check.

The focused command is `node /workspace/scratch/8077f6e9f3a8/native-card-repair-20261117/http-owner-probe.mjs`. Its report and source-preservation hashes are retained with the candidate's local manifest. No full workspace type check or native browser run is represented by that command.

The current machine's normal Chromium sandbox fails before any browser journey with `EPERM`. No sandbox setting was weakened, and no candidate native pass is claimed. The unchanged original six controls, followed by their containing 18-case suite, still require a usable native runner on the exact candidate. The current main's 15/3 result remains the negative baseline until that evidence exists.

This fixture repair does not establish optical acceptance, production redirect provenance, or completion of unrelated website acceptance work.
