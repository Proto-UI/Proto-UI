#!/usr/bin/env node

import process from "node:process";

import { ownedMarkerComments } from "./sticky-comment-lib.mjs";

const token = process.env.GITHUB_TOKEN || "";
const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
const pr = Number(process.env.PREVIEW_PR);
const project = process.env.PREVIEW_PROJECT || "";
const status = process.env.PREVIEW_STATUS || "";
if (!token || !owner || !repo) throw new Error("GitHub workflow identity is unavailable");
if (!Number.isSafeInteger(pr) || pr < 1) throw new Error("invalid PR number");
if (project !== `poppy-proto-ui-pr-${pr}`) throw new Error("invalid project name");

const marker = `<!-- poppy-preview:${project} -->`;
const shortSHA = (process.env.PREVIEW_SHA || "").slice(0, 12);
const runURL = process.env.PREVIEW_RUN_URL || "";
const origin = process.env.PREVIEW_ORIGIN || "";
const states = {
  ready: {
    heading: "✅ Preview ready",
    detail: `[Open the contributor preview](${origin})`,
    note: "GitHub sign-in is required. Access is limited to the PR author, live recorded reviewers, active Proto-UI organization members, and current-head users explicitly invited by a maintainer through Poppy; mutable eligibility is rechecked while browsing.",
  },
  failed: {
    heading: "❌ Preview deployment failed",
    detail: `[Inspect the build and deployment run](${runURL})`,
    note: "Poppy kept the previous preview inaccessible unless it still matches the current PR head.",
  },
  closed: {
    heading: "🧹 Preview removed",
    detail: "The pull request is closed and its dedicated Cloudflare Pages project has been deleted.",
    note: "No preview compute, deployment, or hostname is retained for this PR.",
  },
  "cleanup-failed": {
    heading: "⚠️ Preview cleanup needs attention",
    detail: `[Inspect the cleanup run](${runURL})`,
    note: "Poppy could not confirm that every Cloudflare Pages resource was deleted.",
  },
};
const selected = states[status];
if (!selected) throw new Error(`invalid comment status: ${status}`);

const body = `${marker}
## 🐱 Poppy Preview

${selected.heading} · \`${shortSHA || "unknown SHA"}\`

${selected.detail}

${selected.note}

<sub>One isolated Pages project per PR · automatically replaced on new commits · automatically removed on close</sub>`;

const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
async function github(pathname, init = {}) {
  const result = await fetch(`${api}${pathname}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!result.ok) {
    const detail = (await result.text()).slice(0, 1000);
    throw new Error(`GitHub API ${init.method || "GET"} ${pathname} failed (${result.status}): ${detail}`);
  }
  if (result.status === 204) return null;
  return result.json();
}

const comments = [];
for (let page = 1; page <= 20; page += 1) {
  const batch = await github(`/issues/${pr}/comments?per_page=100&page=${page}`);
  comments.push(...batch);
  if (batch.length < 100) break;
  if (page === 20) throw new Error("refusing to comment before all existing comments are searched");
}
// Match GitHub Actions' stable numeric bot identity rather than every Bot.
// The marker is public, so trusting user.type alone would let an unrelated App
// make Poppy edit or delete its comment.
const matches = ownedMarkerComments(comments, marker);
if (matches.length === 0) {
  await github(`/issues/${pr}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  console.log(`Created the preview comment for PR #${pr}.`);
} else {
  await github(`/issues/comments/${matches[0].id}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
  for (const duplicate of matches.slice(1)) {
    await github(`/issues/comments/${duplicate.id}`, { method: "DELETE" });
  }
  console.log(`Updated the preview comment for PR #${pr}.`);
}
