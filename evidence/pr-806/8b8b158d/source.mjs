import fs from 'node:fs';import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repoRoot = path.resolve(process.argv[2] ?? process.cwd());
if (!process.argv[3]) throw new Error('Pass the directory containing the statically downloaded sources as argument 3');
const sourceRoot = path.resolve(process.argv[3]);
const outputRoot = path.resolve(process.argv[4] ?? process.cwd());
fs.mkdirSync(outputRoot, { recursive: true });
const { inspectGraph } = await import(pathToFileURL(path.join(repoRoot, 'experiments/effect-graph/validate-model.mjs')));
const { getInterfaceFacts } = await import(pathToFileURL(path.join(repoRoot, 'experiments/effect-graph/interface-facts.mjs')));
const source=sourceRoot+path.sep;
const studio=getInterfaceFacts('studio-f7b28c3-four-pass-v1'),flutter=getInterfaceFacts('flutter-c35d7e1-live-v1');
const text=(repo,p)=>fs.readFileSync(source+repo+'/'+p,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
let uniforms=0,samplers=0;
for(const kernel of studio.assertions.kernels){
 const src=text(kernel.upstream.repo,kernel.upstream.path),body=src.match(/struct \w*Uniforms\s*\{([\s\S]*?)\}/)?.[1];assert(body);
 let offset=0,maxAlignment=1;
 const fields=[...body.matchAll(/(\w+)\s*:\s*(f32|i32|u32|vec[234]f)\s*,/g)].map(([,name,type])=>{const n=type.startsWith('vec')?+type[3]:1;const bytes=4*n,alignment=n===3?16:bytes;offset=Math.ceil(offset/alignment)*alignment;const field={name,type,offset,bytes};offset+=bytes;maxAlignment=Math.max(maxAlignment,alignment);return field;});
 const expected=studio.assertions.uniformBlocks.find(b=>b.id===kernel.uniformBlocks[0]);
 if(kernel.id==='bg'){assert.equal(fields.at(-1).name,studio.declarationViews.backgroundFinalField.name);assert.equal(fields.at(-1).offset,156);fields.at(-1).name='u_refDistance';}
 assert.deepEqual(fields,expected.fields);assert.equal(Math.ceil(offset/maxAlignment)*maxAlignment,expected.bytes);uniforms+=fields.length;
 const textures=[...src.matchAll(/var (\w+)\s*:\s*texture_2d<f32>/g)].map(m=>m[1]).sort();assert.deepEqual(textures,kernel.samplers.map(s=>s.name).sort());samplers+=textures.length;
}
for(const kernel of flutter.assertions.kernels){
 let cursor=0;const src=text(kernel.upstream.repo,kernel.upstream.path),blocks=flutter.assertions.uniformBlocks.find(b=>b.id===kernel.id);
 const fields=[...src.matchAll(/uniform\s+(float|vec[234])\s+(\w+)(?:\[([^\]]+)\])?\s*;/g)].map(([,type,name,array])=>{const count=array?array.replace('MAX_SHAPES','16').split('*').map(s=>+s.trim()).reduce((a,b)=>a*b,1):undefined;const width=type==='float'?1:+type[3],size=width*(count??1);const field={name,type:type==='float'?'f32':`${type}<f32>`,...(count===undefined?{}:{count}),floatSlotRange:{start:cursor,count:size}};cursor+=size;return field;});
 assert.deepEqual(fields,blocks.fields.map(({binding,...f})=>f));assert.equal(cursor,blocks.floatSlotCount);uniforms+=fields.length;
 const names=[...src.matchAll(/uniform\s+sampler2D\s+(\w+)\s*;/g)].map(m=>m[1]);assert.deepEqual(names,kernel.samplers.map(s=>s.name));samplers+=names.length;
}
const load=n=>JSON.parse(fs.readFileSync(path.join(repoRoot, 'experiments/effect-graph', n+'.json')));
const cases=[];const negative=(name,label,mutate)=>{const g=load(name);mutate(g);const r=inspectGraph(g);assert.equal(r.valid,false,label);assert.equal(r.execution,'not-admitted');cases.push({name,label,codes:[...new Set(r.errors.map(x=>x.code))]});};
negative('studio','Correlated whole-graph resource renaming',g=>{const s=JSON.stringify(g).replaceAll('vertical-blur','replacement-blur');Object.assign(g,JSON.parse(s));});
negative('flutter','Correlated all frame-producer renaming',g=>{for(const input of g.frameInputs){const old=input.id;input.id='alternate-'+old;for(const block of g.uniformBlocks)for(const f of block.fields)if(f.binding?.id===old)f.binding.id=input.id;}});
negative('flutter','Indexed samplers reversed with old slots',g=>g.kernels[1].samplers.reverse());
negative('flutter','Indexed samplers reversed and reindexed consistently',g=>{g.kernels[1].samplers.reverse();g.kernels[1].samplers.forEach((s,i)=>s.slot=i);g.sources[0].reservedSampler=1;g.featurePreconditions.find(x=>x.mode==='host-required').requiredHostSamplers.uBackgroundTexture=1;});
negative('flutter','Reflected uniform order reversed then slots reallocated',g=>{for(const b of g.uniformBlocks){b.fields.reverse();let pos=0;for(const f of b.fields){f.floatSlotRange.start=pos;pos+=f.floatSlotRange.count;}}});
negative('flutter','Correlated source and ownership downgrade',g=>{g.sources[0].kind='application-owned-captured-texture';delete g.sources[0].reservedSampler;g.kernels[1].samplers[0]={name:'uBackgroundTexture',ownership:'application-bound',resource:'backdrop',resourceKind:'application-owned-captured-texture',slot:0};g.uniformBlocks[1].reservedAutoInputs=['uSize'];g.featurePreconditions[1].requiredHostSamplers={};});
negative('studio','JSON __proto__ unknown graph execution field',g=>Object.defineProperty(g,'__proto__',{value:{execution:'admitted'},enumerable:true,configurable:true,writable:true}));
negative('flutter','Unknown runtime field under allowed prose container',g=>{g.resources[0].colorSpace.runtime='linear';});
negative('studio','Correlated false capability claim',g=>{g.requirements=['arbitrary-admission'];g.passes.forEach(p=>p.capabilities=['arbitrary-admission']);});
const result={sourceUniformDeclarations:uniforms,sourceTextureSamplers:samplers,correlatedCases:cases};fs.writeFileSync(path.join(outputRoot, 'source-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
