/** Measure the retained production closure separately from generated source bytes.
 * Usage: node scripts/compiler/release-family-costs.mjs /path/to/family/summary.json
 * Reuses the exact isolated consumer installation, without rebuilding compiler output.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, version } from 'esbuild';
const summaryPath = path.resolve(process.argv[2]);
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
assert.equal(summary.ok, true, 'Measure only the already accepted ordinary family assembly');
assert.equal(version, '0.25.12');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const report = {
  compilerBuild: summary.compilerBuild,
  tool: { esbuild: version, node: process.version },
  scope:
    'Three full authored family Button modules: 1 Base module and N=3 Base/Shadcn/Brutalist modules. Browser ESM production bundles retain their exported component APIs. Source bytes, retained uncompressed output and gzip bytes are different measurements. No historical baseline or speed comparison.',
  rows: [],
};
for (const row of summary.results) {
  const consumer = row.consumer;
  for (const n of [1, 3]) {
    const selected = row.families.slice(0, n),
      name = 'production-' + n;
    const entry = selected
      .map((family) => `export {${family.componentName}} from './generated/${family.sourcePath}';`)
      .join('\n');
    const built = await build({
      absWorkingDir: consumer,
      stdin: { contents: entry, resolveDir: consumer, sourcefile: name + '.ts', loader: 'ts' },
      outfile: path.join(consumer, name + '.js'),
      bundle: true,
      minify: true,
      treeShaking: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      define: { 'process.env.NODE_ENV': '"production"' },
      metafile: true,
      sourcemap: true,
      legalComments: 'eof',
    });
    save(path.join(consumer, name + '.metafile.json'), built.metafile);
    const output = Object.values(built.metafile.outputs).find((item) => item.entryPoint);
    const retained = Object.entries(output.inputs).map(([file, facts]) => ({
      path: file,
      bytesInOutput: facts.bytesInOutput,
      sourceBytes: built.metafile.inputs[file]?.bytes ?? 0,
      sha256:
        path.basename(file) === name + '.ts'
          ? hash(entry)
          : built.metafile.inputs[file]
            ? hash(readFileSync(path.resolve(consumer, file)))
            : null,
    }));
    const bytes = readFileSync(path.join(consumer, name + '.js'));
    report.rows.push({
      profile: row.profile,
      modules: n,
      sources: selected.map((family) => ({
        entry: family.entry,
        sourceGraphSha256: family.sourceGraphSha256,
      })),
      entrySha256: hash(entry),
      bundleSha256: hash(bytes),
      generatedInputSourceBytes: retained
        .filter((file) => file.path.startsWith('generated/'))
        .reduce((sum, file) => sum + file.sourceBytes, 0),
      supportInputSourceBytes: retained
        .filter((file) => file.path.startsWith('generated/.proto-ui/'))
        .reduce((sum, file) => sum + file.sourceBytes, 0),
      retainedProductionBytes: bytes.length,
      retainedGzipBytes: gzipSync(bytes, { level: 9 }).length,
      retainedSupportingBytes: retained
        .filter((file) => file.path.startsWith('generated/.proto-ui/'))
        .reduce((sum, file) => sum + file.bytesInOutput, 0),
      retainedInputs: retained,
    });
  }
  if (row.profile === 'react-dom-source-v1') {
    const imports = row.families
      .map((family) => `import {${family.componentName}} from './generated/${family.sourcePath}';`)
      .join('\n');
    const program = `import * as React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';${imports}
const components=[${row.families.map((f) => f.componentName).join(',')}];
export function mount(host,count){const refs=components.slice(0,count).map(()=>React.createRef());const root=createRoot(host);flushSync(()=>root.render(React.createElement(React.Fragment,null,...components.slice(0,count).map((Component,index)=>React.createElement(Component,{key:index,ref:refs[index],styleProfile:'vega'},'instance-'+index)))));return {handles:refs.map(ref=>ref.current.getExposes()),dispose(){flushSync(()=>root.unmount());}};}`;
    await build({
      absWorkingDir: consumer,
      stdin: {
        contents: program,
        resolveDir: consumer,
        sourcefile: 'production-owner.ts',
        loader: 'ts',
      },
      outfile: path.join(consumer, 'production-owner.js'),
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      define: { 'process.env.NODE_ENV': '"production"' },
      legalComments: 'eof',
    });
    const runtime = `import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';import {Window} from 'happy-dom';
const window=new Window({url:'http://production-observation.invalid'});for(const key of ['window','self','document','navigator','Node','Element','HTMLElement','SVGElement','Text','Comment','Event','CustomEvent','MouseEvent','KeyboardEvent','MutationObserver','DOMParser'])Object.defineProperty(globalThis,key,{value:key==='window'||key==='self'?window:window[key],configurable:true});
const {mount}=await import('./production-owner.js');const rows=[];
try{for(const count of [1,3]){const host=document.createElement('div');document.body.append(host);let observe;let timer;const ready=new Promise((resolve,reject)=>{observe=new MutationObserver(()=>{if(host.querySelectorAll('[data-pui-root]').length===count){observe.disconnect();clearTimeout(timer);resolve();}});observe.observe(host,{childList:true,subtree:true});timer=setTimeout(()=>{observe.disconnect();reject(new Error('Production owner did not commit within 20 seconds'));},20000);});const start=performance.now();const owner=mount(host,count);await ready;const initializationMs=performance.now()-start;assert.equal(host.querySelectorAll('[data-pui-root]').length,count);for(const handle of owner.handles)assert.equal(handle.disabled.get(),false);const teardown=performance.now();owner.dispose();for(let i=0;i<8;i++)await Promise.resolve();const cleanupMs=performance.now()-teardown;assert.equal(host.childNodes.length,0);for(const handle of owner.handles)assert.throws(()=>handle.disabled.get());host.remove();rows.push({componentModules:count,mountedOwnerCount:count,initializationMs,cleanupMs,rootNodesAfterCleanup:0,disposedHandlesRejected:count});}writeFileSync('production-owner-observations.json',JSON.stringify({scope:'Single observations of already-imported bundled production React owner mounts in Happy DOM, including native framework flush. Not browser layout latency, a performance budget, allocation accounting or a comparison with Adapter.',rows},null,2)+'\\n');}finally{await window.happyDOM.abort();window.close();}`;
    writeFileSync(path.join(consumer, 'production-owner-runtime.mjs'), runtime);
    const result = spawnSync(process.execPath, ['production-owner-runtime.mjs'], {
      cwd: consumer,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
      timeout: 60000,
    });
    writeFileSync(path.join(consumer, 'production-owner.stderr.log'), result.stderr ?? '');
    assert.equal(result.status, 0, result.stderr);
    report.initialization = JSON.parse(
      readFileSync(path.join(consumer, 'production-owner-observations.json'), 'utf8')
    );
  }
}
save(path.join(path.dirname(summaryPath), 'production-costs.json'), report);
console.log('RELEASE_FAMILY_COSTS', path.join(path.dirname(summaryPath), 'production-costs.json'));
