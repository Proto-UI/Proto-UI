import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { launchBrowser } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import type { Browser } from '../../../apps/www/node_modules/playwright-core/types/types';
import { parsePrototype } from '../src/parser';
import { emitWebComponentSource } from '../src/web-component-source';

const source = `import {definePrototype,tw} from '@proto.ui/core';
const style=tw('bg-white');
export default definePrototype({name:'native-browser-contract',setup(def){
  const n=def.state.numberDiscrete('native.browser.count',1);
  def.expose.method('bump',(value:number)=>{n.set(value);});
  return r=>{
    const props={style};const child=r.el('span',n.get());
    const choose=()=>{if(n.get()>0)return r.el('b','positive');return 'negative';};
    if(n.get()===98){const slot=r.slot();return r.el('section',[r.el('span','partial'),slot,slot]);}
    if(n.get()===99)return r.el('section',[r.slot(),r.slot()]);
    return r.el('section',[r.el('div'),r.el('div',props),child,child,choose(),r.slot()]);
  };
}});`;
export const nativeTags = {
  light: 'pui-native-contract-light',
  shadow: 'pui-native-contract-shadow',
};
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export async function startNativeWcFixture() {
  const evidenceDir = process.env.COMPILER_WC_NATIVE_EVIDENCE_DIR
    ? path.resolve(process.env.COMPILER_WC_NATIVE_EVIDENCE_DIR)
    : await mkdtemp(path.join(tmpdir(), 'proto-wc-native-'));
  await mkdir(evidenceDir, { recursive: true });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  if (process.env.CANDIDATE_SHA && head !== process.env.CANDIDATE_SHA)
    throw new Error('Candidate checkout identity differs');
  const parsed = parsePrototype(source, { fileName: 'ordinary-native-browser.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const sources = new Map<string, string>();
  const artifacts: { logicalPath: string; exportPath: string; sha256: string; bytes: number }[] =
    [];
  const allowedSourcePaths = new Set([
    'Component.ts',
    '.proto-ui/context/scope-v1.ts',
    '.proto-ui/style/native-v1.ts',
    '.proto-ui/interaction/native-v1.ts',
    '.proto-ui/interaction/adapter-modules-v1.ts',
    '.proto-ui/web-component/browser-v1.ts',
  ]);
  const inventory: { logicalPath: string; exportPath: string; contents: string }[] = [];
  for (const mode of ['light', 'shadow'] as const) {
    const result = emitWebComponentSource(parsed.value, { shadow: mode === 'shadow' });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    if (result.value.code.includes('ssr-v1') || result.value.code.includes('type Presentation'))
      throw new Error('Ordinary consumer includes SSR template representation');
    if (
      !result.value.supportingFiles?.some((f) => f.path === '.proto-ui/web-component/browser-v1.ts')
    )
      throw new Error('Native browser artifact missing');
    const files = [
      { path: 'Component.ts', kind: 'source', contents: result.value.code },
      ...(result.value.supportingFiles ?? []),
    ];
    const seen = new Set<string>();
    for (const f of files) {
      if (
        f.kind !== 'source' ||
        !allowedSourcePaths.has(f.path) ||
        seen.has(f.path) ||
        path.posix.isAbsolute(f.path) ||
        f.path.includes('\\') ||
        f.path.split('/').some((part) => part === '..' || part === '.' || part === '')
      ) {
        throw new Error('Unexpected or duplicate generated source path: ' + f.path);
      }
      seen.add(f.path);
      const logicalPath = mode + '/' + f.path;
      const exportPath = 'generated/' + logicalPath.replace('/.proto-ui/', '/helpers/');
      const destination = path.resolve(evidenceDir, exportPath);
      const generatedRoot = path.resolve(evidenceDir, 'generated') + path.sep;
      if (!destination.startsWith(generatedRoot))
        throw new Error('Generated export escaped allowlist root');
      inventory.push({ logicalPath, exportPath, contents: f.contents });
    }
  }
  // Validate the complete two-host inventory before any generated artifact is written.
  if (new Set(inventory.map((f) => f.exportPath)).size !== inventory.length)
    throw new Error('Duplicate generated export');
  for (const f of inventory) {
    sources.set(f.logicalPath, f.contents);
    await mkdir(path.dirname(path.join(evidenceDir, f.exportPath)), { recursive: true });
    await writeFile(path.join(evidenceDir, f.exportPath), f.contents);
    artifacts.push({
      logicalPath: f.logicalPath,
      exportPath: f.exportPath,
      sha256: digest(f.contents),
      bytes: Buffer.byteLength(f.contents),
    });
  }
  sources.set(
    'entry.ts',
    `import {register as light} from './light/Component';import {register as shadow} from './shadow/Component';light('${nativeTags.light}');shadow('${nativeTags.shadow}');window.nativeWcReady=true;`
  );
  const positioningRequire = createRequire(
    new URL('../../modules/positioning/package.json', import.meta.url)
  );
  const bundled = await build({
    entryPoints: ['entry.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    plugins: [
      {
        name: 'ordinary-native-generated-files',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === '@floating-ui/dom')
              return { path: positioningRequire.resolve(args.path) };
            if (args.namespace && args.namespace !== 'native-generated') return undefined;
            const target = path.posix.normalize(
              path.posix.join(path.posix.dirname(args.importer || 'entry.ts'), args.path)
            );
            for (const candidate of [target, target + '.ts'])
              if (sources.has(candidate)) return { path: candidate, namespace: 'native-generated' };
            throw new Error('Dependency escaped generated artifact set: ' + args.path);
          });
          builder.onLoad({ filter: /.*/, namespace: 'native-generated' }, (args) => ({
            contents: sources.get(args.path)!,
            loader: 'ts',
          }));
        },
      },
    ],
  });
  const client = bundled.outputFiles[0].text;
  const html =
    '<!doctype html><meta charset="utf-8"><title>Ordinary WC native contract</title><style>body{font:16px system-ui;padding:32px}section{border:1px solid;padding:12px}button{padding:8px}#outside{margin-top:20px}</style><main id="mount"></main><aside id="outside"></aside><script src="/client.js"></script>';
  await writeFile(path.join(evidenceDir, 'authored.proto.ts'), source);
  await writeFile(path.join(evidenceDir, 'client.js'), client);
  await writeFile(path.join(evidenceDir, 'page.html'), html);
  await writeFile(
    path.join(evidenceDir, 'build.json'),
    JSON.stringify(
      {
        head,
        tree,
        runId: process.env.GITHUB_RUN_ID ?? null,
        attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
        node: process.version,
        profile: 'web-component-source-v1',
        ordinaryBrowser: true,
        authoredSha256: digest(source),
        clientSha256: digest(client),
        htmlSha256: digest(html),
        lockSha256: digest(await readFile('pnpm-lock.yaml')),
        compilerSourceSha256: digest(
          await readFile('packages/compiler/src/web-component-source.ts')
        ),
        nativeSupportSourceSha256: digest(
          await readFile('packages/compiler/src/web-component-browser-support.ts')
        ),
        artifacts,
      },
      null,
      2
    )
  );
  const requests: { url: string; status: number }[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const status = url.pathname === '/' || url.pathname === '/client.js' ? 200 : 404;
    requests.push({ url: url.pathname, status });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; base-uri 'none'"
    );
    res.writeHead(status, {
      'Content-Type': url.pathname === '/client.js' ? 'application/javascript' : 'text/html',
    });
    res.end(status === 404 ? 'Not found' : url.pathname === '/client.js' ? client : html);
  });
  let browser: Browser | undefined;
  const close = async () => {
    try {
      await browser?.close();
    } finally {
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
      await writeFile(path.join(evidenceDir, 'requests.json'), JSON.stringify(requests, null, 2));
    }
  };
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing loopback address');
    browser = await launchBrowser();
    await writeFile(path.join(evidenceDir, 'browser-version.txt'), browser.version());
    return { browser, baseUrl: 'http://127.0.0.1:' + address.port, evidenceDir, head, close };
  } catch (error) {
    await writeFile(path.join(evidenceDir, 'startup-error.txt'), String(error));
    await close();
    throw error;
  }
}
