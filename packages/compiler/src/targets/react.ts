import ts from 'typescript';
import type { ComponentIR } from './component-ir.ts';
import { validateComponent } from './validate.ts';
import { emitBehavior } from './react/behavior.ts';
import { component, dispatchers } from './react/component.ts';
import { ReactProgram } from './react/program.ts';
import { fieldStorage, inputReader, publicSurface } from './react/surface.ts';

/** Print an ordinary TypeScript React module from checked component and behavior IR. */
export function emitReact(ir: ComponentIR): string {
  validateComponent(ir);
  const program = new ReactProgram(ir);
  const declarations = [
    ...publicSurface(program),
    ...program.numbers(),
    ...inputReader(program),
    ...fieldStorage(program),
    ...Array.from(program.functions.values(), (fn) => emitBehavior(program, fn)),
    ...dispatchers(program),
    ...component(program),
  ];
  const source = ts.factory.createSourceFile(
    [...program.imports(), ...declarations],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  );
  return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(source);
}
