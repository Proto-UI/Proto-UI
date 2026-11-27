import path from 'node:path';
import type ts from 'typescript';
import { analyzeProtoProgram } from '../frontend/index.ts';
import type { ProtoDiagnostic, ProtoSourceClosure } from '../frontend/types.ts';
import type { ComponentIR } from '../targets/component-ir.ts';
import { ComponentIRDiagnostic, validateComponent } from '../targets/validate.ts';
import { lowerSourceUnit } from './links.ts';
import { AUTHORING_DECLARATIONS, createSourceContext, SourceIssue } from './source.ts';

export { AUTHORING_DECLARATIONS };
export type { SourceLinks } from './links.ts';

export interface ComponentEntry {
  fileName: string;
  exportName?: string;
  /** For example, the local binding selected for a default import. */
  publicName?: string;
}

export type ComponentProduction = { sourceClosure: ProtoSourceClosure } & (
  | { status: 'produced'; component: ComponentIR }
  | { status: 'unavailable'; diagnostics: ProtoDiagnostic[] }
);

function defaultBinding(file: string): string {
  const stem = path.basename(file).replace(/(?:\.proto)?\.[cm]?tsx?(?:\.txt)?$/i, '');
  const words = stem.split(/[\W_]+/u).filter(Boolean);
  const name = words.map((word) => word[0]!.toUpperCase() + word.slice(1)).join('');
  return /^[A-Z]/.test(name) ? name : `Component${name}`;
}

/** Produce one checked component from the same immutable Program used by lint
 * and the editor. The source closure is target-neutral and accompanies every result. */
export function produceComponentIR(
  program: ts.Program,
  entry: ComponentEntry
): ComponentProduction {
  const analysis = analyzeProtoProgram(program);
  const sourceClosure = analysis.sourceClosure;
  const diagnostics = analysis.diagnostics.filter(
    (item) =>
      item.category === 'source-invalid' ||
      (item.category === 'compiler-missing' &&
        (item.location !== undefined || item.capabilityKey === 'frontend/source-closure'))
  );
  if (!sourceClosure.complete || diagnostics.length)
    return { status: 'unavailable', diagnostics, sourceClosure };
  const absolute = path.resolve(program.getCurrentDirectory(), entry.fileName);
  const file = program.getSourceFile(absolute);
  if (!file || file.isDeclarationFile) {
    return {
      status: 'unavailable',
      sourceClosure,
      diagnostics: [
        {
          code: 'PUI_COMPILER_MISSING',
          ruleId: 'proto/source-producer',
          criterion: ['C-COMPILER-FOUNDATION-0001-IR'],
          category: 'compiler-missing',
          severity: 'info',
          capabilityKey: 'producer/source-entry',
          message: `The source Program has no author entry at ${absolute}.`,
        },
      ],
    };
  }
  const context = createSourceContext(program, file);
  try {
    const authority = sourceClosure.files.find((item) => item.path === AUTHORING_DECLARATIONS);
    const declarations = program.getSourceFile(AUTHORING_DECLARATIONS);
    if (!authority || authority.sourceKind !== 'disk' || !declarations) {
      return context.missing(
        file,
        'producer/authoring-origin',
        'The source closure must contain the resolved, package-owned authoring declarations.'
      );
    }
    const name = entry.exportName ?? 'default';
    const call = context.modules.componentExport(name);
    const component = lowerSourceUnit(
      context,
      call,
      entry.publicName ?? (name === 'default' ? defaultBinding(file.fileName) : name)
    );
    validateComponent(component);
    return { status: 'produced', component, sourceClosure };
  } catch (error) {
    if (error instanceof SourceIssue)
      return { status: 'unavailable', sourceClosure, diagnostics: [error.diagnostic] };
    if (!(error instanceof ComponentIRDiagnostic) || error.category === 'invalid-ir') throw error;
    const span = error.source;
    const target =
      span && program.getSourceFile(path.resolve(program.getCurrentDirectory(), span.file));
    const at = target && span && target.getLineAndCharacterOfPosition(span.start);
    return {
      status: 'unavailable',
      sourceClosure,
      diagnostics: [
        {
          code: error.code,
          ruleId: 'proto/checked-ir',
          criterion: ['C-COMPILER-FOUNDATION-0001-IR'],
          category: error.category,
          severity: error.category === 'source-invalid' ? 'error' : 'info',
          message: error.message,
          ...(error.category === 'compiler-missing' ? { capabilityKey: error.code } : {}),
          ...(target && at && span
            ? {
                location: {
                  file: target.fileName,
                  line: at.line + 1,
                  column: at.character + 1,
                  length: span.end - span.start,
                },
              }
            : {}),
          callChain: [...error.bindings],
          trackingRef: '#1809',
        },
      ],
    };
  }
}
