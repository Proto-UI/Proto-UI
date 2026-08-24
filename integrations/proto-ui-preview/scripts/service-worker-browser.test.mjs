import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { chromium } from "playwright-core";

const template = await readFile(new URL("../templates/pages-worker.js", import.meta.url), "utf8");
const source = template
  .replace("__POPPY_PREVIEW_PR__", "462")
  .replace("__POPPY_PREVIEW_PROJECT__", JSON.stringify("poppy-proto-ui-pr-462"))
  .replace("__POPPY_CONTROL_PLANE__", JSON.stringify("https://poppy.example"))
  .replace("__POPPY_PREVIEW_HEAD_SHA__", JSON.stringify("a".repeat(40)))
  .replace("__POPPY_PREVIEW_RUN_ID__", "100")
  .replace("__POPPY_PREVIEW_RUN_ATTEMPT__", "2");
const worker = (await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)).default;

test("the real browser cannot persist a Service Worker from an authorized preview", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ authorized: true });
  let guarded;
  try {
    guarded = await worker.fetch(
      new Request("https://poppy-proto-ui-pr-462.pages.dev/", {
        headers: { Cookie: `__Host-poppy-preview=${"s".repeat(48)}` },
      }),
      {
        POPPY_PREVIEW_EDGE_SECRET: "e".repeat(48),
        ASSETS: {
          fetch() {
            return new Response(`<!doctype html><meta charset="utf-8"><output id="result">pending</output><script>
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(() => result.textContent = 'UNSAFE: registered')
                .catch(error => result.textContent = 'blocked: ' + error.name);
            </script>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
          },
        },
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const body = Buffer.from(await guarded.arrayBuffer());
  const headers = Object.fromEntries(guarded.headers);
  const server = createServer((request, response) => {
    response.writeHead(200, headers);
    response.end(request.url === "/sw.js" ? "self.addEventListener('fetch', () => {});" : body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();
    const address = server.address();
    assert.equal(typeof address, "object");
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.locator("#result").waitFor({ state: "attached" });
    await assert.doesNotReject(() => page.waitForFunction(
      () => document.querySelector("#result")?.textContent !== "pending",
    ));
    assert.match(await page.locator("#result").textContent(), /^blocked: SecurityError$/);
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
