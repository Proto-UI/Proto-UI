# Demo Matrix projection observation boundary

The validation-only material/Focus composition at `23f11b4301627bc374dfdc4599695885c7a6e866` failed one browser assertion: Brutalist Textarea produced two accessible-control signatures across the four adapters. The other 199 browser cases passed. [Original CI](https://github.com/Proto-UI/Proto-UI/actions/runs/37285445572) remains failed evidence.

Diagnostic-only `ccd01fbf3820556c34675fd1b2a3b691a5748ac2` preserved that assertion and recorded the signatures. Its [CI](https://github.com/Proto-UI/Proto-UI/actions/runs/37290474427) passed 3,079 non-browser and 200 browser tests; all four Textarea signatures were identical. This did not establish a fix or a unique cause for the earlier failure.

An independent bounded happy-dom probe then ran the actual projected client, materializer, renderer, Brutalist demo and four adapters. It substituted installed framework loaders, controlled animation-frame delivery and injected non-zero geometry. Five cases passed:

- The previous child-count wait accepted all four skeletons before their demo loaders resolved.
- It also accepted a connected React staging generation before demo setup. That generation was loading, inert, aria-hidden and opacity zero, but the previous reader counted its textbox before label and helper-button setup.
- After ready publication and activation, all four adapter signatures agreed.
- Removing a button role after readiness kept readiness true and made the original parity assertion fail.
- Projected completion events respected error, replacement and disposal boundaries. The separate legacy mounted event was not adopted as a success signal.

The sampler now uses the existing fixed-projection ready state and active generation, and excludes explicitly staged generations from interactive observations. It does not wait for signature agreement or change timeouts, accessible-name rules, ordered signature comparison, the unnamed-control assertion, or the `<= 1` parity assertion. Rendered errors still reach the existing error assertion. Legacy host behavior is preserved.

Six permanent observation tests cover skeletons, staging, both required readiness facts, staged controls beside an active tree, a missing active button role, an incorrect active accessible name, rendered errors and legacy hosts. Together with projected-client and materializer tests, 31 focused tests passed. Geometry in these unit tests is injected; they do not claim native paint or hit-testing verification. Fresh native CI must validate the repaired sampler.

This establishes a general observation defect, not the unique historical cause of the original CI mismatch. No Runtime, Adapter, Prototype or package-budget implementation changes are included. PR #826 remains validation-only and must not merge. Its product vector still includes Focus `75a9f16df8d5111839c1833a1323e8137f8f47c8`; later Focus repairs require a new composition and measurement.
