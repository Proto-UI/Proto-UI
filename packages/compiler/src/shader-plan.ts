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
export function readNativeShaderPlan(
  value: ExpressionIR,
  read: (value: ExpressionIR) => unknown = data
): ShaderPresentationDeclaration {
  return snapshotShaderPresentation(read(value) as ShaderPresentationDeclaration);
}
export const shaderPlanKey = (value: ExpressionIR): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function emitNativeShaderDeclaration(
  value: ExpressionIR,
  prefix: string,
  plan?: ShaderPresentationDeclaration
): string {
  const declaration = plan ?? readNativeShaderPlan(value);
  const key = createHash('sha256').update(JSON.stringify(declaration)).digest('hex');
  const variables = new Map([['$source', '__shaderSource']]);
  const scene = declaration.source.kind === 'owned-scene';
  const source =
    declaration.source.kind === 'owned-pixels'
      ? {
          width: declaration.source.width,
          height: declaration.source.height,
          pixels: declaration.source.pixels,
        }
      : null;
  const lines = [
    `const __shaderSource = __shaderDevice.upload(${scene ? '__shaderInput' : JSON.stringify(source)});`,
  ];
  for (const [index, pass] of declaration.passes.entries()) {
    const variable = `__shaderPass${index}`;
    const input = variables.get(pass.input)!;
    lines.push(
      `const ${variable} = __shaderDevice.${pass.kernel === 'copy-rgba8-v1' ? `copy(${input})` : `tint(${input}, ${JSON.stringify(pass.tint)})`};`
    );
    variables.set(pass.id, variable);
  }
  lines.push(`return ${variables.get(declaration.output)};`);
  if (declaration.source.kind === 'owned-scene')
    return `${prefix}Shader.declareScene(${JSON.stringify(declaration.source.slot)}, ${declaration.passes.length + 1}, ${JSON.stringify(key)}, ${JSON.stringify(declaration.fallback)}, (__shaderDevice, __shaderInput) => { ${lines.join(' ')} })`;
  return `${prefix}Shader.declare(${JSON.stringify(key)}, ${JSON.stringify(declaration.fallback)}, (__shaderDevice) => { ${lines.join(' ')} })`;
}
