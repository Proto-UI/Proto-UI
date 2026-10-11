# Finf prior-pr.855: close the bounded material geometry repair

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Independent read-only verdict

Approve item 62, **prior-pr.855**, at revision `8989403a6d3668948c7394f4a370d8269ba1a6ec`. The [original PR](https://github.com/Proto-UI/Proto-UI/pull/855) repairs padding-box sampling/canvas geometry, border-only invalidation, incompatible composed blending and recovery, including the bounded floating-point edge-crop regression. Its source head `60c0bdeb17e5cdc3404512d66b33d0956fb392f1` is an ancestor of the reviewed revision. This is a private finite material-profile repair, not general CSS rendering, optical-quality certification, a completed Liquid Card, native/Vulkan parity or lifecycle promotion.

## Exact current evidence

[Material source specialization run 38035138324](https://github.com/Proto-UI/Proto-UI/actions/runs/38035138324/job/114163902189) checks out actual 8989403, passes 187 controls across 12 files, and successfully runs both the workspace-source fixture and the built-package-artifact fixture. Both browser results bind that exact revision and report **32 observations, zero errors and zero external requests**.

[Artifact 11662619910](https://github.com/Proto-UI/Proto-UI/actions/runs/38035138324/artifacts/11662619910) was downloaded through the connected artifact tool. Its ZIP SHA256 is `c8b1fa54ee0ac5f78fa0dc86b4d77db28be6266a196ca84b862fcca3f44f7cc1`, matching GitHub's digest. All **46 source/packed PNG pairs are byte-identical**. Both source manifests identify revision 8989403, shader `88f681ab7035fd55b04f63edff1841e32c4199e9`, and the declared `regular-readable-v3` profile. Their nested `source.execution` field retains the fixture-build label `pending-browser-evidence`; actual completion is established by the enclosing result status, finished official commands, assertions and retained frames, not by treating that build label as an execution receipt.

The reviewer read the real browser assertions at this source and inspected original pixels for the six frames below:

- `12h-ancestor-blend-unavailable`: non-normal ancestor blend withdraws enhanced pixels; the assertion requires the canvas data to be `data:,`. Result reports unavailable, not a false rendered success.
- `12i-ancestor-blend-restored`: restoring normal composition restores rendered enhanced material.
- `12j-uniform-border-padding-frame`: a 200 × 80 border-box host with 17 px padding and 2 px borders produces a 196 × 76 canvas, inner radius 18, correct backing extent, GL sampling bounds and native border color.
- `12k-border-only-invalidation`: changing only the border to 4 px produces 192 × 72 and radius 16 without changing source generation. The visual retains the actual border rather than drawing over it.
- `12l-asymmetric-square-border`: 1/3/5/7 px borders with square corners produce 190 × 74 and radius zero; native border and source/canvas geometry remain aligned.
- `12m-incompatible-inner-corners`: adding the incompatible inner-radius profile yields the declared opaque `geometry-unavailable` fallback, not a fabricated enhanced rendering.

The subsequent `12n-border-context-restored` observation returns to enhanced material and radius 24. Its completion, the source-generation assertions, full-source/packed result status and pixel-pair identity are independently checked. The original finite geometry and recovery tests remain in the source. No browser, shader or third-party code was executed by this reviewer; this review inspected the official execution and downloaded evidence.

The next locally frozen source `2f77255f9c5391a2dde8cf25b19392fb085cdcbc` does not change the material-specializer experiment or base material implementation/test scope. This is a narrow unchanged-source observation, not a claim that the next source was published or that all of its dependencies received new native acceptance.

## Boundary and publication

No applicable defect remains in the original padding-box/border/composed-blend repair. Other current Liquid Card, optical-first-frame or broader Finf failures retain their own criteria and evidence; they do not silently enlarge this original narrow task. Current package overages also remain unchanged.

This local independent technical verdict is not a submitted GitHub review or merge approval. Record and one-row ledger publication are pending. Retain this record at an immutable commit before inserting its real URL into the closeout. Do not replace or relabel the 8989403 screenshots as a later commit.
