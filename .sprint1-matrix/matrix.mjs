// Read-only, four-step Matrix diagnosis. The original candidate owns browser
// startup, the selected case, 1308 cells, 60s phase and 420s producer budget.
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  SOURCE_SHA,
  SOURCE_TREE,
  TOOL_ROOT,
  loadManifest,
  readJson,
  runtimeOrigin,
  verifyCarrier,
  writeJson,
} from "./common.mjs";
import { mapMatrixProfileAssets } from "./matrix-assets.mjs";

const operation = process.argv[2];
assert.ok(["prepare", "run", "finish"].includes(operation));
const manifest = loadManifest();
const origin = runtimeOrigin();
const candidate = path.join(process.env.GITHUB_WORKSPACE, "candidate");
const carrier = path.join(process.env.GITHUB_WORKSPACE, "carrier");
const output = path.join(process.env.RUNNER_TEMP, "sprint1-matrix-profile");
mkdirSync(output, { recursive: true });
verifyCarrier(carrier, manifest, origin);
const { runtimeSourceSnapshot } = await import(
  pathToFileURL(path.join(candidate, "scripts/test/runtime-observation.mjs"))
);
const { assertRuntimeSource } = await import(
  pathToFileURL(path.join(candidate, "scripts/test/runtime-ci.mjs"))
);
const { sprint1Plan, runSprint1Command, assertSprint1StepEvidence } =
  await import(
    pathToFileURL(path.join(candidate, "scripts/test/sprint1-evidence.mjs"))
  );
function checkedSource() {
  const source = runtimeSourceSnapshot(candidate);
  assertRuntimeSource(
    { before: source, after: source },
    { checkoutSha: SOURCE_SHA },
  );
  assert.equal(source.treeSha, SOURCE_TREE);
  return source;
}
const planFile = path.join(output, "plan.json");
const progressFile = path.join(output, "progress.json");
const boundary = {
  diagnosticOnly: true,
  formalAcceptance: false,
  origin,
  boundaries: [
    "The original all-adapter case and both original 60s readiness predicates are unchanged. The other three Matrix cases are explicitly unselected.",
    "The original 420s producer budget and candidate runSprint1Command ownership/cleanup remain unchanged.",
    "Opt-in CPU profiling and same-origin response-body observation add diagnostic overhead. This run does not replace unprofiled acceptance.",
    "Compiled JS bytes come from actual original response.body events; no request routing, body replacement or replay fetch occurs.",
    "This carrier has contents:read only and never publishes source or writes PR/Issue state.",
  ],
};
function createPlan() {
  const original = sprint1Plan(output, SOURCE_SHA, candidate);
  const selected = (id) => {
    const step = original.find((entry) => entry.id === id);
    assert.ok(step);
    return step;
  };
  const styles = selected("styles");
  const matrix = selected("matrix-accessibility-consumer");
  assert.equal(matrix.timeoutMs, 420_000);
  return [
    {
      id: "install-candidate",
      executable: "corepack",
      args: ["pnpm@10.32.1", "install", "--frozen-lockfile"],
      timeoutMs: 300_000,
    },
    {
      id: "configure-toolbar",
      executable: "corepack",
      args: [
        "pnpm@10.32.1",
        "--filter",
        "apps-www",
        "exec",
        "astro",
        "preferences",
        "disable",
        "devToolbar",
      ],
      timeoutMs: 30_000,
      requires: ["install-candidate"],
    },
    { ...styles, requires: ["configure-toolbar"] },
    {
      ...matrix,
      requires: ["styles"],
      env: {
        ...matrix.env,
        PROTO_UI_MATRIX_STARTUP_PROFILE: "1",
        S1_MATRIX_ASSET_CAPTURE: "1",
        NODE_OPTIONS: [
          process.env.NODE_OPTIONS ?? "",
          `--import=${pathToFileURL(path.join(TOOL_ROOT, "matrix-assets.mjs")).href}`,
        ]
          .filter(Boolean)
          .join(" "),
      },
    },
  ];
}
const save = (results, current = null, halt = null) =>
  writeJson(progressFile, {
    ...boundary,
    results,
    current,
    halt,
    at: new Date().toISOString(),
  });

if (operation === "prepare") {
  assert.equal(
    existsSync(planFile),
    false,
    "Fresh per-attempt output required",
  );
  const source = checkedSource();
  const plan = {
    ...boundary,
    source,
    totalBudgetMs: 20 * 60_000,
    steps: createPlan(),
  };
  assert.ok(
    plan.steps.reduce((sum, step) => sum + step.timeoutMs + 5000, 0) <
      plan.totalBudgetMs,
  );
  writeJson(planFile, plan);
  writeJson(path.join(output, "environment.json"), {
    origin,
    source,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    kernel: os.release(),
    cpuCount: os.cpus().length,
    cpuModels: [...new Set(os.cpus().map((cpu) => cpu.model))],
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
  });
  save([]);
  console.log(
    JSON.stringify({
      prepared: true,
      source,
      origin,
      selected: plan.steps.map((step) => step.id),
    }),
  );
}

if (operation === "run") {
  const plan = readJson(planFile);
  assert.deepEqual(plan.origin, origin);
  const results = [];
  const controller = new AbortController();
  let halt = null;
  const interrupt = () => {
    halt ??= "interrupted";
    controller.abort();
  };
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"])
    process.on(signal, interrupt);
  const budget = setTimeout(() => {
    halt ??= "budget-exhausted";
    controller.abort();
  }, plan.totalBudgetMs);
  try {
    for (const step of plan.steps) {
      const failedPrerequisites = (step.requires ?? []).filter(
        (id) => !results.find((row) => row.id === id)?.passed,
      );
      if (halt || failedPrerequisites.length) {
        const receipt = {
          id: step.id,
          terminal: halt ? `not-run-${halt}` : "blocked-setup",
          passed: false,
          prerequisites: failedPrerequisites,
          sourceBefore: null,
          sourceAfter: null,
          result: null,
        };
        results.push(receipt);
        writeJson(path.join(output, step.id, "receipt.json"), receipt);
        save(results, null, halt);
        continue;
      }
      save(results, step.id, halt);
      writeJson(path.join(output, step.id, "selection.json"), {
        ...boundary,
        step,
      });
      let before = null,
        after = null,
        result = null,
        evidence = null,
        assets = null;
      const errors = [];
      try {
        before = checkedSource();
        result = await runSprint1Command(step, output, {
          repo: candidate,
          signal: controller.signal,
        });
        if (result.survivors?.length) halt = "blocked-cleanup";
        assert.equal(result.exitCode, 0, "Producer exit");
        assert.equal(result.timedOut, false);
        assert.equal(result.interrupted, false);
        assert.deepEqual(result.cleanupErrors, []);
        assert.deepEqual(result.survivors, []);
        evidence = assertSprint1StepEvidence(step, SOURCE_SHA, candidate);
      } catch (error) {
        errors.push(error.stack ?? String(error));
        if (!before) halt ??= "blocked-source";
      }
      try {
        after = checkedSource();
        assertRuntimeSource({ before, after }, { checkoutSha: SOURCE_SHA });
      } catch (error) {
        errors.push(error.stack ?? String(error));
        halt ??= "blocked-source";
      }
      if (step.id === "matrix-accessibility-consumer") {
        try {
          assets = mapMatrixProfileAssets(
            path.join(output, step.id, "compiled-scripts"),
            path.join(
              output,
              step.id,
              "demo-matrix/startup-profile/profile.json",
            ),
            after ?? before,
            origin,
          );
        } catch (error) {
          errors.push(error.stack ?? String(error));
        }
      }
      const receipt = {
        ...boundary,
        id: step.id,
        terminal: result ? "completed" : "not-run-setup",
        sourceBefore: before,
        sourceAfter: after,
        result,
        evidence,
        assets,
        validationErrors: errors,
        passed: errors.length === 0 && result?.exitCode === 0,
      };
      results.push(receipt);
      writeJson(path.join(output, step.id, "receipt.json"), receipt);
      save(results, null, halt);
      console.log(
        `[sprint1-matrix] ${receipt.passed ? "PASS" : "FAIL"} ${step.id}`,
      );
    }
  } finally {
    clearTimeout(budget);
    for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"])
      process.off(signal, interrupt);
    save(results, null, halt);
  }
  process.exitCode = results.every((row) => row.passed) ? 0 : 1;
}

if (operation === "finish") {
  const plan = readJson(planFile);
  const progress = existsSync(progressFile)
    ? readJson(progressFile)
    : { results: [], current: null };
  const results = plan.steps.map(
    (step) =>
      progress.results.find((row) => row.id === step.id) ?? {
        id: step.id,
        terminal:
          step.id === progress.current
            ? "interrupted-no-terminal-receipt"
            : "not-run",
        passed: false,
      },
  );
  let sourceAfter = null;
  const sourceErrors = [];
  try {
    sourceAfter = checkedSource();
  } catch (error) {
    sourceErrors.push(error.stack ?? String(error));
  }
  const summary = {
    ...boundary,
    finishedAt: new Date().toISOString(),
    source: plan.source,
    sourceAfter,
    sourceErrors,
    results,
    passed: sourceErrors.length === 0 && results.every((row) => row.passed),
  };
  writeJson(path.join(output, "summary.json"), summary);
  console.log(
    JSON.stringify({
      passed: summary.passed,
      source: summary.source,
      origin,
      results: results.map(({ id, terminal, passed }) => ({
        id,
        terminal,
        passed,
      })),
    }),
  );
  process.exitCode = summary.passed ? 0 : 1;
}
