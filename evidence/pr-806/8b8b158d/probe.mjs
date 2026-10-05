import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repoRoot = path.resolve(process.argv[2] ?? process.cwd());
if (!process.argv[3]) throw new Error('Pass the directory containing the statically downloaded sources as argument 3');
const sourceRoot = path.resolve(process.argv[3]);
const outputRoot = path.resolve(process.argv[4] ?? process.cwd());
fs.mkdirSync(outputRoot, { recursive: true });
const { inspectGraph } = await import(pathToFileURL(path.join(repoRoot, 'experiments/effect-graph/validate-model.mjs')));
const { getInterfaceFacts } = await import(pathToFileURL(path.join(repoRoot, 'experiments/effect-graph/interface-facts.mjs')));
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root=path.join(repoRoot, 'experiments/effect-graph')+path.sep;
const load=name=>JSON.parse(fs.readFileSync(root+name+'.json'));
const report={checks:[],positives:[],allowedNoops:[],allowedSubsetChoices:[],badAccepts:[],crashes:[],rejections:0};
for(const source of JSON.parse(fs.readFileSync(new URL('./sources.json', import.meta.url)))){
 const bytes=fs.readFileSync(path.join(sourceRoot, source.repo, source.path));
 const hash=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 assert.equal(hash,source.gitBlob); assert.equal(bytes.length,source.bytes);
 report.checks.push({source:source.path,blob:hash});
}
const prose=p=>p[0]==='purpose'||p[0]==='caveats'||p.at(-1)==='obligation'||(p[0]==='featurePreconditions'&&p.at(-1)==='reason')||(p[0]==='coordinateMapping'&&['geometryBounds','geometrySize','matteRasterDpr','source'].includes(p[1]));
for(const name of ['studio','flutter']){
 const base=load(name), paths=[];
 const walk=(v,p=[])=>{if(p.length&&!prose(p))paths.push(p);if(v&&typeof v==='object')for(const[k,c]of Object.entries(v))if(!prose([...p,k]))walk(c,[...p,k]);};walk(base);
 for(const path of paths)for(const val of ['DELETE',null,{},[]]){
  const g=structuredClone(base);let obj=g;for(const k of path.slice(0,-1))obj=obj[k];
  if(val==='DELETE'){if(Array.isArray(obj))obj.splice(+path.at(-1),1);else delete obj[path.at(-1)];}else obj[path.at(-1)]=val;
  try {const r=inspectGraph(g);if(r.valid){const item={name,path:path.join('.'),operation:val};if(JSON.stringify(g)===JSON.stringify(base))report.allowedNoops.push(item);else if(name==='studio'&&path[0]==='sources'&&path[2]==='sourceKinds'&&val==='DELETE'&&path.length===4)report.allowedSubsetChoices.push(item);else report.badAccepts.push(item);}else report.rejections++;assert.equal(r.execution,'not-admitted');}catch(error){report.crashes.push({name,path:path.join('.'),operation:val,error:error.stack});}
 }
 // All admissible pass ceilings and allowed source subsets, including simultaneous reordering.
 for(let cap=(name==='studio'?4:2);cap<=8;cap++)for(const kinds of name==='studio'?[['owned-image'],['owned-video-frame'],['owned-video-frame','owned-image']]:[null]){
  const g=load(name);g.limits.passes=cap;if(kinds)g.sources[0].sourceKinds=kinds;
  for(const k of ['kernels','sources','resources','data','passes','uniformBlocks','frameInputs','requirements','featurePreconditions','variants'])g[k]?.reverse();
  for(const p of g.passes){p.reads.reverse();p.dependsOn.reverse();p.uniformBlocks.reverse();}
  for(const k of g.kernels){k.uniformBlocks.reverse();k.dataBindings.reverse();if(k.samplerBinding==='named')k.samplers.reverse();if(typeof k.invalidation==='object')k.invalidation.dependencies.reverse();}
  for(const b of g.uniformBlocks){b.reservedAutoInputs?.reverse();if(b.abi==='wgsl-uniform-buffer')b.fields.reverse();}
  for(const r of g.resources){r.usages?.reverse();r.coordinateBindings?.reverse();}
  assert.equal(inspectGraph(g).valid,true,JSON.stringify({name,cap,kinds,result:inspectGraph(g)}));report.positives.push({name,cap,kinds});
 }
}
fs.writeFileSync(path.join(outputRoot, 'probe-results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({hashVerified:report.checks.length,positiveCases:report.positives.length,allowedNoops:report.allowedNoops.length,allowedSubsetChoices:report.allowedSubsetChoices.length,rejected:report.rejections,badAccepts:report.badAccepts,crashes:report.crashes.map(c=>({...c,error:c.error.split('\n')[0]}))},null,2));
