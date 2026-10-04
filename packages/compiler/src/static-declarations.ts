import ts from 'typescript';
import type { ModuleDeclarationIR, SourceSpan, StaticCapabilityIR, StaticValue } from './ir';
import { rejectNode, sourceName, sourceSpan, type SourceModule } from './parser-module';

export const STATIC_CAPABILITY_FACTORIES = {
  createAnatomyFamily: 'anatomy-family',
  createFocusScopeKey: 'focus-scope-key',
  createFocusRovingKey: 'focus-roving-key',
  createFocusGroupKey: 'focus-roving-key',
  createA11ySemanticObjectRef: 'a11y-ref',
} as const;

export const STATIC_PACKAGE_CAPABILITIES: Readonly<Record<string, readonly string[]>> = {
  '@proto.ui/module-table-structure': ['TABLE_STRUCTURE_FAMILY'],
};

export const STATIC_MODULE_FACTORIES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  '@proto.ui/module-text-control': { declareTextControl: '@proto.ui/text-control/declaration' },
  '@proto.ui/module-image-view': { declareImageView: '@proto.ui/image-view/declaration' },
};

/** Decode checked syntax only. This never imports or calls an author factory. */
export function staticValue(module: SourceModule, input: ts.Expression): StaticValue {
  let node = input;
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isNumericLiteral(node)) {
    const value = Number(node.text);
    if (Number.isFinite(value)) return value;
  }
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    const value = -Number(node.operand.text);
    if (Number.isFinite(value)) return value;
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((element) => staticValue(module, element));
  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, StaticValue> = Object.create(null);
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)))
        rejectNode(property, 'PUI1025', 'Static declarations require literal data fields without spreads, accessors or methods.');
      const name = property.name.text;
      if (Object.hasOwn(result, name)) rejectNode(property, 'PUI1025', `Duplicate static declaration field ${name}.`);
      result[name] = staticValue(module, property.initializer);
    }
    return result;
  }
  return rejectNode(node, 'PUI1025', 'Static declaration values must be finite literal JSON data.');
}

function staticArray(value: StaticValue): value is readonly StaticValue[] { return Array.isArray(value); }

function record(value: StaticValue, node: ts.Node): Readonly<Record<string, StaticValue>> {
  if (value === null || typeof value !== 'object' || staticArray(value))
    return rejectNode(node, 'PUI1025', 'Static declaration configuration must be a literal record.');
  return value;
}

export function tableStructureFamily(span: SourceSpan): StaticCapabilityIR {
  return {
      id: '@proto.ui/module-table-structure#TABLE_STRUCTURE_FAMILY', kind: 'anatomy-family', name: 'base-table',
      config: {
        roles: { root: { cardinality: { min: 1, max: 1 } }, caption: { cardinality: { min: 0, max: 1 } },
          row: { cardinality: { min: 1, max: '*' } }, headerCell: { cardinality: { min: 1, max: '*' } }, cell: { cardinality: { min: 1, max: '*' } } },
        relations: [ { kind: 'contains', parent: 'root', child: 'caption' }, { kind: 'contains', parent: 'root', child: 'row' },
          { kind: 'contains', parent: 'row', child: 'headerCell' }, { kind: 'contains', parent: 'row', child: 'cell' } ],
      },
      span,
  };
}

export function extractStaticCapability(module: SourceModule, bindingName: string): StaticCapabilityIR | undefined {
  const resolved = module.graph.resolveBinding(module, bindingName);
  if (resolved.module === null) {
    if (resolved.imported.module !== '@proto.ui/module-table-structure' || resolved.name !== 'TABLE_STRUCTURE_FAMILY') return undefined;
    return tableStructureFamily(sourceSpan(resolved.imported.node));
  }
  if (!ts.isCallExpression(resolved.node) || !ts.isIdentifier(resolved.node.expression)) return undefined;
  const factory = resolved.module.graph.resolveCoreImport(resolved.module, resolved.node.expression.text);
  if (!factory || !Object.hasOwn(STATIC_CAPABILITY_FACTORIES, factory)) return undefined;
  const kind = STATIC_CAPABILITY_FACTORIES[factory as keyof typeof STATIC_CAPABILITY_FACTORIES];
  const args = resolved.node.arguments;
  let name = kind as string;
  let config: Readonly<Record<string, StaticValue>> = {};
  if (kind === 'anatomy-family') {
    if (args.length !== 2 || !ts.isStringLiteral(args[0]) || !args[0].text)
      rejectNode(resolved.node, 'PUI1025', 'createAnatomyFamily requires a nonempty static name and literal family declaration.');
    name = args[0].text;
    config = record(staticValue(resolved.module, args[1]), args[1]);
    const roles = config.roles;
    if (roles === null || typeof roles !== 'object' || Array.isArray(roles))
      rejectNode(args[1], 'PUI1025', 'Anatomy family declarations require a roles record.');
  } else if (kind === 'a11y-ref') {
    if (args.length) rejectNode(resolved.node, 'PUI1025', 'createA11ySemanticObjectRef takes no arguments.');
  } else {
    if (args.length > 1) rejectNode(resolved.node, 'PUI1025', 'Focus keys take at most one literal metadata record.');
    if (args[0]) {
      config = record(staticValue(resolved.module, args[0]), args[0]);
      if (typeof config.debugLabel === 'string') name = config.debugLabel;
    }
  }
  return {
    id: `${sourceName(resolved.module.file.fileName)}#${resolved.name}`,
    kind, name, config, span: sourceSpan(resolved.node),
  };
}

export function extractModuleDeclaration(module: SourceModule, input: ts.Expression): ModuleDeclarationIR | undefined {
  let node = input;
  let owner = module;
  if (ts.isIdentifier(node)) {
    const resolved = module.graph.resolveBinding(module, node.text);
    if (resolved.module === null || ts.isFunctionDeclaration(resolved.node)) return undefined;
    node = resolved.node;
    owner = resolved.module;
  }
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return undefined;
  const factory = owner.graph.resolveBinding(owner, node.expression.text);
  if (factory.module !== null) return undefined;
  const id = STATIC_MODULE_FACTORIES[factory.imported.module]?.[factory.name];
  if (!id) return undefined;
  if (node.arguments.length !== 1) rejectNode(node, 'PUI1025', 'Static Module declarations require one literal configuration record.');
  const config = record(staticValue(owner, node.arguments[0]), node.arguments[0]);
  if (id === '@proto.ui/text-control/declaration') {
    if (Object.keys(config).some((key) => !['content', 'lineMode', 'engine'].includes(key)) ||
      config.content !== 'plain-text' || !['single', 'multiline'].includes(String(config.lineMode)) || config.engine !== 'host')
      rejectNode(node, 'PUI1025', 'Text Control requires content plain-text, lineMode single or multiline, and engine host.');
  } else if (id === '@proto.ui/image-view/declaration') {
    if (Object.keys(config).some((key) => !['source', 'alternativeText', 'a11yMode', 'fit'].includes(key)) ||
      typeof config.source !== 'string' || typeof config.alternativeText !== 'string' ||
      !['informative', 'decorative'].includes(String(config.a11yMode)) || !['contain', 'cover', 'fill'].includes(String(config.fit)))
      rejectNode(node, 'PUI1025', 'Image View requires source/alternativeText strings, informative or decorative a11yMode, and contain/cover/fill fit.');
  }
  return { id, config, span: sourceSpan(node) };
}
