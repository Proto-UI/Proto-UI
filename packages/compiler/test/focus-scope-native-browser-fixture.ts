import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import type { Browser } from '../../../apps/www/node_modules/playwright-core/types/types';
import { launchBrowser } from '../../../apps/www/src/content/docs/zh-cn/browser-harness';
import { parsePrototype } from '../src/parser';
import { emitWebComponentSource } from '../src/web-component-source';

// Draft authority: C-AS-FOCUS-SCOPE-0002-B/C/D/K, C-AS-FOCUSABLE-0001-G,
// M-FOCUS-0001-D/E. These ordinary atomic consumers are not authored Popover.
export const focusScopeTags = {
  none: 'pui-focus-native-none',
  ordinary: 'pui-focus-native-default',
  previous: 'pui-focus-native-previous',
  manual: 'pui-focus-native-manual',
  target: 'pui-focus-native-target',
} as const;
export type ScopeKind = Exclude<keyof typeof focusScopeTags, 'target'>;
export const focusEvidenceDigest = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

function scopeSource(kind: ScopeKind, config: string) {
  return `import {definePrototype} from '@proto.ui/core';
import {asFocusScope} from '@proto.ui/hooks';
export default definePrototype({name:'ordinary-focus-${kind}',setup(def){
  const scope=asFocusScope();scope.configure(${config});
  def.expose.state('active',scope.active);
  def.expose.state('hasFocused',scope.hasFocused);
  def.expose.method('open',()=>{scope.activate({reason:'keyboard'});});
  def.expose.method('openManual',()=>{scope.activate({reason:'keyboard',entry:'manual'});});
  def.expose.method('close',()=>{scope.deactivate();});
  def.expose.event('handback',{payload:'void'});
  def.event.onGlobal('key.down',(run,event)=>{
    if(event.key!=='Escape')return;
    if(!scope.isActive())return;
    event.control.requestDefaultActionPrevention();
    scope.deactivate({reason:'keyboard'});
    run.expose.emit('handback');
  });
  return r=>r.el('section',r.slot());
}});`;
}

const authoredSources = {
  none: scopeSource('none', "{restore:'none'}"),
  ordinary: scopeSource('ordinary', '{}'),
  previous: scopeSource('previous', "{restore:'previous'}"),
  manual: scopeSource('manual', "{entry:'manual',restore:'none'}"),
  target: `import {definePrototype} from '@proto.ui/core';
import {asFocusable,asTrigger,asAccessible} from '@proto.ui/hooks';
export default definePrototype({name:'ordinary-focus-target',setup(def){
  def.props.define({label:{type:'string',default:'Focus target'},present:{type:'boolean',default:true}});
  const focus=asFocusable();asTrigger();
  const accessible=asAccessible();accessible.role('button');accessible.nameFromContent();
  def.expose.state('focused',focus.focused);
  def.expose.state('focusVisible',focus.focusVisible);
  def.expose.state('focusable',focus.focusable);
  def.expose.method('focus',(options?:{reason?:'programmatic'|'keyboard'|'pointer';preventScroll?:boolean})=>{focus.focus(options);});
  def.expose.method('focusSelf',(options?:{reason?:'programmatic'|'keyboard'|'pointer';preventScroll?:boolean})=>{focus.focusSelf(options);});
  def.expose.event('activateScope',{payload:'void'});
  def.event.on('press.commit',run=>{run.expose.emit('activateScope');});
  def.lifecycle.onCreated(run=>{run.lifecycle.setPresent(run.props.get().present ?? true);});
  def.props.watch(['present'],(run,next)=>{run.lifecycle.setPresent(next.present ?? true);});
  return r=>r.el('span',r.read.props.get().label ?? 'Focus target');
}});`,
} as const;

// Only normal generated imports/registration, native child composition and public
// facades occur here. The source scope owns activation/deactivation. Its authored
// handback event is an ordinary consumer request to focus the original trigger.
const entry = `import {register as none} from './none';
import {register as ordinary} from './ordinary';
import {register as previous} from './previous';
import {register as manual} from './manual';
import {register as target} from './target';
none('${focusScopeTags.none}');ordinary('${focusScopeTags.ordinary}');
previous('${focusScopeTags.previous}');manual('${focusScopeTags.manual}');target('${focusScopeTags.target}');
const params=new URLSearchParams(location.search);
const kind=params.get('scope')??'none';
const tags=${JSON.stringify(focusScopeTags)};
if(!['none','ordinary','previous','manual'].includes(kind))throw new Error('Unknown scope variant');
const timeline=[];
for(const type of ['focusin','focusout','pointerdown','click','keydown'])document.addEventListener(type,event=>{
  const composedPath=event.composedPath().filter(node=>node instanceof Element).map(node=>({tag:node.localName,id:node.id}));
  const record={
    type,time:performance.now(),target:event.target instanceof Element?event.target.id:null,targetTag:event.target instanceof Element?event.target.localName:null,composedPath,trusted:event.isTrusted,cancelable:event.cancelable,key:event instanceof KeyboardEvent?event.key:null,
    defaultPreventedAtCapture:event.defaultPrevented,eventPhaseAtCapture:event.eventPhase,
    microtaskSample:null as {time:number;eventPhase:number;defaultPrevented:boolean}|null,
    get defaultPrevented(){return event.defaultPrevented;},
    get eventPhaseAtRead(){return event.eventPhase;},
  };
  timeline.push(record);
  // This is an early sample, not a dispatch-completion receipt. The accessors
  // above read the same native Event when the test later snapshots the record.
  queueMicrotask(()=>{record.microtaskSample={time:performance.now(),eventPhase:event.eventPhase,defaultPrevented:event.defaultPrevented};});
},true);
function item(id,label){const el=document.createElement(tags.target);el.id=id;el.setAttribute('data-kind','target');el.setProps({label,present:true});return el;}
function region(tag,id){const el=document.createElement(tag);el.id=id;el.setAttribute('data-kind','scope');el.setAttribute('aria-label',id);return el;}
const trigger=item('trigger','Original trigger');
const destination=item('destination','Generated outside destination');
const nativeOutside=document.createElement('button');nativeOutside.id='native-outside';nativeOutside.textContent='Native outside destination';
const scope=region(tags[kind],'scope');
const inside=item('inside','Inside focus target');scope.append(inside);
let inner=null,nestedInside=null;
if(params.get('nested')==='true'){inner=region(tags.none,'inner');nestedInside=item('nested-inside','Nested focus target');inner.append(nestedInside);scope.append(inner);}
const handbacks=[];
scope.addEventListener('handback',event=>{
  if(event.target!==scope)return;
  handbacks.push({time:performance.now(),active:scope.getExposes().active.get()});
  if(params.get('handback')!=='false')trigger.getExposes().focusSelf({reason:'keyboard'});
});
trigger.addEventListener('activateScope',event=>{if(event.target===trigger)scope.getExposes().open();});
document.querySelector('#mount').append(trigger,destination,nativeOutside,scope);
window.focusScopeConsumer={trigger,destination,nativeOutside,scope,inside,inner,nestedInside,timeline,handbacks,kind};
window.focusScopeConsumerReady=true;
`;

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Generated Focus scope native consumer</title>
<style>body{font:16px system-ui;padding:24px;color:#172033;background:#f5f7fb}main{max-width:780px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}[data-kind=target],button{display:inline-flex;padding:12px 16px;background:white;border:1px solid #64748b;border-radius:6px;cursor:pointer}[data-kind=scope]{display:block;width:100%;padding:22px;border:2px dashed #64748b;border-radius:8px;background:#e8eef9}section{display:flex;gap:16px;flex-wrap:wrap;align-items:center}[data-kind=scope] [data-kind=scope]{margin-top:12px;background:#dbe7fb}:focus{outline:4px solid #2563eb;outline-offset:4px}</style>
<h1>Generated Focus scope native consumer</h1><p>Focus moves between ordinary generated controls and a native outside button.</p><main id="mount"></main><script src="/client.js"></script></html>`;

type GeneratedSource = { contents: string; emittedBy: string[] };
type CompilationReceipt = {
  name: string;
  fileName: string;
  sourceSha256: string;
  parse: { ok: boolean; diagnostics: readonly unknown[] };
  emit?: { ok: boolean; diagnostics: readonly unknown[]; provenance?: unknown };
  /** Required semantic operation families, not operation/backend coverage. */
  requirements?: readonly string[];
};

export interface FocusScopeNativeFixture {
  browser: Browser;
  baseUrl: string;
  evidenceDir: string;
  head: string;
  buildSha256: string;
  close(): Promise<void>;
}

export async function startFocusScopeNativeFixture(): Promise<FocusScopeNativeFixture> {
  // Always create a distinct run directory; a retry cannot overwrite red evidence.
  const parent = process.env.COMPILER_FOCUS_NATIVE_EVIDENCE_DIR
    ? path.resolve(process.env.COMPILER_FOCUS_NATIVE_EVIDENCE_DIR)
    : tmpdir();
  await mkdir(parent, { recursive: true });
  const evidenceDir = await mkdtemp(path.join(parent, 'focus-native-'));
  const requests: { url: string; status: number }[] = [];
  let browser: Browser | undefined;
  let client = '';
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const status = url.pathname === '/' || url.pathname === '/client.js' ? 200 : 404;
    requests.push({ url: url.pathname + url.search, status });
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
  const close = async () => {
    try {
      await browser?.close();
    } finally {
      try {
        if (server.listening) {
          const { promise, resolve, reject } = Promise.withResolvers<void>();
          server.close((error) => (error ? reject(error) : resolve()));
          await promise;
        }
      } finally {
        await writeFile(path.join(evidenceDir, 'requests.json'), JSON.stringify(requests, null, 2));
      }
    }
  };
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
    if (process.env.CANDIDATE_SHA && process.env.CANDIDATE_SHA !== head)
      throw new Error('Candidate checkout identity differs');
    const workingSources = await Promise.all(
      [
        'pnpm-lock.yaml',
        'packages/compiler/src/parser.ts',
        'packages/compiler/src/web-component-source.ts',
        'packages/compiler/src/web-component-browser-support.ts',
        'packages/compiler/src/native-interaction.ts',
        'packages/compiler/src/native-adapter-modules.ts',
        'packages/compiler/src/native-context.ts',
        'packages/compiler/test/focus-scope-native-browser-fixture.ts',
        'packages/compiler/test/focus-scope-native.browser.test.ts',
        'apps/www/src/content/docs/zh-cn/browser-harness.ts',
      ].map(async (file) => ({ path: file, sha256: focusEvidenceDigest(await readFile(file)) }))
    );
    await writeFile(
      path.join(evidenceDir, 'source-state.json'),
      JSON.stringify(
        {
          head,
          tree,
          workingSources,
          status: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }),
          cleanHeadAcceptance: false,
        },
        null,
        2
      )
    );
    const sources = new Map<string, GeneratedSource>();
    const compilations: CompilationReceipt[] = [];
    const allowedSupport: Record<string, true> = {
      '.proto-ui/context/scope-v1.ts': true,
      '.proto-ui/style/native-v1.ts': true,
      '.proto-ui/interaction/native-v1.ts': true,
      '.proto-ui/interaction/adapter-modules-v1.ts': true,
      '.proto-ui/web-component/browser-v1.ts': true,
    };
    const requiredSupport = Object.keys(allowedSupport).filter((file) => !file.includes('/style/'));
    await mkdir(path.join(evidenceDir, 'authored'), { recursive: true });
    for (const [name, source] of Object.entries(authoredSources))
      await writeFile(path.join(evidenceDir, 'authored', name + '.proto.ts'), source);
    for (const [name, source] of Object.entries(authoredSources)) {
      const fileName = 'ordinary-focus-' + name + '.proto.ts';
      const parsed = parsePrototype(source, { fileName });
      const receipt: CompilationReceipt = {
        name,
        fileName,
        sourceSha256: focusEvidenceDigest(source),
        parse: { ok: parsed.ok, diagnostics: parsed.ok ? [] : parsed.diagnostics },
      };
      compilations.push(receipt);
      if (parsed.ok) {
        receipt.requirements = parsed.value.requirements;
        const emitted = emitWebComponentSource(parsed.value, { shadow: false });
        receipt.emit = { ok: emitted.ok, diagnostics: emitted.ok ? [] : emitted.diagnostics };
        if (emitted.ok) {
          receipt.emit.provenance = emitted.value.provenance;
          const support = emitted.value.supportingFiles ?? [];
          const files = [
            { path: name + '.ts', kind: 'source', contents: emitted.value.code },
            ...support,
          ];
          const seen = new Set<string>();
          for (const file of files) {
            if (
              file.kind !== 'source' ||
              seen.has(file.path) ||
              (file.path !== name + '.ts' && !Object.hasOwn(allowedSupport, file.path)) ||
              path.posix.isAbsolute(file.path) ||
              file.path.includes('\\') ||
              file.path.split('/').some((part) => part === '' || part === '.' || part === '..')
            )
              throw new Error('Unexpected generated source: ' + file.path);
            seen.add(file.path);
            const prior = sources.get(file.path);
            // Sharing the actual emitted helper module is necessary for logical
            // ancestry and the Focus owner registry across ordinary components.
            if (prior && prior.contents !== file.contents)
              throw new Error('Generated shared support differs between consumers: ' + file.path);
            if (prior) prior.emittedBy.push(name);
            else sources.set(file.path, { contents: file.contents, emittedBy: [name] });
          }
          for (const required of requiredSupport)
            if (!seen.has(required))
              throw new Error('Complete emitted native support missing: ' + required);
        }
      }
      // Retain real parser/emitter diagnostics before any bundle/browser work.
      await writeFile(
        path.join(evidenceDir, 'compilation.json'),
        JSON.stringify(compilations, null, 2)
      );
    }
    if (compilations.some((item) => !item.parse.ok || !item.emit?.ok))
      throw new Error('Authored Focus consumer rejected; see compilation.json in ' + evidenceDir);
    const artifacts = [];
    const exports = new Set<string>();
    for (const [logicalPath, file] of sources) {
      const exportPath =
        'generated/' +
        (logicalPath.startsWith('.proto-ui/')
          ? 'helpers/' + logicalPath.slice('.proto-ui/'.length)
          : logicalPath);
      const destination = path.resolve(evidenceDir, exportPath);
      if (
        !destination.startsWith(path.resolve(evidenceDir, 'generated') + path.sep) ||
        exports.has(exportPath)
      )
        throw new Error('Generated export inventory escaped or collided');
      exports.add(exportPath);
      artifacts.push({
        logicalPath,
        exportPath,
        sha256: focusEvidenceDigest(file.contents),
        bytes: Buffer.byteLength(file.contents),
        emittedBy: file.emittedBy,
      });
    }
    // Validate the closed, deduplicated inventory before exporting any of it.
    for (const artifact of artifacts) {
      await mkdir(path.dirname(path.join(evidenceDir, artifact.exportPath)), { recursive: true });
      await writeFile(
        path.join(evidenceDir, artifact.exportPath),
        sources.get(artifact.logicalPath)!.contents
      );
    }
    sources.set('entry.ts', { contents: entry, emittedBy: [] });
    await writeFile(path.join(evidenceDir, 'entry.ts'), entry);
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
      metafile: true,
      plugins: [
        {
          name: 'ordinary-generated-focus-consumer',
          setup(builder) {
            builder.onResolve({ filter: /.*/ }, (args) => {
              if (args.path === '@floating-ui/dom')
                return { path: positioningRequire.resolve(args.path) };
              if (args.namespace && args.namespace !== 'focus-generated') return undefined;
              const targetPath = path.posix.normalize(
                path.posix.join(path.posix.dirname(args.importer || 'entry.ts'), args.path)
              );
              for (const candidate of [targetPath, targetPath + '.ts'])
                if (sources.has(candidate))
                  return { path: candidate, namespace: 'focus-generated' };
              throw new Error('Dependency escaped generated source inventory: ' + args.path);
            });
            builder.onLoad({ filter: /.*/, namespace: 'focus-generated' }, (args) => ({
              contents: sources.get(args.path)!.contents,
              loader: 'ts',
            }));
          },
        },
      ],
    });
    if (bundled.outputFiles.length !== 1) throw new Error('Expected one ordinary browser client');
    client = bundled.outputFiles[0].text;
    const metafile = JSON.stringify(bundled.metafile, null, 2);
    await writeFile(path.join(evidenceDir, 'client.js'), client);
    await writeFile(path.join(evidenceDir, 'page.html'), html);
    await writeFile(path.join(evidenceDir, 'bundle-metafile.json'), metafile);
    const buildReceipt = JSON.stringify(
      {
        head,
        tree,
        profile: 'web-component-source-v1',
        shadow: false,
        runId: process.env.GITHUB_RUN_ID ?? null,
        attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
        node: process.version,
        workingSources,
        artifacts,
        requirementsMeaning:
          'Required semantic operation families; not operation/backend coverage.',
        authored: compilations.map((item) => ({
          name: item.name,
          fileName: item.fileName,
          sha256: item.sourceSha256,
          requirements: item.requirements,
        })),
        entrySha256: focusEvidenceDigest(entry),
        clientSha256: focusEvidenceDigest(client),
        htmlSha256: focusEvidenceDigest(html),
        metafileSha256: focusEvidenceDigest(metafile),
        ordinaryNativeConsumer: true,
        compiledPopoverConformance: false,
        cleanHeadAcceptance: false,
        boundaries: [
          'Light DOM Chromium only',
          'Generic FocusScope and Focusable consumers',
          'No official Popover 32-case acceptance',
          'No historical capture replacement',
        ],
      },
      null,
      2
    );
    await writeFile(path.join(evidenceDir, 'build.json'), buildReceipt);
    const listening = Promise.withResolvers<void>();
    server.once('error', listening.reject);
    server.listen(0, '127.0.0.1', () => listening.resolve());
    await listening.promise;
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing loopback address');
    browser = await launchBrowser();
    await writeFile(path.join(evidenceDir, 'browser-version.txt'), browser.version());
    return {
      browser,
      baseUrl: 'http://127.0.0.1:' + address.port,
      evidenceDir,
      head,
      buildSha256: focusEvidenceDigest(buildReceipt),
      close,
    };
  } catch (error) {
    await writeFile(
      path.join(evidenceDir, 'startup-error.json'),
      JSON.stringify(
        {
          outcome: 'FAIL',
          evidenceDir,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : String(error),
        },
        null,
        2
      )
    );
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Focus consumer startup and cleanup failed: ' + evidenceDir
      );
    }
    throw error;
  }
}
