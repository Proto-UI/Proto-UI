import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchBrowser } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type { Browser } from '../../../apps/www/node_modules/playwright-core/types/types';
import type { buildButtonSsrFixture } from './button-ssr-fixture';

export type ButtonSsrFixture = Awaited<ReturnType<typeof buildButtonSsrFixture>>;
export type CarrierMutation = 'source' | 'profile' | 'props' | 'malformed' | 'helper' | 'css';

export interface ButtonSsrBrowserServer {
  browser: Browser;
  baseUrl: string;
  evidenceDir: string;
  requests: { path: string; request: number; htmlSha256: string }[];
  close(): Promise<void>;
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Corrupt only transport data. Preserve the original server DOM and CSS as the oracle. */
export function mutateButtonCarrier(html: string, mutation: CarrierMutation): string {
  let found = false;
  const result = html.replace(
    /(<script\b[^>]*\bdata-pui-carrier="[^"]*"[^>]*>)([\s\S]*?)(<\/script>)/,
    (_match, start: string, json: string, end: string) => {
      found = true;
      const carrier = JSON.parse(json);
      if (mutation === 'source') carrier.binding = `${carrier.binding}-foreign-source`;
      if (mutation === 'profile') carrier.profile = 'react-dom-ssr-v1';
      if (mutation === 'props') carrier.raw = [['disabled', { kind: 'value', value: true }]];
      if (mutation === 'malformed') carrier.raw = { disabled: true };
      if (mutation === 'helper') carrier.artifacts.helpers = 'foreign-helper';
      if (mutation === 'css') carrier.artifacts.css = 'foreign-css';
      return start + JSON.stringify(carrier).replaceAll('<', '\\u003c') + end;
    }
  );
  if (!found) throw new Error('Generated Button HTML has no serialized carrier to corrupt');
  return result;
}

/**
 * Serve bytes from the generated server entry, with no Runtime/Adapter, Vite,
 * page.setContent, copied Button markup, or fixture-side behavior implementation.
 * The page loads the client bundle but never registers it automatically. Tests
 * decide the network/registration boundary without changing generated behavior.
 */
export async function startButtonSsrBrowserServer(
  compiled: ButtonSsrFixture
): Promise<ButtonSsrBrowserServer> {
  const evidenceRoot =
    process.env.COMPILER_EVIDENCE_DIR ?? process.env.PROTO_UI_RUNTIME_EVIDENCE_DIR;
  const evidenceDir = evidenceRoot
    ? path.resolve(evidenceRoot, 'compiler-button-ssr')
    : await mkdtemp(path.join(tmpdir(), 'proto-compiler-button-ssr-'));
  await mkdir(evidenceDir, { recursive: true });
  const requests: ButtonSsrBrowserServer['requests'] = [];
  let request = 0;
  let browser: Browser | undefined;
  const server = createServer(async (incoming, response) => {
    try {
      const url = new URL(incoming.url ?? '/', 'http://localhost');
      response.setHeader('Cache-Control', 'no-store');
      if (url.pathname === '/client.js') {
        response.setHeader('Content-Type', 'application/javascript');
        response.end(compiled.clientCode);
        return;
      }
      if (url.pathname === '/style.css') {
        response.setHeader('Content-Type', 'text/css');
        response.end(compiled.cssText);
        return;
      }
      if (url.pathname !== '/') {
        response.writeHead(404).end('Not found');
        return;
      }
      const current = ++request;
      const count = url.searchParams.get('count') === '2' ? 2 : 1;
      const disabled = url.searchParams.get('disabled') === 'true';
      const mutation = url.searchParams.get('mutation') as CarrierMutation | null;
      if (
        mutation &&
        !['source', 'profile', 'props', 'malformed', 'helper', 'css'].includes(mutation)
      ) {
        response.writeHead(400).end('Unknown carrier mutation');
        return;
      }
      const instances = Array.from({ length: count }, (_, index) => {
        const result = compiled.render(
          { disabled },
          {
            slotHtml: `<span data-slot-label="${index}">Compiler Button ${index + 1}</span>`,
            rootAttributes: { 'data-instance': String(index), 'data-request': String(current) },
          }
        );
        return mutation ? mutateButtonCarrier(result.html, mutation) : result.html;
      });
      // Page geometry is harness input. All Button styling is compiled cssText.
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Compiler Button SSR evidence</title><style data-pui-ssr-css="${compiled.provenance.cssSha256}">${compiled.cssText}</style><style>body{margin:32px;background:#eee;font-family:Arial,sans-serif}main{display:flex;gap:24px;align-items:start}#selection{margin-top:32px}</style></head><body><main>${instances.join('')}</main><p id="selection">Selection outside the server Button must remain intact.</p><script defer src="/client.js"></script></body></html>`;
      await writeFile(path.join(evidenceDir, `request-${current}.html`), html);
      requests.push({
        path: url.pathname + url.search,
        request: current,
        htmlSha256: sha256(html),
      });
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(html);
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  const close = async () => {
    try {
      await browser?.close();
    } finally {
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
      await writeFile(path.join(evidenceDir, 'requests.json'), JSON.stringify(requests, null, 2));
    }
  };
  try {
    const generatedRoot = path.join(evidenceDir, 'generated');
    for (const artifact of compiled.generatedFiles) {
      const destination = path.resolve(generatedRoot, artifact.path);
      if (!destination.startsWith(generatedRoot + path.sep)) {
        throw new Error(`Generated artifact path escapes evidence directory: ${artifact.path}`);
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, artifact.contents);
    }
    await writeFile(path.join(evidenceDir, 'generated.css'), compiled.cssText);
    await writeFile(path.join(evidenceDir, 'generated-client.js'), compiled.clientCode);
    await writeFile(
      path.join(evidenceDir, 'build.json'),
      JSON.stringify(
        {
          head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          runId: process.env.COMPILER_EVIDENCE_RUN_ID ?? null,
          node: process.version,
          platform: process.platform,
          provenance: compiled.provenance,
          cssSha256: sha256(compiled.cssText),
          clientSha256: sha256(compiled.clientCode),
        },
        null,
        2
      )
    );
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('SSR fixture has no TCP address');
    browser = await launchBrowser();
    await writeFile(path.join(evidenceDir, 'browser-version.txt'), browser.version());
    return { browser, baseUrl: `http://127.0.0.1:${address.port}`, evidenceDir, requests, close };
  } catch (error) {
    await writeFile(path.join(evidenceDir, 'startup-error.txt'), String(error));
    await close();
    throw error;
  }
}
