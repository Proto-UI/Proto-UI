import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { runCommand, startOwnedPreview, vitestProblems } from 'file:///var/tmp/proto-ui-native-456f/scripts/test/sprint3-consumer-evidence.mjs';
import { suiteOrigins } from 'file:///var/tmp/proto-ui-native-456f/scripts/test/sprint3-source-server.mjs';
const root='/var/tmp/proto-ui-native-456f';
const out='/var/tmp/proto-ui-native-evidence-456f/production-base-tooltip8-attempt02';
const expected='cd684a20ba60c1f382c88eeaea5b25eb29a0f6c5';
const file='apps/www/src/content/docs/zh-cn/demo-base-tooltip.browser.test.ts';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=(name,value)=>writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
mkdirSync(out,{recursive:true});mkdirSync(path.join(out,'tmp'),{recursive:true});
const env={...process.env,TMPDIR:'/var/tmp/pui456f-prod8',NODE_OPTIONS:'--max-old-space-size=4096',NO_COLOR:'1',ASTRO_TELEMETRY_DISABLED:'1',CHROME_PATH:'/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/tools/playwright-browsers/chromium-1208/chrome-linux64/chrome'};
const source={head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),trackedStatus:git('status','--porcelain','--untracked-files=no'),lockSha256:hash(readFileSync(path.join(root,'pnpm-lock.yaml'))),node:process.version,pnpm:execFileSync('corepack',['pnpm@10.32.1','--version'],{env,encoding:'utf8'}).trim(),chrome:execFileSync(env.CHROME_PATH,['--version'],{encoding:'utf8'}).trim(),runnerSha256:hash(readFileSync(import.meta.filename)),nativeTestSha256:hash(readFileSync(path.join(root,file)))};
json('source.json',source);
const ledger={head:expected,startedAt:new Date().toISOString(),scope:'One complete unchanged eight-case public Base Tooltip file on an owned production build; not the complete Sprint 3 profile.',source,cliBuild:null,docsBuild:null,preview:null,native:null,problems:[]};
let preview;
const okay=r=>r.exitCode===0&&!r.stopReason&&!r.ioError&&!r.spawnError;
const unchanged=()=>{assert.equal(git('rev-parse','HEAD'),expected);assert.equal(git('status','--porcelain','--untracked-files=no'),'');};
function inventory(base,dir=base,rows=[]){for(const name of readdirSync(dir).sort()){const f=path.join(dir,name);const s=lstatSync(f);assert(!s.isSymbolicLink(),'Generated output contains a symlink');if(s.isDirectory())inventory(base,f,rows);else{assert(s.isFile());rows.push({path:path.relative(base,f).split(path.sep).join('/'),bytes:s.size,sha256:hash(readFileSync(f))});}}return rows;}
try{
 assert.equal(source.head,expected);assert.equal(source.trackedStatus,'');assert.equal(source.pnpm,'10.32.1');
 const prior='/var/tmp/proto-ui-native-evidence-456f/production-base-tooltip8';
 const build=JSON.parse(readFileSync(path.join(prior,'terminal.json'),'utf8'));
 assert.equal(build.head,expected);assert(okay(build.cliBuild));assert(okay(build.docsBuild));assert.equal(build.headAfter,expected);assert.equal(build.trackedStatusAfter,'');
 ledger.cliBuild={...build.cliBuild,reusedFrom:path.join(prior,'cli-build.log')};ledger.docsBuild={...build.docsBuild,reusedFrom:path.join(prior,'docs-build.log')};
 ledger.controlledChange='Only TMPDIR uses a shorter owned /var/tmp path. The first browser launch failed with SIGTRAP; a controlled long/short-path probe reproduced failure/success. Original test source, sandbox and timeouts are unchanged. The successful original production output is reused after a complete file-hash inventory equality check.';
 unchanged();
 const dist=path.join(root,'apps/www/dist');const before=inventory(dist);assert(before.length>0);assert.deepEqual(before,JSON.parse(readFileSync(path.join(prior,'dist-files.json'),'utf8')));json('dist-files.json',before);const manifestHash=hash(JSON.stringify(before));
 preview=await startOwnedPreview(dist,expected,path.join(out,'preview-requests.jsonl'));
 const route='/en/ui-libraries/base/tooltip/';
 const response=await fetch(preview.url+route,{signal:AbortSignal.timeout(10000)});const body=Buffer.from(await response.arrayBuffer());
 assert.equal(response.status,200);assert.equal(response.headers.get('x-proto-ui-evidence-source'),expected);
 assert.equal(hash(body),hash(readFileSync(path.join(dist,route,'index.html'))));
 ledger.preview={owner:'This bounded runner and its exclusive loopback listener',head:expected,origin:preview.url,probePath:route,probeSha256:hash(body),distManifestSha256:manifestHash};
 const evidence=path.join(out,'captures');mkdirSync(evidence,{recursive:true});
 const suiteEnv=suiteOrigins({...env,PROTO_UI_RUNTIME_EVIDENCE_DIR:evidence},{id:'public-base-tooltip',surface:'production-docs'},preview.url);
 ledger.native=await runCommand('corepack',['pnpm@10.32.1','exec','vitest','run',file,'--maxWorkers=1','--minWorkers=1','--reporter=default','--reporter=json','--outputFile='+path.join(out,'vitest.json')],{cwd:root,env:suiteEnv,log:path.join(out,'native.log'),timeoutMs:300000,quiet:true});
 const report=JSON.parse(readFileSync(path.join(out,'vitest.json'),'utf8'));ledger.counts=Object.fromEntries(['success','numTotalTests','numPassedTests','numFailedTests','numPendingTests'].map(k=>[k,report[k]]));
 ledger.problems.push(...vitestProblems(report,8,file));assert(okay(ledger.native),'Native producer failed or interrupted');assert.equal(ledger.problems.length,0,'Complete native case validation failed');
 assert.equal(hash(JSON.stringify(inventory(dist))),manifestHash,'Production bytes changed during browser execution');unchanged();
 ledger.result='passed';
}catch(e){ledger.result='failed';ledger.problems.push(e.stack||String(e));process.exitCode=1;}
finally{
 if(preview){try{await preview.close();ledger.previewRetired=true;}catch(e){ledger.result='failed';ledger.problems.push(String(e));process.exitCode=1;}}
 ledger.headAfter=git('rev-parse','HEAD');ledger.trackedStatusAfter=git('status','--porcelain','--untracked-files=no');ledger.finishedAt=new Date().toISOString();json('terminal.json',ledger);
 console.log(JSON.stringify({head:ledger.head,result:ledger.result,counts:ledger.counts,problems:ledger.problems,previewRetired:ledger.previewRetired,headAfter:ledger.headAfter,trackedStatusAfter:ledger.trackedStatusAfter}));
}
