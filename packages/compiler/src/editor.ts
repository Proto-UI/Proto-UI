import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { analyzeProtoProgram, createProtoProgram } from './frontend/index.ts';
import type { CompilerTarget } from './index.ts';

/** A transport-neutral editor snapshot. No second lint implementation lives here. */
export interface ProtoEditorInput {
  fileName: string;
  text: string;
  rootNames?: readonly string[];
  sourceOverrides?: Readonly<Record<string, string>>;
  project?: string;
  compilerOptions?: ts.CompilerOptions;
  currentDirectory?: string;
  target?: CompilerTarget;
}

export interface ProtoEditorDiagnostic {
  uri?: string;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: 1 | 2 | 3;
  code: string;
  source: 'proto';
  message: string;
  data: {
    category: string;
    criterion: readonly string[];
    analysisComplete: boolean;
    sourceValid: boolean | null;
  };
}

/**
 * Analyze unsaved text through the same Program/checker and rules as the CLI.
 * Ranges use zero-based UTF-16 editor positions, not language text-index semantics.
 * Project-level diagnostics without a source location remain in the result.
 */
export function analyzeProtoDocument(input: ProtoEditorInput) {
  const cwd = input.currentDirectory ?? process.cwd();
  const fileName = path.resolve(cwd, input.fileName);
  const sourceOverrides = { ...input.sourceOverrides, [fileName]: input.text };
  const program = createProtoProgram({
    rootNames: [...new Set([...(input.rootNames ?? []), fileName])],
    project: input.project,
    compilerOptions: input.compilerOptions,
    currentDirectory: cwd,
    sourceOverrides,
  });
  const analysis = analyzeProtoProgram(program, { target: input.target });
  const diagnostics: ProtoEditorDiagnostic[] = analysis.diagnostics.map((diagnostic) => {
    const location = diagnostic.location;
    const source = location && program.getSourceFile(location.file);
    let range: ProtoEditorDiagnostic['range'];
    if (location && source) {
      const start = source.getPositionOfLineAndCharacter(location.line - 1, location.column - 1);
      const end = Math.min(source.text.length, start + location.length);
      range = {
        start: source.getLineAndCharacterOfPosition(start),
        end: source.getLineAndCharacterOfPosition(end),
      };
    }
    return {
      ...(location ? { uri: pathToFileURL(location.file).href } : {}),
      ...(range ? { range } : {}),
      severity: diagnostic.severity === 'error' ? 1 : diagnostic.severity === 'warning' ? 2 : 3,
      code: diagnostic.ruleId,
      source: 'proto',
      message: diagnostic.message,
      data: {
        category: diagnostic.category,
        criterion: diagnostic.criterion,
        analysisComplete: analysis.analysisComplete,
        sourceValid: analysis.sourceValid,
      },
    };
  });
  return { analysis, diagnostics };
}
