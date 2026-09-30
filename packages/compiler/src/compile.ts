import { open, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import { parsePrototype } from './parser';
import { emitReact } from './react';
import { emitReactSource } from './react-source';
import { emitVueSource } from './vue-source';
import { emitVue2Source } from './vue2-source';
import { emitWebComponentSource } from './web-component-source';
import { resolveTargetProfile, checkTargetOperations, type TargetSelection } from './targets';
import { writeArtifactSet, type ExclusiveOutputFile, type OutputArtifact } from './artifact-output';
import { isLocalSourceSpecifier, resolveLocalSource, runtimeSourceEdges, sourceName } from './source-resolution';
import { CompilerRejection } from './diagnostics';
import { attachEmitterMap, generatedSourcePath } from './emitter-map';
import type { CompileResult, GeneratedModule, ParseOptions, PrototypeIR, SourceSpan } from './ir';

export type { ExclusiveOutputFile } from './artifact-output';
export interface Compilation { ir: PrototypeIR; output: GeneratedModule }
export interface CompileOptions extends ParseOptions {
  componentName?: string;
  profile?: string | TargetSelection;
}
export interface FileCompileOptions {
  root?: string;
  exportName?: string;
  componentName?: string;
  profile?: string | TargetSelection;
  /** Closed, already-read source input used by project compilation; no second filesystem read. */
  sourceSnapshot?: { entry: string; files: Readonly<Record<string,string>> };
}

export function compilePrototype(source: string, options: CompileOptions = {}): CompileResult<Compilation> {
  const parsed = parsePrototype(source, options);
  if (!parsed.ok) return parsed;
  const profile = resolveTargetProfile(options.profile ?? 'react-runtime-v1');
  if (!profile.ok) return profile;
  const admitted = checkTargetOperations(parsed.value, profile.value);
  if (!admitted.ok) return admitted;
  let emitted: CompileResult<GeneratedModule>;
  const emitOptions = { componentName: options.componentName };
  switch (profile.value.id) {
    case 'react-runtime-v1': emitted = emitReact(parsed.value, emitOptions); break;
    case 'react-dom-source-v1': emitted = emitReactSource(parsed.value, emitOptions); break;
    case 'vue-source-v1': emitted = emitVueSource(parsed.value, emitOptions); break;
    case 'vue2-source-v1': emitted = emitVue2Source(parsed.value, emitOptions); break;
    case 'web-component-source-v1': emitted = emitWebComponentSource(parsed.value, { className: options.componentName }); break;
    default: return {ok:false,diagnostics:[{code:'PUI4001',category:'unsupported-input',message:`No emitter is implemented for ${profile.value.id}.`,span:parsed.value.setup.span}]};
  }
  if (!emitted.ok) return emitted;
  try {
    return {ok:true,value:{ir:parsed.value,output:attachEmitterMap(emitted.value,parsed.value)}};
  } catch (error) {
    return {ok:false,diagnostics:[{code:'PUI3005',category:'compiler-defect',message:`Emitter source mapping failed: ${error instanceof Error ? error.message : String(error)}`,span:parsed.value.setup.span}]};
  }
}

/** Parse only files inside the declared root. Input source is never imported or evaluated. */
export async function compileFile(entry: string, options: FileCompileOptions = {}): Promise<CompileResult<Compilation>> {
  const fallback: SourceSpan = {file:'<input>',start:0,end:0,line:1,column:1,endLine:1,endColumn:1};
  try {
    if (options.sourceSnapshot) {
      const fileName = sourceName(options.sourceSnapshot.entry);
      const source = options.sourceSnapshot.files[fileName];
      if (typeof source !== 'string') throw new Error(`Closed source snapshot has no entry ${fileName}.`);
      return compilePrototype(source, {fileName,files:options.sourceSnapshot.files,exportName:options.exportName,componentName:options.componentName,profile:options.profile});
    }
    const root = await realpath(options.root ?? process.cwd());
    const files: Record<string,string> = Object.create(null);
    async function load(filename: string): Promise<string> {
      const absolute = await realpath(filename);
      const relative = path.relative(root,absolute).split(path.sep).join('/');
      const identity = sourceName(relative);
      if (Object.hasOwn(files,identity)) return identity;
      const content = await readFile(absolute,'utf8');
      files[identity] = content;
      const sourceFile = ts.createSourceFile(identity,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
      for (const edge of runtimeSourceEdges(sourceFile)) {
        if (!isLocalSourceSpecifier(edge.specifier)) continue;
        const target = await resolveLocalSource(root,identity,edge.specifier);
        await load(path.join(root,target));
      }
      return identity;
    }
    const fileName = await load(path.isAbsolute(entry) ? entry : path.resolve(root,entry));
    return compilePrototype(files[fileName], {fileName,files,exportName:options.exportName,componentName:options.componentName,profile:options.profile});
  } catch (error) {
    if (error instanceof CompilerRejection) return {ok:false,diagnostics:[error.diagnostic]};
    return {ok:false,diagnostics:[{code:'PUI1003',category:'invalid-input',message:error instanceof Error ? error.message:String(error),span:fallback}]};
  }
}

/** Create-only artifact publication; never overwrite user source or mutate consumer manifests. */
export async function writeCompilation(compilation: Compilation, directory: string,
  openExclusive: (filename:string) => Promise<ExclusiveOutputFile> = (filename) => open(filename,'wx')): Promise<CompileResult<{directory:string;files:string[]}>> {
  const output = compilation.output;
  const sourceFile = generatedSourcePath(output.profile);
  const sourceContents = output.sourceMap ? output.code + `\n//# sourceMappingURL=${sourceFile}.map\n` : output.code;
  const artifacts: OutputArtifact[] = [{path:sourceFile,contents:sourceContents,kind:'source'}];
  for (const file of output.supportingFiles ?? []) artifacts.push(file);
  if (output.sourceMap) artifacts.push({path:`${sourceFile}.map`,contents:JSON.stringify(output.sourceMap)+'\n',kind:'source-map'});
  artifacts.push({path:'provenance.json',kind:'manifest',contents:JSON.stringify({
    ...output.provenance,profile:output.profile,dependencies:output.dependencies,
    sourceFiles:compilation.ir.sourceFiles.map((file) => ({file:file.file,sha256:file.sha256})),
    generatedSha256:createHash('sha256').update(sourceContents).digest('hex'),
    artifacts:artifacts.map((file) => ({path:file.path,kind:file.kind,sha256:createHash('sha256').update(file.contents).digest('hex')})),
  },null,2)+'\n'});
  return writeArtifactSet(artifacts,directory,openExclusive);
}
