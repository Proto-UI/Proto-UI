#!/usr/bin/env node

import { createHmac } from "node:crypto";
import process from "node:process";

const status = process.argv[2] || "";
if (!new Set(["building", "ready", "failed", "closed"]).has(status)) {
  throw new Error("invalid preview status");
}

const controlPlane = new URL(process.env.POPPY_CONTROL_PLANE || "");
if (controlPlane.protocol !== "https:") throw new Error("POPPY_CONTROL_PLANE must use HTTPS");
const secret = process.env.POPPY_PREVIEW_INGEST_SECRET || "";
if (secret.length < 32) throw new Error("POPPY_PREVIEW_INGEST_SECRET is missing or too short");
const pr = Number(process.env.PREVIEW_PR);
const authorID = Number(process.env.PREVIEW_AUTHOR_ID);
const runID = Number(process.env.PREVIEW_RUN_ID);
const runAttempt = Number(process.env.PREVIEW_RUN_ATTEMPT);
const project = process.env.PREVIEW_PROJECT || "";
if (!Number.isSafeInteger(pr) || pr < 1) throw new Error("invalid PR number");
if (!Number.isSafeInteger(authorID) || authorID < 1) throw new Error("invalid author ID");
if (!Number.isSafeInteger(runID) || runID < 1) throw new Error("invalid workflow run ID");
if (!Number.isSafeInteger(runAttempt) || runAttempt < 1) throw new Error("invalid workflow run attempt");
if (project !== `poppy-proto-ui-pr-${pr}`) throw new Error("project does not match PR number");
if (!/^[0-9a-f]{40}$/.test(process.env.PREVIEW_SHA || "")) throw new Error("invalid head SHA");
if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?(?:\[bot\])?$/.test(process.env.PREVIEW_AUTHOR || "")) {
  throw new Error("invalid GitHub author login");
}
const canonicalOrigin = `https://${project}.pages.dev`;
const configuredOrigin = process.env.PREVIEW_ORIGIN || canonicalOrigin;
if (configuredOrigin !== canonicalOrigin) throw new Error("origin is not the canonical per-PR Pages origin");

const payload = {
  pr,
  head_sha: process.env.PREVIEW_SHA || "",
  author_login: process.env.PREVIEW_AUTHOR || "",
  author_id: authorID,
  project,
  origin: canonicalOrigin,
  deployment_id: process.env.PREVIEW_DEPLOYMENT_ID || "",
  run_id: runID,
  run_attempt: runAttempt,
  status,
};
const body = JSON.stringify(payload);
const signature = createHmac("sha256", secret).update(body).digest("hex");
const endpoint = new URL("/api/preview/deployments", controlPlane);

let lastError;
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Poppy-Signature-256": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    if (!result.ok) {
      const detail = (await result.text()).slice(0, 1000);
      throw new Error(`Poppy ingest returned ${result.status}: ${detail}`);
    }
    console.log(`Reported preview status ${status} for PR #${pr}.`);
    lastError = null;
    break;
  } catch (error) {
    lastError = error;
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
}
if (lastError) throw lastError;
