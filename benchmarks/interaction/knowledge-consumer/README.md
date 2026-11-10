# Interaction knowledge consumer

Use the repository-owned [interaction knowledge skill](SKILL.md) to choose a target library or implement a primitive from explicitly sourced knowledge. This experimental 0.4 consumer slice tracks [Issue #734](https://github.com/Proto-UI/Proto-UI/issues/734); its November 6 deferral remains in force. It does not gate the 0.3 release.

The [clean project](example/) implements the public Tabs task using React 18.3.1, react-dom 18.3.1 and `@radix-ui/react-tabs` 1.1.13. A mature library fits this target, so the example uses its public API rather than rebuilding Tabs. Vite 6.4.1 bundles the project; Playwright Core 1.58.2 supplies the separate consumer observation command. No Proto package, compiler, Adapter, workspace alias or home skill is needed.

The source is authored and **unrun**. No clean install, build, browser journey, model task, cost comparison or visual result is claimed. Exact direct pins are present; the execution operator must produce and retain a transitive lock before measuring any task. The example is a reference recipe, never an already-completed timed participant run.

## Read and use the workflow

Start at [SKILL.md](SKILL.md), inspect [source identities and limits](sources.json), and use [knowledge.md](knowledge.md) only with its draft lifecycle. The existing historical calibration excerpt stays unchanged; this directory's projection is separately bound to `0607c6c5c386b8a932ab850e92a8873b2121dc45`.

[task.txt](task.txt) supplies the ordinary request for all three study paths. It preserves the existing public Tabs requirements and explicitly adds the same application action-count extension and target constraints to each path. [study.json](study.json) records proposed conditions and exact input hashes. [protocol.md](protocol.md) defines admission, measurements, interpretation and feedback. [acceptance.json](acceptance.json) retains all ten original source keys and their unfinished conditions.

This directory is a product entry read directly by a consumer. It is not registered as a contributor/governance skill and does not install anything into a user's home. A discoverability link for the existing benchmark README is supplied separately for Main's shared-path integration.

## Run the clean project

The following commands are execution instructions, not results. Use Node 24 and a new destination outside the monorepo. Run installation, build and browser work serially under Main's portfolio slot.

```sh
cp -R benchmarks/interaction/knowledge-consumer/example /tmp/knowledge-consumer-tabs
cd /tmp/knowledge-consumer-tabs
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run preview -- --port 4734
```

Retain the actual Node/npm versions, generated `package-lock.json`, installed dependency inventory, source hashes and command outcomes. Reuse the frozen lock for every comparable cell. The first lock resolution is setup, not measured participant implementation. The standalone package has no dependency on repository `node_modules`; a fresh copy and independent install are part of the consumer claim.

In a second terminal at that clean project, use an existing Chromium executable. No browser download is required by this example.

```sh
CHROME_PATH=/usr/bin/chromium timeout --kill-after=10s 120s npm run check:consumer -- --url http://127.0.0.1:4734 --out /tmp/knowledge-consumer-wide-light
CHROME_PATH=/usr/bin/chromium timeout --kill-after=10s 120s npm run check:consumer -- --url http://127.0.0.1:4734 --out /tmp/knowledge-consumer-narrow-dark --viewport narrow --color-scheme dark
```

Each invocation requires a new output directory. A normal successful journey runs **22 named checks** and retains source bytes/hashes, runtime errors, a browser version, HTML, accessible-role snapshots, focus/selection facts, four PNG captures and a trace. Rejected setup may have no final report; a timeout can leave `start.json` and partial evidence. Preserve those attempts. A report's `passed` outcome describes only this finite public recipe journey; it is neither independent oracle approval nor a benchmark value finding.

The checker is a documented public development consumer, not part of the central browser-suite inventory. Do not admit it as a hidden oracle merely by moving its file. An operator may adapt the same independently reviewed expectations to generated pages, but the existing benchmark remains calibration-only and has no admitted real-model executor.

## Inspect interaction and rendering

Open `http://127.0.0.1:4734`. Tab into **Overview**. Press Right: focus moves to **Details**, **Overview** stays selected and its panel stays visible. Enter activates **Details**. Traverse both wrapping directions, Home/End, Enter/Space and pointer selection. The disabled **Unavailable** trigger cannot activate. Tab leaves the list through the active panel and reaches **Remove reference fixture**. Activate removal, then Tab to **After fixture** and press Enter: the visible status becomes `After fixture action count: 1`.

Inspect the paired captures `01-initial`, `02-focus-without-selection`, `03-activated` and `04-host-after-removal`. At 1280×800 light and 390×844 dark, check distinct focus and selected appearance, readable disabled text, visible panel content, unclipped keyboard outlines, accessible horizontal overflow and continued access to both host actions. The check's role/layout facts do not judge paint contrast or overlap; record any visual defect with its actual state and source. Browser accessibility snapshots do not replace screen-reader testing.

## Challenge the observation command

Run these artificial controls against the unchanged clean example, with new output paths:

```sh
CHROME_PATH=/usr/bin/chromium timeout --kill-after=10s 120s npm run check:consumer -- --url http://127.0.0.1:4734 --out /tmp/knowledge-consumer-control-automatic --negative-control automatic
CHROME_PATH=/usr/bin/chromium timeout --kill-after=10s 120s npm run check:consumer -- --url http://127.0.0.1:4734 --out /tmp/knowledge-consumer-control-relationship --negative-control relationship
CHROME_PATH=/usr/bin/chromium timeout --kill-after=10s 120s npm run check:consumer -- --url http://127.0.0.1:4734 --out /tmp/knowledge-consumer-control-removal --negative-control removal
```

These commands should exit nonzero with an actual failed check. Inspect the reason as well as the exit status:

| Injected control | Observable change | Required detecting check |
| --- | --- | --- |
| `automatic` | Focusing a trigger programmatically activates it, violating the manual task | `right-skips-disabled` observes Details focus with Overview selection |
| `relationship` | The initial trigger loses its `aria-controls` relationship | `initial-selection` requires a reciprocal current trigger/panel relation |
| `removal` | A capture listener prevents the host removal action | `removal` requires all tab controls and panels to detach |

These are injected checker controls, not discovered product bugs. A missing browser, setup failure or unrelated earlier failure does not validate a control. All subsequent checks remain `not-run` after the first failure.

## Continue the original Issue

The delivered workflow and authored example do not finish the controlled comparison. Main still needs actual consumer/visual validation, independent fact/oracle review, frozen model/environment/budget manifests, genuinely isolated fresh participants, repeated three-path task outputs, complete measurements and interpretation, concrete observed gap feedback, review and lawful integration. Keep the Issue open until its original conditions are earned. Do not turn an absent result into a favorable result, an empty defect list, zero cost or an `inconclusive` experiment that never ran.
