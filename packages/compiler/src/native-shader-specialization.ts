import { createHash } from 'node:crypto';
import ts from 'typescript';
import type { ShaderKernel } from '../../core/src/shader-presentation';
import { nativeShaderHostSource, nativeShaderKernelSha256 } from './native-shader-host.generated';
import {
  declarationNames,
  parseSupportTemplate,
  printSupport,
} from './native-support/template-ast';

/** Specialize only the first-party host template; authored source never enters this transformer. */
export function specializeNativeShaderHost(kernels: readonly ShaderKernel[]) {
  const reached = new Set(kernels);
  if (
    !reached.size ||
    [...reached].some((kernel) => kernel !== 'copy-rgba8-v1' && kernel !== 'tint-rgba8-v1')
  )
    throw new Error('Native shader kernel closure required');
  const copy = reached.has('copy-rgba8-v1'),
    tint = reached.has('tint-rgba8-v1');
  const omitted = new Set<string>([
    ...(!copy ? ['SHADER_COPY_RGBA8_V1'] : []),
    ...(!tint ? ['SHADER_TINT_RGBA8_V1', 'NativeShaderTint'] : []),
  ]);
  const method = (name: ts.PropertyName | undefined) =>
    name && ts.isIdentifier(name) ? name.text : undefined;
  const file = parseSupportTemplate(nativeShaderHostSource, 'canonical-shader-host.ts');
  const result = ts.transform(file, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (ts.isStatement(node) && declarationNames(node).some((name) => omitted.has(name)))
          return undefined;
        if (
          (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) &&
          (method(node.name) === 'read' ||
            (!copy && method(node.name) === 'copy') ||
            (!tint && method(node.name) === 'tint'))
        )
          return undefined;
        if (!tint) {
          if (ts.isVariableStatement(node) && declarationNames(node).includes('tint'))
            return undefined;
          if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.name.text === 'multiplier')
            return undefined;
          if (
            (ts.isPropertySignature(node) ||
              ts.isPropertyAssignment(node) ||
              ts.isShorthandPropertyAssignment(node)) &&
            method(node.name) === 'tint'
          )
            return undefined;
          if (
            ts.isIfStatement(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'multiplier'
          )
            return undefined;
          if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
            ts.isBinaryExpression(node.right) &&
            node.right.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
            ts.isIdentifier(node.right.left) &&
            node.right.left.text === 'tint' &&
            node.right.right.kind === ts.SyntaxKind.NullKeyword
          )
            return ts.visitNode(node.left, visit);
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (source) => ts.visitNode(source, visit) as ts.SourceFile;
    },
  ]);
  try {
    const source = printSupport(result.transformed[0]);
    const checked = parseSupportTemplate(source, 'specialized-shader-host.ts');
    const forbidden = new Set([
      ...omitted,
      'readPixels',
      ...(!copy ? ['copy'] : []),
      ...(!tint ? ['tint', 'multiplier', 'uniform4fv'] : []),
    ]);
    const found: Record<string, string> = {};
    const digest = (value: string) => createHash('sha256').update(value).digest('hex');
    function inspect(node: ts.Node) {
      if (ts.isIdentifier(node) && forbidden.has(node.text))
        throw new Error(`Unreached shader support remained: ${node.text}`);
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        Object.hasOwn(nativeShaderKernelSha256, node.name.text)
      ) {
        if (!node.initializer || !ts.isNoSubstitutionTemplateLiteral(node.initializer))
          throw new Error('Kernel literal shape changed');
        const hash = digest(node.initializer.text);
        if (
          hash !== nativeShaderKernelSha256[node.name.text as keyof typeof nativeShaderKernelSha256]
        )
          throw new Error(`Shader kernel changed during specialization: ${node.name.text}`);
        found[node.name.text] = hash;
      }
      ts.forEachChild(node, inspect);
    }
    inspect(checked);
    const required = [
      'SHADER_VERTEX_V1',
      'SHADER_PUBLISH_SRGB_V1',
      ...(copy ? ['SHADER_COPY_RGBA8_V1'] : []),
      ...(tint ? ['SHADER_TINT_RGBA8_V1'] : []),
    ];
    if (
      required.some((name) => !Object.hasOwn(found, name)) ||
      Object.keys(found).length !== required.length
    )
      throw new Error('Shader kernel closure differs from admitted pass plan');
    return { source, sha256: digest(source), kernels: found };
  } finally {
    result.dispose();
  }
}
