# Consumer 02 — Save a preference: final report

## Outcome and evidence

The requested preferences page is implemented, production-built and independently observed working through all nine checkpoints on sandboxed Chromium 145.0.7632.6. The operator result is **passed** with zero recorded runtime errors. The participant reviewed all nine original screenshots, matching accessibility snapshots and result data. No source or production output changed after browser observation.

The production browser ran from 2026-11-23T20:46:26.281Z to 2026-11-23T20:46:32.555Z. Root's copied receipt records arrival at 2026-11-23T20:51:17.244973+00:00. This participant's feedback receipt was recorded at **2026-11-23T21:00:56.652435+00:00**, using the original Linux monotonic release clock; it was not backdated to the browser run. The original release is 2026-11-23T20:25:42.838254+00:00. Exact ship completion and final clock values are in measurement/events.json, measurement/received.jsonl and measurement/clock.json after closure. Operator, transport and resumption waiting remain included.

## Actual production observations

| Checkpoint | Actual result |
| --- | --- |
| Initial | Button role and accessible name Save preferences were present; action used the intended indigo treatment. |
| Pending | The action and form controls were disabled while Saving preferences… was displayed. The action background changed to rgb(220, 225, 238), with readable muted text. |
| Pointer and repeated activation | Pointer preference saved successfully. The operator's repeated activation during the pending interval produced only one recorded storage write for that attempt. |
| Keyboard focus | Keyboard focus reached the action; focused=true and a solid 3px outline were captured. Visual review confirmed the gold ring. |
| Enter | Enter preference saved and appeared in the field, status and saved-name area. |
| Space | Space preference saved and appeared in the field, status and saved-name area. |
| Injected error and recovery | The deliberate storage error produced a visible alert. Controls re-enabled; Space preference remained the saved name; the failed attempt produced no new successful storage write. |
| Later retry | Clearing the exercise checkbox allowed Recovered preference to save; the error disappeared. |
| Reload | Recovered preference remained in the field and saved-name area after reloading. |

The result records four successful writes before reload: Pointer preference, Enter preference, Space preference and Recovered preference. The failed attempt did not add a write. CSS and JavaScript served hashes match the operator's disk hashes and this packet's production files. A read-only preservation check also confirmed that all four dist files match their original handoff hashes, the app source matches its immutable snapshots, and package.json/package-lock.json are unchanged.

## How activation, saving and disabled state connect

The app imports GeneratedButton from ./generated/Component, using the entire copied local distribution including its hidden helper directories. The stable text child Save preferences supplies the action's accessible name. Its onClick calls the application's async handleSave function, so pointer and keyboard activation continue through the supplied component's existing implementation.

handleSave checks saveInFlight.current, then sets it immediately. This ref closes the interval before React commits the new disabled prop, preventing overlapping calls from starting the same in-flight operation twice. isSaving is the rendered state: it is passed to GeneratedButton's disabled prop, marks the surrounding region busy and disables the name field and exercise checkbox while the captured values are saving. The original savePreferences implementation and its approximately 600ms delay were retained unchanged.

The handler awaits savePreferences. On success it uses the actual returned, trimmed display name to update the input, saved-name area and status. The provided storage function writes localStorage, and app initialization calls readPreferences so the saved value survives reload. On error the handler keeps the last successfully saved name, displays the actual error in an alert and reports that retry is possible. finally clears both the ref and rendered busy state on success or failure. The guard prevents overlap; a deliberate later activation after completion is allowed to save again.

## Customization, source ownership and escape-hatch facts

USAGE.md describes an editable local-source distribution and ordinary consumer styling. It did not document a className forwarding API. Targeted inspection of the supplied Component.tsx showed that className was excluded from prop resolution, but not typed or forwarded to the host. I added the optional className prop and forwarded it onto the physical root, enabling the app's preference-save class. This is the small requested consumer-owned generated-source edit. Its original bytes, edited bytes and unified diff are retained under evidence/snapshots/07-component-classname-*.

Consumer CSS supplies the action color, pointer affordance, visible focus ring and disabled treatment for both aria-disabled and native disabled states. The supplied activation, keyboard, focus and disabled implementation was not replaced. The app's concurrency guard protects the save operation in addition to the component's disabled state. No substitute button, synthetic activation path, hidden internal onboarding or dependency bypass was used.

Editing generated source makes the original compiler map historical. The original map and provenance bytes remain unchanged; the live sourceMappingURL reference was removed from edited Component.tsx. The production command emits a fresh consumer sourcemap, whose sourcesContent was verified to contain the current edited component bytes. Only Component.tsx differs from the distributed generated directory.

## Installation, build and unsuccessful attempts

npm ci --ignore-scripts --no-audit --no-fund installed the supplied exact dependencies successfully. The package and lockfile were not changed. Stage type checks passed, and npm run build -- --sourcemap exited 0, producing index.html, CSS, JavaScript and the JavaScript map. The actual build receipt is measurement/commands/build-01.json.

The first Vite preview child failed with uv_interface_addresses returned Unknown system error 1. Its spawn wrapper exited 0 because spawning completed; this was not treated as a working-server result, and the child's eventual exit code was unavailable. The actual failure log and the following HTTP connection-refused command with exit 1 are retained. A Python static server then served the production index with HTTP 200, with bytes matching dist/index.html. The independent operator subsequently served and observed the same production asset bytes in Chromium. No local-browser attempt or local-browser pass is claimed.

The difficulty attributable to the distribution was the brief styling guidance: source inspection was needed to establish the actual host customization hook. The runtime installation used existing pins without changes. The preview-server failure was an environment serving issue; the injected storage error was the starter exercise control. These distinctions are retained without treating either as an unsupported component defect.

## Experience, consulted material and limits

This participant is an AI agent with general React, TypeScript, CSS, asynchronous-state and web-accessibility knowledge. It has no prior hands-on use of this supplied distribution in the available task context and no claim of personal professional experience. The user context identified Proto-UI by name; no internal project docs, producer sources, other consumers or evaluator scripts were inspected. Ordinary supplied files and this participant's own project/evidence were sufficient; no public external documentation was consulted. The concrete information gap and ordinary-source resolution are recorded in the customize stage.

Provider snapshot, seed, token counts, billing and cost remain **null**, with reasons in evidence/experience.json; no authoritative values were exposed. No preference for this distribution, comparative score or unobserved success metric is inferred from completing the task.

The admitted behavior is bounded to this original preferences task and the independently observed sandboxed Chromium 145.0.7632.6 journey. The evidence does not claim assistive-technology testing, other browser/host behavior, or validation of a released registry package. Screenshot review supports the captured visual states; it does not expand those behavioral bounds.

## Deliverables

- Application source: project/src/App.tsx and project/src/style.css.
- Consumer-owned component and retained support files: project/src/generated/.
- Untouched starter: initial-project/; ordinary original distribution: distribution/.
- Production output: project/dist/, with every shipped file and hash retained in evidence/production-manifest-01.json.
- Actual commands, stdout/stderr and unsuccessful attempts: measurement/commands/.
- Actual monotonic events and completion clock: measurement/events.json, measurement/received.jsonl, measurement/release.json and measurement/clock.json.
- Immutable source preimages, edited bytes and diffs: evidence/snapshots/.
- Original production screenshots, accessibility snapshots, trace and operator result/command receipt: operator-feedback/.
- Screenshot review: evidence/production-visual-review-01.md.
- Asset/source binding check: evidence/production-feedback-binding-01.json.
- Experience and unavailable metric reasons: evidence/experience.json.
- Consulted materials: evidence/consulted-materials.txt and evidence/consulted-materials-final.json.
- Initial explanation and handoff remain retained; this report records the final actual observations without rewriting those earlier snapshots.
