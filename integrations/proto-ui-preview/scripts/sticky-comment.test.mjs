import assert from "node:assert/strict";
import test from "node:test";

import { GITHUB_ACTIONS_BOT_ID, ownedMarkerComments } from "./sticky-comment-lib.mjs";

test("deduplicates only marker comments owned by the authenticated workflow identity", () => {
  const marker = "<!-- poppy-preview:poppy-proto-ui-pr-42 -->";
  const comments = [
    { id: 1, user: { id: 7, type: "User" }, body: marker },
    { id: 2, user: { id: 7, type: "User" }, body: `before\n${marker}` },
    { id: 3, user: { id: 8, type: "Bot" }, body: marker },
    { id: 4, user: { id: 7, type: "User" }, body: "ordinary comment" },
  ];
  assert.deepEqual(ownedMarkerComments(comments, marker, 7).map(({ id }) => id), [1, 2]);
});

test("rejects an invalid viewer identity", () => {
  assert.deepEqual(ownedMarkerComments([], "marker", 0), []);
});

test("defaults to GitHub Actions' stable bot identity", () => {
  const marker = "<!-- marker -->";
  const comments = [
    { id: 1, user: { id: GITHUB_ACTIONS_BOT_ID }, body: marker },
    { id: 2, user: { id: 99 }, body: marker },
  ];
  assert.deepEqual(ownedMarkerComments(comments, marker).map(({ id }) => id), [1]);
});
