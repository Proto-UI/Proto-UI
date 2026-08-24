import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = new URL('./cloudflare-pages.mjs', import.meta.url);

function runWithPreload(source) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      `data:text/javascript,${encodeURIComponent(source)}`,
      script.pathname,
      'ensure',
      'poppy-proto-ui-pr-42',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: 'account',
        CLOUDFLARE_API_TOKEN: 'token',
      },
    }
  );
}

test('project creation reconciles a committed mutation after transport loss without a second POST', () => {
  const preload = `
    let created = false;
    let posts = 0;
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input));
      const method = init.method || "GET";
      if (url.pathname.endsWith("/pages/projects") && method === "POST") {
        posts += 1;
        if (posts > 1) throw new Error("duplicate create POST");
        created = true;
        throw new Error("socket reset after Cloudflare committed create");
      }
      if (url.pathname.endsWith("/pages/projects/poppy-proto-ui-pr-42") && method === "GET") {
        if (!created) return new Response("", { status: 404 });
        return Response.json({ success: true, result: { name: "poppy-proto-ui-pr-42", source: null, production_branch: "main" } });
      }
      throw new Error("unexpected request " + method + " " + url.pathname);
    };
  `;

  const result = runWithPreload(preload);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Reconciled existing Pages project/);
  assert.doesNotMatch(result.stderr, /duplicate create POST/);
});
