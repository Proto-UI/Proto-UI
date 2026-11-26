import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { globSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root='/var/tmp/proto-ui-portal-evidence-456f';
const out='/var/tmp/proto-ui-native-evidence-456f/portal-current-union/tooltip-timing-probe';
mkdirSync(out,{recursive:false});process.chdir(root);
const require=createRequire(path.join(root,'apps/www/package.json'));
const {build}=require('esbuild');const {chromium}=require('playwright-core');
const {collectProtoStyleTokensFromFiles}=await import(pathToFileURL(path.join(root,'packages/cli/src/services/prototype-style-tokens.ts')).href);
const {renderProtoStyleTokenCss}=await import(pathToFileURL(path.join(root,'packages/cli/src/services/proto-style-css.ts')).href);
const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const head=git('rev-parse','HEAD');if(head!=='4f8c56486825afbb563c3aa159c7ad76a1d3d82a'||git('status','--porcelain'))throw Error('source drift');
const sourceFiles=[...globSync('packages/prototypes/{base,shadcn,brutalist}/src/{button,toggle,toggle-group,label,tooltip,drawer}/**/*.ts')];
const tokens=(await collectProtoStyleTokensFromFiles(sourceFiles)).filter((x:unknown)=>typeof x==='string');
const css=renderProtoStyleTokenCss(tokens);
const built=await build({entryPoints:['apps/www/test/fixtures/component-consumer-repairs.ts'],bundle:true,write:false,platform:'browser',format:'iife',globalName:'componentRepairs',target:'es2022',metafile:true,define:{'process.env.NODE_ENV':'"development"'}});
const bundle=built.outputFiles[0].text;
const files=[...sourceFiles,'apps/www/test/fixtures/component-consumer-repairs.ts',...Object.keys(built.metafile.inputs).filter((p)=>!p.includes('node_modules/')),'pnpm-lock.yaml','apps/www/package.json','apps/www/test/component-consumer-repairs.browser.test.ts'];
const source={head,tree:git('rev-parse','HEAD^{tree}'),source:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),bundleSha256:createHash('sha256').update(bundle).digest('hex'),scope:'Diagnostic observation of the original Base React Tooltip case prefix. Original acceptance file is unchanged. Observations after the original assertion point are additional diagnosis, not replacements for it.'};
writeFileSync(path.join(out,'source.json'),JSON.stringify(source,null,2)+'\n');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,chromiumSandbox:true});
const attempts:any[]=[];
try {
 for(let n=1;n<=10;n++){
  const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
  await page.route('**/*',(r:any)=>r.abort());await page.setContent('<!doctype html><html><head></head><body></body></html>');
  const styleText=css+'\nhtml{font-size:16px}body{margin:0;font:16px system-ui} [data-demo-ref="button"],[data-demo-ref="trigger"],[data-demo-ref="toggle"],[data-demo-ref="item"]{display:inline-flex;padding:12px;margin:8px} [data-demo-ref$="-label"]{display:inline-block;margin:8px} [data-demo-ref="content"]{background:white;color:black} [data-demo-ref="handle"]{display:block;min-width:20px;min-height:40px}';
  await page.addStyleTag({content:styleText});await page.addScriptTag({content:bundle});
  await page.evaluate(async(styleText:string)=>{(window as any).repairFixture=await(window as any).componentRepairs.mount('tooltip','base','react',{styleText});},styleText);
  await page.evaluate(()=>{
   const w=window as any;const nodes=new WeakMap<Element,number>();let next=1;const key=(node:Element|null)=>{if(!node)return null;if(!nodes.has(node))nodes.set(node,next++);return nodes.get(node);};
   const snapshot=(reason:string)=>{const c=document.querySelector('[data-demo-ref="content"]');const b=document.querySelector('[data-demo-ref="button"]');return {reason,time:performance.now(),open:w.repairFixture.exposes('root').open.get(),contentNode:key(c),contentId:c?.getAttribute('id')??null,contentHtml:c?.outerHTML??null,description:b?.getAttribute('aria-describedby')??null,active:document.activeElement?.getAttribute('data-demo-ref')??null};};
   w.tooltipTrace=[];w.tooltipSnapshot=(reason:string)=>{const s=snapshot(reason);w.tooltipTrace.push(s);return s;};
   w.tooltipObserver=new MutationObserver((records)=>w.tooltipSnapshot('mutation:'+records.map(r=>r.type+':'+(r.attributeName??'')).join(',')));
   w.tooltipObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['id','aria-describedby','data-pui-view-pending','data-pui-view-detached']});
   w.tooltipSnapshot('mounted');
  });
  await page.locator('[data-demo-ref="before"]').focus();await page.keyboard.press('Tab');
  const active=await page.evaluate(()=>document.activeElement?.getAttribute('data-demo-ref'));
  await page.waitForFunction(()=>(window as any).repairFixture.exposes('root').open.get());
  const buttons=await page.getByRole('button',{name:'Save',exact:true}).count();
  const contentId=await page.locator('[data-demo-ref="content"]').getAttribute('id');
  const originalBoundary=await page.evaluate(()=>(window as any).tooltipSnapshot('original-id-assertion-point'));
  const description=await page.locator('[data-demo-ref="button"]').getAttribute('aria-describedby');
  await page.evaluate(async()=>{for(let i=0;i<3;i++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));(window as any).tooltipSnapshot('diagnostic-next-frame-'+(i+1));}(window as any).tooltipObserver.disconnect();});
  const trace=await page.evaluate(()=>(window as any).tooltipTrace);
  const result={attempt:n,active,buttons,contentId,description,originalAssertionPass:!!contentId&&description===contentId,originalBoundary,trace,errors};attempts.push(result);
  writeFileSync(path.join(out,'attempt-'+String(n).padStart(2,'0')+'.json'),JSON.stringify(result,null,2)+'\n');
  await page.close();
 }
} finally {await browser.close();}
if(git('rev-parse','HEAD')!==head||git('status','--porcelain'))throw Error('source drift after');
const summary={head,attempts:attempts.map(({attempt,active,buttons,contentId,description,originalAssertionPass,trace,errors})=>({attempt,active,buttons,contentId,description,originalAssertionPass,errors,trace:trace.map(({reason,time,open,contentNode,contentId,description})=>({reason,time,open,contentNode,contentId,description}))}))};
writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
