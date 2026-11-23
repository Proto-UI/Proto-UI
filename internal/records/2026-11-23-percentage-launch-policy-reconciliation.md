# Percentage native observer launch policy reconciliation

## Scope and source

The observer at integration source `47584d31be1bd30bfd2ce46565dc81062983819f` contained an added environment-controlled launch-argument override. Remove that override and use the same explicit `{ executablePath, headless: true }` options as the existing Shadow S3/S4 native entry points. Record the actual browser command through the read-only CDP `Browser.getBrowserCommandLine` request. Playwright still owns its default launch arguments; this does not claim that the operating-system browser sandbox is enabled.

The corrected script is the exact 17,964-byte observer independently run in percentage attempt 03: SHA-256 `14614457e7d8c0e8ce7a1ff68ef66dde9bfbd34979d62f9a64beee1f6484e9ab`. Its previously created local contribution was `139f15982b641a0dcda18724634e21bf4dddb244`. That original Git object is unavailable in this recovered checkout, so this is an explicitly attributed new commit of the verified bytes, not a reconstructed claim to the original commit identity.

## Evidence boundary

This change preserves every matrix, animation, reversal, lifecycle and negative control assertion and its original time budget. It adds no product behavior. Earlier attempts 01 and 02 used the added override and remain diagnostic history, including their actual failures and passing counts. They do not establish native acceptance under the original repository launch configuration.

The separately executed attempt 03 used the corrected observer and failed: geometry 54/54, animation 15/16, lifecycle 9/9, no page errors. Its sole reported failure is expression 1, width 32, LTR, Light profile: real intermediate movement. No claim of complete native percentage acceptance follows from these counts. The [complete raw attempt 03 archive](evidence/2026-11-23-percentage-normal-native/commands-and-output.tar.gz) and [manifest](evidence/2026-11-23-percentage-normal-native/manifest.json) retain the observer, execution wrapper, actual start/exit receipts, all raw frames, PNG, failure analysis and the eight frozen public-producer inputs. All 18 payloads were independently rehashed during integration. Read this with its exact producer identity; it is not a native rerun of the current integration head. Native T acceptance remains open.

Only syntax and formatting are checked in this recovery commit. Original native deadlines, framework defaults, and Sprint completion criteria are unchanged.
