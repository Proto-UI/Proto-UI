#!/usr/bin/env node

import process from "node:process";
import { appendFile } from "node:fs/promises";

const [command, project, expectedSHA, expectedMessage] = process.argv.slice(2);
const account = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const token = process.env.CLOUDFLARE_API_TOKEN || "";
if (!account || !token) throw new Error("Cloudflare account ID and API token are required");
if (!/^poppy-proto-ui-pr-[1-9][0-9]*$/.test(project || "")) {
  throw new Error("invalid per-PR Pages project name");
}

const api = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/pages`;

async function request(pathname, init = {}, allowNotFound = false) {
  const result = await fetch(`${api}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (allowNotFound && result.status === 404) return null;
  const envelope = await result.json().catch(() => null);
  if (!result.ok || envelope?.success !== true) {
    const errors = JSON.stringify(envelope?.errors || []).slice(0, 1000);
    throw new Error(`Cloudflare Pages API ${init.method || "GET"} ${pathname} failed (${result.status}): ${errors}`);
  }
  return envelope.result;
}

async function ensureProject() {
  const pathname = `/projects/${encodeURIComponent(project)}`;
  const existing = await request(pathname, {}, true);
  if (existing) {
    if (existing.source) {
      throw new Error(`refusing to reuse Git-integrated Pages project ${project}`);
    }
    if (existing.production_branch !== "main") {
      await request(pathname, {
        method: "PATCH",
        body: JSON.stringify({ production_branch: "main" }),
      });
      console.log(`Changed ${project}'s production branch to main.`);
    }
    console.log(`Using existing Pages project ${project}.`);
    return;
  }
  await request("/projects", {
    method: "POST",
    body: JSON.stringify({ name: project, production_branch: "main" }),
  });
  console.log(`Created Pages project ${project}.`);
}

async function latestDeployment() {
  if (!/^[0-9a-f]{40}$/.test(expectedSHA || "")) throw new Error("expected SHA is malformed");
  if (!expectedMessage || expectedMessage.length > 255 || /[\r\n\0]/.test(expectedMessage)) {
    throw new Error("expected deployment marker is malformed");
  }
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const deployments = await request(
      `/projects/${encodeURIComponent(project)}/deployments?env=production&page=1&per_page=20`,
    );
    const match = deployments.find(
      (deployment) => deployment.deployment_trigger?.metadata?.commit_hash === expectedSHA &&
        deployment.deployment_trigger?.metadata?.commit_message === expectedMessage,
    );
    if (match) {
      const status = match.latest_stage?.status;
      if (status === "failure") throw new Error(`Pages deployment ${match.id} failed`);
      if (status === "success") {
        const origin = `https://${project}.pages.dev`;
        if (process.env.GITHUB_OUTPUT) {
          await appendFile(
            process.env.GITHUB_OUTPUT,
            `deployment_id=${match.id}\norigin=${origin}\n`,
          );
        }
        console.log(`Resolved successful Pages deployment ${match.id}.`);
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`timed out resolving the Pages deployment for ${expectedSHA}`);
}

async function deleteProject() {
  const pathname = `/projects/${encodeURIComponent(project)}`;
  const existing = await request(pathname, {}, true);
  if (!existing) {
    console.log(`Pages project ${project} is already absent.`);
    return;
  }
  await request(pathname, { method: "DELETE" });
  console.log(`Deleted Pages project ${project}.`);
}

if (command === "ensure") await ensureProject();
else if (command === "latest") await latestDeployment();
else if (command === "delete") await deleteProject();
else throw new Error("usage: cloudflare-pages.mjs <ensure|latest|delete> <project> [sha]");
