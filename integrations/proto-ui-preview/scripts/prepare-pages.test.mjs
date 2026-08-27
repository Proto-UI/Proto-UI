import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("the sanitizer strips untrusted Pages controls and injects the trusted gate", async () => {
  const root = await mkdtemp(path.join(process.cwd(), ".poppy-preview-test-"));
  const source = path.join(root, "artifact");
  const output = path.join(root, "site");
  try {
    await mkdir(path.join(source, "assets"), { recursive: true });
    await writeFile(path.join(source, "index.html"), "<h1>preview</h1>");
    await writeFile(path.join(source, "assets", "app.js"), "console.log('safe asset')");
    await writeFile(path.join(source, "_worker.js"), "throw new Error('untrusted worker ran')");
    await writeFile(path.join(source, "_routes.json"), "{}");

    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL("./prepare-pages.mjs", import.meta.url)),
      "--source", source,
      "--output", output,
      "--pr", "462",
      "--project", "poppy-proto-ui-pr-462",
      "--control-plane", "https://poppy.example",
      "--head-sha", "a".repeat(40),
      "--run-id", "100",
      "--run-attempt", "2",
    ], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(await readFile(path.join(output, "index.html"), "utf8"), "<h1>preview</h1>");
    const worker = await readFile(path.join(output, "_worker.js"), "utf8");
    assert.doesNotMatch(worker, /untrusted worker ran/);
    assert.match(worker, /poppy-proto-ui-pr-462/);
    assert.match(worker, /a{40}/);
    assert.match(worker, /PREVIEW_RUN_ID = 100/);
    await assert.rejects(readFile(path.join(output, "_routes.json")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
