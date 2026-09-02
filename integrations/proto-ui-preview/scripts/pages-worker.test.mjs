import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const template = await readFile(new URL("../templates/pages-worker.js", import.meta.url), "utf8");
const source = template
  .replace("__POPPY_PREVIEW_PR__", "462")
  .replace("__POPPY_PREVIEW_PROJECT__", JSON.stringify("poppy-proto-ui-pr-462"))
  .replace("__POPPY_CONTROL_PLANE__", JSON.stringify("https://poppy.example"))
  .replace("__POPPY_PREVIEW_HEAD_SHA__", JSON.stringify("a".repeat(40)))
  .replace("__POPPY_PREVIEW_RUN_ID__", "100")
  .replace("__POPPY_PREVIEW_RUN_ATTEMPT__", "2");
const worker = (await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)).default;
const edgeSecret = "e".repeat(48);

test("an anonymous request is sent to central GitHub OAuth", async () => {
  const result = await worker.fetch(
    new Request("https://poppy-proto-ui-pr-462.pages.dev/guide?q=1"),
    { POPPY_PREVIEW_EDGE_SECRET: edgeSecret },
  );
  assert.equal(result.status, 302);
  const login = new URL(result.headers.get("location"));
  assert.equal(login.origin, "https://poppy.example");
  assert.equal(login.pathname, "/preview/auth/github");
  assert.equal(login.searchParams.get("pr"), "462");
  assert.equal(
    login.searchParams.get("return"),
    "https://poppy-proto-ui-pr-462.pages.dev/guide?q=1",
  );
});

test("a deployment-specific hostname is normalized to the canonical project origin", async () => {
  const result = await worker.fetch(
    new Request("https://abc123.poppy-proto-ui-pr-462.pages.dev/guide?q=1"),
    { POPPY_PREVIEW_EDGE_SECRET: edgeSecret },
  );
  assert.equal(result.status, 308);
  assert.equal(
    result.headers.get("location"),
    "https://poppy-proto-ui-pr-462.pages.dev/guide?q=1",
  );
});

test("a one-time ticket becomes a host-only secure session", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, init) => {
    assert.equal(new URL(request).pathname, "/api/preview/exchange");
    assert.equal(init.headers["X-Poppy-Preview-Edge-Secret"], edgeSecret);
    const body = JSON.parse(init.body);
    assert.match(body.ticket, /^[tu]{32}$/);
    assert.equal(body.pr, 462);
    assert.equal(body.project, "poppy-proto-ui-pr-462");
    assert.equal(body.head_sha, "a".repeat(40));
    assert.equal(body.run_id, 100);
    assert.equal(body.run_attempt, 2);
    return Response.json({
      session: "s".repeat(48),
      return: body.ticket.startsWith("u") ? "//evil.example" : "/guide",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });
  };
  try {
    const result = await worker.fetch(
      new Request(
        `https://poppy-proto-ui-pr-462.pages.dev/__poppy/session?ticket=${"t".repeat(32)}&return=%2Fguide`,
      ),
      { POPPY_PREVIEW_EDGE_SECRET: edgeSecret },
    );
    assert.equal(result.status, 303);
    assert.equal(result.headers.get("location"), "/guide");
    const cookie = result.headers.get("set-cookie");
    assert.match(cookie, /^__Host-poppy-preview=/);
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);

    const openRedirect = await worker.fetch(
      new Request(
        `https://poppy-proto-ui-pr-462.pages.dev/__poppy/session?ticket=${"u".repeat(32)}&return=%2F%2Fevil.example`,
      ),
      { POPPY_PREVIEW_EDGE_SECRET: edgeSecret },
    );
    assert.equal(openRedirect.headers.get("location"), "/");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an authorized asset is served without forwarding the session cookie", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request, init) => {
    assert.equal(new URL(request).pathname, "/api/preview/authorize");
    assert.deepEqual(JSON.parse(init.body), {
      session: "s".repeat(48),
      pr: 462,
      project: "poppy-proto-ui-pr-462",
      head_sha: "a".repeat(40),
      run_id: 100,
      run_attempt: 2,
    });
    return Response.json({ authorized: true });
  };
  let assetRequest;
  try {
    const result = await worker.fetch(
      new Request("https://poppy-proto-ui-pr-462.pages.dev/app.js", {
        headers: { Cookie: `__Host-poppy-preview=${"s".repeat(48)}` },
      }),
      {
        POPPY_PREVIEW_EDGE_SECRET: edgeSecret,
        ASSETS: {
          fetch(request) {
            assetRequest = request;
            return new Response("asset", { headers: { "Content-Type": "text/plain" } });
          },
        },
      },
    );
    assert.equal(await result.text(), "asset");
    assert.equal(assetRequest.headers.get("cookie"), null);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    assert.match(result.headers.get("x-robots-tag"), /noindex/);
    assert.match(result.headers.get("content-security-policy"), /worker-src 'none'/);
    assert.equal(result.headers.get("service-worker-allowed"), "/__poppy/no-service-workers");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authorized Astro routes fall back to their explicit directory index", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ authorized: true });
  const paths = [];
  try {
    const result = await worker.fetch(
      new Request("https://poppy-proto-ui-pr-462.pages.dev/guide", {
        headers: { Cookie: `__Host-poppy-preview=${"s".repeat(48)}` },
      }),
      {
        POPPY_PREVIEW_EDGE_SECRET: edgeSecret,
        ASSETS: { fetch(request) {
          paths.push(new URL(request.url).pathname);
          return new URL(request.url).pathname === "/guide/index.html"
            ? new Response("guide")
            : new Response("missing", { status: 404 });
        } },
      },
    );
    assert.equal(result.status, 200);
    assert.equal(await result.text(), "guide");
    assert.deepEqual(paths, ["/guide", "/guide/index.html"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Keep this contract explicit: Advanced Mode must probe the emitted file, not the directory root.
test("the public readiness probe checks the emitted index without exposing it", async () => {
  const paths = [];
  const result = await worker.fetch(
    new Request("https://poppy-proto-ui-pr-462.pages.dev/__poppy/assets-ready"),
    { ASSETS: { fetch(request) {
      const pathname = new URL(request.url).pathname;
      paths.push(pathname);
      return pathname === "/index.html"
        ? new Response("private html")
        : new Response("missing", { status: 404 });
    } } },
  );
  assert.equal(result.status, 204);
  assert.equal(await result.text(), "");
  assert.deepEqual(paths, ["/index.html"]);
});

test("a transient control-plane failure does not clear the session or loop OAuth", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("offline", { status: 503 });
  try {
    const result = await worker.fetch(
      new Request("https://poppy-proto-ui-pr-462.pages.dev/app.js", {
        headers: { Cookie: `__Host-poppy-preview=${"s".repeat(48)}` },
      }),
      {
        POPPY_PREVIEW_EDGE_SECRET: edgeSecret,
        ASSETS: { fetch() { throw new Error("asset gate was bypassed"); } },
      },
    );
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("retry-after"), "5");
    assert.equal(result.headers.get("location"), null);
    assert.equal(result.headers.get("set-cookie"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
