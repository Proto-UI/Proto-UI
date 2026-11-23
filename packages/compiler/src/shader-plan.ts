import { createHash } from 'node:crypto';
import {
  snapshotShaderPresentation,
  type ShaderPresentationDeclaration,
} from '../../core/src/shader-presentation';
import type { ExpressionIR } from './ir';

/** Inline own-data graphs have no observation, alias or invocation to erase. */
function data(value: ExpressionIR): unknown {
  if (value.kind === 'literal') return value.value;
  if (value.kind === 'record')
    return Object.fromEntries(value.entries.map((entry) => [entry.key, data(entry.value)]));
  if (value.kind === 'array') return value.elements.map(data);
  if (
    value.kind === 'unary' &&
    (value.operator === '-' || value.operator === '+') &&
    value.operand.kind === 'literal' &&
    typeof value.operand.value === 'number'
  )
    return value.operator === '-' ? -value.operand.value : value.operand.value;
  throw new Error(
    'The current native shader profile requires an inline own-data graph; dynamic graphs and aliased resources need separately implemented specialization.'
  );
}
export function readNativeShaderPlan(value: ExpressionIR): ShaderPresentationDeclaration {
  return snapshotShaderPresentation(data(value) as ShaderPresentationDeclaration);
}
export function emitNativeShaderDeclaration(value: ExpressionIR, prefix: string): string {
  const declaration = readNativeShaderPlan(value);
  const key = createHash('sha256').update(JSON.stringify(declaration)).digest('hex');
  const variables = new Map([['$source', '__shaderSource']]);
  const source = {
    width: declaration.source.width,
    height: declaration.source.height,
    pixels: declaration.source.pixels,
  };
  const lines = [`const __shaderSource = __shaderDevice.upload(${JSON.stringify(source)});`];
  for (const [index, pass] of declaration.passes.entries()) {
    const variable = `__shaderPass${index}`;
    const input = variables.get(pass.input)!;
    lines.push(
      `const ${variable} = __shaderDevice.${pass.kernel === 'copy-rgba8-v1' ? `copy(${input})` : `tint(${input}, ${JSON.stringify(pass.tint)})`};`
    );
    variables.set(pass.id, variable);
  }
  lines.push(`return ${variables.get(declaration.output)};`);
  return `${prefix}Shader.declare(${JSON.stringify(key)}, ${JSON.stringify(declaration.fallback)}, (__shaderDevice) => { ${lines.join(' ')} })`;
}
