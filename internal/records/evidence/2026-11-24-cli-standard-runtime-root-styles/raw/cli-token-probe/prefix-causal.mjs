import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]);
const tm=await import(pathToFileURL(path.join(root,'node_modules/typescript/lib/typescript.js')));
const ts=tm.default??tm;
const {createHookSourceSummaryContext}=await import(pathToFileURL(path.join(root,'packages/cli/dist/services/hook-source-summary.js')));
const file=path.join(root,'packages/prototypes/shadcn/src/tabs/trigger.proto.ts');
const original=await fs.readFile(file,'utf8');
const parse=text=>ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const initial=parse(original);let setup;
function find(n){if(ts.isMethodDeclaration(n)&&n.name.getText(initial)==='setup'&&n.body)setup=n;ts.forEachChild(n,find);}
find(initial);const first=setup.body.statements[0],second=setup.body.statements[1];
if(!first.getText(initial).startsWith('def.props.define(')||!second.getText(initial).startsWith('def.props.setDefaults('))throw Error('Unexpected original prefix');
const replacements={actual:original.slice(first.pos,second.end),no_props_prefix:'',define_only:first.getText(initial),defaults_only:second.getText(initial),empty_define:'def.props.define({});',unknown_call:'unprovedPrefix();'};
const out=[];
for(const [label,prefix] of Object.entries(replacements)){
 const source=parse(original.slice(0,first.pos)+'\n'+prefix+'\n'+original.slice(second.end));
 const context=createHookSourceSummaryContext();context.registerSource(source);let target;
 function scan(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='asTabsTrigger')target=n;ts.forEachChild(n,scan);}
 scan(source);const result=context.resolve(target,source),value=result.value;
 out.push({label,matched:result.matched,kind:value.kind,reason:value.reason,producerName:value.name,stateNames:value.stateHandles?[...value.stateHandles.keys()]:null});
}
console.log(JSON.stringify({kind:'virtual-source causal probe; not candidate mutation or acceptance',results:out},null,2));
