import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(process.argv[2]);
const tsmod = await import(pathToFileURL(path.join(root, 'node_modules/typescript/lib/typescript.js')));
const ts = tsmod.default ?? tsmod;
const { createHookSourceSummaryContext } = await import(pathToFileURL(path.join(root, 'packages/cli/dist/services/hook-source-summary.js')));
const file = path.join(root, 'packages/prototypes/shadcn/src/tabs/trigger.proto.ts');
const source = ts.createSourceFile(file, await fs.readFile(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const summary = createHookSourceSummaryContext();
summary.registerSource(source);
const simplify = (v, depth = 0) => {
 if (!v || depth > 3) return v?.kind;
 if (v.kind === 'unknown') return v;
 if (v.kind === 'state') return {kind:v.kind,state:v.state};
 if (v.kind === 'result') return {kind:v.kind,name:v.name,producer:v.producer,stateHandlesClosed:v.stateHandlesClosed,stateHandles:[...v.stateHandles],children:[...v.children].map(([k,v])=>[k,simplify(v,depth+1)]),handle:simplify(v.handle,depth+1)};
 if (v.kind === 'object') return {kind:v.kind,uncertainKeys:v.uncertainKeys,closed:v.closed,members:[...v.members].map(([k,v])=>[k,simplify(v,depth+1)])};
 return {kind:v.kind};
};
const nodes=[];
function visit(n){
 if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&['asTabsTrigger','setupTabsVisual'].includes(n.expression.text))nodes.push(n);
 if(ts.isPropertyAccessExpression(n)&&n.name.text==='stateHandles')nodes.push(n);
 if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='state'&&n.arguments[0]&&ts.isIdentifier(n.arguments[0])&&['selected','focusVisible','style','orientation','variant'].includes(n.arguments[0].text)&&!nodes.some(x=>ts.isIdentifier(x)&&x.text===n.arguments[0].text))nodes.push(n.arguments[0]);
 ts.forEachChild(n,visit);
}
visit(source);
const records=nodes.map(n=>{const r=summary.resolve(n,source);return {expression:n.getText(source),line:source.getLineAndCharacterOfPosition(n.getStart(source)).line+1,matched:r.matched,hook:r.hook,value:simplify(r.value)};});
console.log(JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,records},null,2));
