import ts from 'typescript';
import type { ComponentIR } from './component-ir.ts';
import { validateComponent } from './validate.ts';
import { emitBehavior } from './react/behavior.ts';
import { component, dispatchers } from './react/component.ts';
import { ReactProgram } from './react/program.ts';
import { fieldStorage, inputReader, publicSurface } from './react/surface.ts';
import { ReactUnit } from './react/unit.ts';

/** Print an ordinary TypeScript React module from checked component and behavior IR. */
export function emitReact(ir: ComponentIR): string {
  validateComponent(ir);
  const unit = new ReactUnit(ir);
  const programs = [ir, ...ir.components].map(body => new ReactProgram(unit, body));
  const channels = unit.channels();
  const declarations = programs.flatMap(program => [
    ...publicSurface(program),
    ...inputReader(program),
    ...fieldStorage(program),
    ...Array.from(program.functions.values(), (fn) => emitBehavior(program, fn)),
    ...dispatchers(program),
    ...component(program),
  ]);
  const constants = unit.constants();
  const data = unit.data.declarations();
  const source = ts.factory.createSourceFile(
    [...unit.imports(), ...data, ...constants, ...channels, ...declarations],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  );
  return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(source);
}
