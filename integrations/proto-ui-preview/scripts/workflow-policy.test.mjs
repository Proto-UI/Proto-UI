import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/poppy-preview-deploy.yml", import.meta.url),
  "utf8",
).catch(() => readFile(
  new URL("../../../.github/workflows/poppy-preview-deploy.yml", import.meta.url),
  "utf8",
));
const bootstrap = await readFile(
  new URL("../.github/workflows/poppy-preview-bootstrap.yml", import.meta.url),
  "utf8",
).catch(() => readFile(
  new URL("../../../.github/workflows/poppy-preview-bootstrap.yml", import.meta.url),
  "utf8",
));
const close = await readFile(
  new URL("../.github/workflows/poppy-preview-close.yml", import.meta.url),
  "utf8",
).catch(() => readFile(
  new URL("../../../.github/workflows/poppy-preview-close.yml", import.meta.url),
  "utf8",
));

test("Poppy revokes the previous ready state before Cloudflare publication", () => {
  const buildingStart = workflow.indexOf("- name: Mark the current head as building in Poppy");
  const downloadStart = workflow.indexOf("- name: Download only the verified artifact");
  assert.ok(buildingStart > 0 && downloadStart > buildingStart);
  const buildingStep = workflow.slice(buildingStart, downloadStart);
  assert.doesNotMatch(buildingStep, /continue-on-error:\s*true/);
  assert.match(buildingStep, /report\.mjs building/);
});

test("a ready-report failure cannot produce a Ready card or successful workflow", () => {
  assert.match(workflow, /- name: Report the ready deployment to Poppy\s+id: ready/);
  assert.match(workflow, /PREVIEW_STATUS: \$\{\{ steps\.ready\.outcome == 'success' && 'ready' \|\| 'failed' \}\}/);
  const readyFailureChecks = workflow.match(/steps\.ready\.outcome != 'success'/g) ?? [];
  assert.ok(readyFailureChecks.length >= 2, "failed-report and terminal workflow gates must both include the ready outcome");
});

test("the trusted Worker is bound to the exact workflow run tuple", () => {
  for (const argument of ["--head-sha", "--run-id", "--run-attempt"]) {
    assert.match(workflow, new RegExp(argument));
  }
});

test("the secret-bearing deploy installs only production dependencies", () => {
  assert.match(workflow, /npm ci --prefix integrations\/proto-ui-preview --omit=dev --ignore-scripts/);
});

test("trusted installation bootstraps every already-open or draft PR", () => {
  assert.match(bootstrap, /push:\s+branches: \[main\]/);
  assert.match(bootstrap, /state: "open"/);
  assert.match(bootstrap, /github\.paginate\(github\.rest\.pulls\.list/);
  assert.match(bootstrap, /workflow_id: "poppy-preview-build\.yml"/);
  assert.match(bootstrap, /inputs: \{ pr_number: String\(pull\.number\) \}/);
  assert.doesNotMatch(bootstrap, /\$\{\{\s*secrets\./);
});

test("deployment and close serialize on an API-derived PR key", () => {
  assert.doesNotMatch(workflow, /^concurrency:/m);
  assert.match(workflow, /resolve-deploy:[\s\S]*outputs:\s+pr: \$\{\{ steps\.resolve\.outputs\.pr \}\}/);
  assert.match(workflow, /workflow\.path !== "\.github\/workflows\/poppy-preview-build\.yml"/);
  assert.match(workflow, /deploy:[\s\S]*needs: resolve-deploy[\s\S]*group: poppy-preview-pr-\$\{\{ needs\.resolve-deploy\.outputs\.pr \}\}[\s\S]*cancel-in-progress: false/);
  assert.match(close, /^concurrency:\s+group: poppy-preview-pr-\$\{\{ github\.event\.pull_request\.number \}\}\s+cancel-in-progress: true/m);
  assert.doesNotMatch(workflow, /group:.*display_title/);
  assert.doesNotMatch(close, /display_title/);
});
