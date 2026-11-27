import ts from 'typescript';
import type { ComponentIR } from './component-ir.ts';
import type { ReactExternBindings } from './extern-bindings.ts';
import { validateComponent } from './validate.ts';
import { emitBehavior } from './react/behavior.ts';
import { checkReactChildTopology } from './react/child-topology.ts';
import { component, dispatchers, taskViews } from './react/component.ts';
import { ReactProgram } from './react/program.ts';
import { fieldStorage, inputReader, publicSurface } from './react/surface.ts';
import { ReactUnit } from './react/unit.ts';

/** Print an ordinary TypeScript React module from checked component and behavior IR. */
export function emitReact(ir: ComponentIR, options: { readonly bindings?: ReactExternBindings } = {}): string {
  const reached = validateComponent(ir);
  checkReactChildTopology(ir);
  const unit = new ReactUnit(ir, reached, options.bindings);
  const programs = [ir, ...ir.components].map(body => new ReactProgram(unit, body));
  const channels = unit.channels();
  const declarations = programs.flatMap(program => [
    ...publicSurface(program),
    ...inputReader(program),
    ...fieldStorage(program),
    ...taskViews(program),
    ...Array.from(program.functions.values()).flatMap(fn => fn.taskBlocks
      ? fn.blocks.map(block => emitBehavior(program, fn, block))
      : [emitBehavior(program, fn)]),
    ...dispatchers(program),
    ...component(program),
  ]);
  const constants = unit.constants();
  const externs = unit.externResults();
  const data = unit.data.declarations();
  const source = ts.factory.createSourceFile(
    [...unit.imports(), ...data, ...externs, ...constants, ...channels, ...declarations],
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  );
  return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(source);
}

export type { ReactExternBindings } from './extern-bindings.ts';
