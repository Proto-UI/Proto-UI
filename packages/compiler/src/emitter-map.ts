import { buildSourceMap, type SourceMapMapping } from './source-map';
import type { GeneratedModule, PrototypeIR, SourceSpan } from './ir';

export function generatedSourcePath(profile: GeneratedModule['profile']): string {
  if (profile === 'vue2-source-v1') return 'Component.js';
  if (profile === 'vue-source-v1' || profile === 'web-component-source-v1') return 'Component.ts';
  return 'Component.tsx';
}

/** Emitted origins annotate actual statement starts, not compiler-created boilerplate. */
export function attachEmitterMap(output: GeneratedModule, ir: PrototypeIR): GeneratedModule {
  const mappings: SourceMapMapping[] = [];
  const sources = new Map(ir.sourceFiles.map((file) => [file.file, file.content]));
  const lines = output.code.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const marker = /^\s*\/\/ Source ("(?:[^"\\]|\\.)+"):(\d+):(\d+)\s*$/.exec(lines[index]);
    if (!marker) continue;
    const file = JSON.parse(marker[1]) as string;
    const line = Number(marker[2]), column = Number(marker[3]);
    const content = sources.get(file);
    if (content === undefined) throw new TypeError(`Emitter origin is outside the source graph: ${file}`);
    const originalLines = content.split('\n');
    let offset = 0;
    for (let original = 0; original < line - 1; original++) offset += originalLines[original].length + 1;
    offset += column - 1;
    const source: SourceSpan = { file, start: offset, end: offset, line, column, endLine: line, endColumn: column };
    const generated = index + 1;
    if (generated >= lines.length || !lines[generated].trim()) continue;
    mappings.push({ generatedLine: generated + 1, generatedColumn: lines[generated].length - lines[generated].trimStart().length + 1, source });
  }
  const file = generatedSourcePath(output.profile);
  return {
    ...output,
    code: output.code.replace(/\n?\/\/\# sourceMappingURL=.*\s*$/, ''),
    sourceMap: buildSourceMap({ file, sources: ir.sourceFiles.map((source) => ({path:source.file,content:source.content})), mappings }),
  };
}
