#!/usr/bin/env node

import { copyFile, lstat, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Reserve one Pages file for the trusted _worker.js injected after the
// untrusted artifact has been copied.
const MAX_FILES = 19_999;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const RESERVED_ROOT_FILES = new Set([
  "_worker.js",
  "_routes.json",
  "_headers",
  "_redirects",
  ".assetsignore",
]);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      fail(`invalid argument near ${name ?? "end of arguments"}`);
    }
    values.set(name.slice(2), value);
  }
  return values;
}

function assertSafeOutput(output, source) {
  const cwd = path.resolve(process.cwd());
  const relative = path.relative(cwd, output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("output must be a child of the current workspace");
  }
  if (output === source || source.startsWith(`${output}${path.sep}`)) {
    fail("output must not contain or equal the artifact source");
  }
}

async function copySanitized(source, output) {
  let files = 0;
  let bytes = 0;

  async function visit(sourceDir, outputDir, depth) {
    const entries = await readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (depth === 0 && RESERVED_ROOT_FILES.has(entry.name)) {
        continue;
      }
      const sourcePath = path.join(sourceDir, entry.name);
      const outputPath = path.join(outputDir, entry.name);
      const stat = await lstat(sourcePath);
      if (stat.isSymbolicLink()) {
        fail(`artifact contains a symbolic link: ${path.relative(source, sourcePath)}`);
      }
      if (stat.isDirectory()) {
        await mkdir(outputPath, { recursive: true });
        await visit(sourcePath, outputPath, depth + 1);
        continue;
      }
      if (!stat.isFile()) {
        fail(`artifact contains a non-regular file: ${path.relative(source, sourcePath)}`);
      }
      files += 1;
      bytes += stat.size;
      if (files > MAX_FILES) fail(`artifact exceeds ${MAX_FILES} files`);
      if (stat.size > MAX_FILE_BYTES) fail(`artifact file exceeds 25 MiB: ${entry.name}`);
      if (bytes > MAX_TOTAL_BYTES) fail("artifact exceeds the 500 MiB safety limit");
      await copyFile(sourcePath, outputPath);
    }
  }

  await visit(source, output, 0);
  if (files === 0) fail("artifact contains no deployable files");
  return { files, bytes };
}

const args = parseArgs(process.argv.slice(2));
const source = path.resolve(args.get("source") ?? "");
const output = path.resolve(args.get("output") ?? "");
const pr = Number(args.get("pr"));
const project = args.get("project") ?? "";
const controlPlane = new URL(args.get("control-plane") ?? "");
const headSHA = args.get("head-sha") ?? "";
const runID = Number(args.get("run-id"));
const runAttempt = Number(args.get("run-attempt"));

if (!Number.isSafeInteger(pr) || pr < 1) fail("PR number must be a positive integer");
if (project !== `poppy-proto-ui-pr-${pr}`) fail("project name does not match the PR number");
if (!/^[0-9a-f]{40}$/.test(headSHA)) fail("head SHA must be a full lowercase SHA-1");
if (!Number.isSafeInteger(runID) || runID < 1) fail("run ID must be a positive integer");
if (!Number.isSafeInteger(runAttempt) || runAttempt < 1) fail("run attempt must be a positive integer");
if (controlPlane.protocol !== "https:" || controlPlane.username || controlPlane.password) {
  fail("control plane must be an HTTPS origin without credentials");
}
controlPlane.pathname = "/";
controlPlane.search = "";
controlPlane.hash = "";

const sourceStat = await lstat(source).catch(() => null);
if (!sourceStat?.isDirectory()) fail("artifact source is not a directory");
assertSafeOutput(output, source);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const copied = await copySanitized(source, output);

const templatePath = fileURLToPath(new URL("../templates/pages-worker.js", import.meta.url));
let worker = await readFile(templatePath, "utf8");
worker = worker
  .replace("__POPPY_PREVIEW_PR__", String(pr))
  .replace("__POPPY_PREVIEW_PROJECT__", JSON.stringify(project))
  .replace("__POPPY_CONTROL_PLANE__", JSON.stringify(controlPlane.origin))
  .replace("__POPPY_PREVIEW_HEAD_SHA__", JSON.stringify(headSHA))
  .replace("__POPPY_PREVIEW_RUN_ID__", String(runID))
  .replace("__POPPY_PREVIEW_RUN_ATTEMPT__", String(runAttempt));
if (worker.includes("__POPPY_")) fail("trusted worker template contains an unresolved placeholder");
await writeFile(path.join(output, "_worker.js"), worker, { mode: 0o644 });

console.log(`Prepared ${copied.files} files (${copied.bytes} bytes) for PR #${pr}.`);
