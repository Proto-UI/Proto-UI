import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TOOL_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY = "Proto-UI/Proto-UI";
export const SOURCE_SHA = "e4f7fa8e46c87edaf5354f8d9553b261f66e16c8";
export const SOURCE_TREE = "7a3c626ec6e1ca6a77836502361e47fc62be0ce4";
export const CARRIER_REF =
  "refs/heads/evidence/sprint1-matrix-profile-e4f7fa8-20261122";
export const ACTOR = "cyjin-yl";
export const HELPERS = ["common.mjs", "matrix.mjs", "matrix-assets.mjs"];
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");
export const fileHash = (file) => sha256(readFileSync(file));
export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(`${file}.new`, JSON.stringify(value, null, 2) + "\n");
  renameSync(`${file}.new`, file);
}
export function git(repo, args, options = {}) {
  const result = execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 90_000,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  return typeof result === "string" ? result.trim() : result;
}
export function loadManifest() {
  const manifest = readJson(path.join(TOOL_ROOT, "manifest.json"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.repository, REPOSITORY);
  assert.equal(manifest.carrierRef, CARRIER_REF);
  assert.equal(manifest.carrierParent, SOURCE_SHA);
  assert.equal(manifest.source.sha, SOURCE_SHA);
  assert.equal(manifest.source.tree, SOURCE_TREE);
  assert.equal(manifest.diagnosticOnly, true);
  assert.equal(manifest.formalAcceptance, false);
  assert.deepEqual(
    Object.keys(manifest.helperSha256).sort(),
    [...HELPERS].sort(),
  );
  for (const name of HELPERS)
    assert.equal(
      fileHash(path.join(TOOL_ROOT, name)),
      manifest.helperSha256[name],
      `Helper mismatch: ${name}`,
    );
  return manifest;
}
export function runtimeOrigin(env = process.env) {
  assert.equal(env.GITHUB_EVENT_NAME, "workflow_dispatch");
  assert.equal(
    env.GITHUB_RUN_ATTEMPT,
    "1",
    "Only the reviewed first manual attempt",
  );
  assert.equal(env.GITHUB_REPOSITORY, REPOSITORY);
  assert.equal(env.GITHUB_REF, CARRIER_REF);
  assert.equal(env.GITHUB_ACTOR, ACTOR);
  assert.equal(env.GITHUB_TRIGGERING_ACTOR, ACTOR);
  assert.ok(env.GITHUB_EVENT_PATH);
  const event = readJson(env.GITHUB_EVENT_PATH);
  assert.equal(event.sender?.login, ACTOR);
  assert.match(env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
  assert.equal(env.GITHUB_WORKFLOW_SHA, env.GITHUB_SHA);
  assert.equal(env.CANDIDATE_SHA, SOURCE_SHA);
  return {
    workflowHead: env.GITHUB_SHA,
    workflowRef: env.GITHUB_REF,
    workflowDefinitionHead: env.GITHUB_WORKFLOW_SHA,
    workflowDefinitionRef: env.GITHUB_WORKFLOW_REF,
    workflowEvent: env.GITHUB_EVENT_NAME,
    actor: env.GITHUB_ACTOR,
    triggeringActor: env.GITHUB_TRIGGERING_ACTOR,
    eventSender: event.sender.login,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    candidateSha: SOURCE_SHA,
    candidateTree: SOURCE_TREE,
    boundary:
      "The workflow carrier is distinct from the original, clean source under diagnosis.",
  };
}
export function verifyCarrier(repo, manifest, origin) {
  assert.equal(git(repo, ["rev-parse", "HEAD"]), origin.workflowHead);
  assert.equal(
    git(repo, ["rev-list", "--parents", "-n", "1", "HEAD"]),
    `${origin.workflowHead} ${SOURCE_SHA}`,
  );
  assert.equal(
    git(repo, ["status", "--porcelain", "--untracked-files=no"]),
    "",
  );
  const files = [
    ".github/workflows/browser-suite-repair-evidence.yml",
    ".sprint1-matrix/manifest.json",
    ...HELPERS.map((name) => `.sprint1-matrix/${name}`),
  ];
  assert.deepEqual(
    git(repo, ["diff", "--name-only", SOURCE_SHA, "HEAD"]).split("\n").sort(),
    files.sort(),
  );
  assert.equal(
    fileHash(
      path.join(repo, ".github/workflows/browser-suite-repair-evidence.yml"),
    ),
    manifest.workflowSha256,
  );
}
