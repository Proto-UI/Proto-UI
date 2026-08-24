import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/poppy-preview-deploy.yml", import.meta.url),
  "utf8",
);

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
