import path from 'node:path';
import type { PrototypeIR, TemplateChildIR, TemplateElementIR } from '../ir';

export interface ReactEmitOptions {
  readonly componentName?: string;
  /** Explicit import specifier for the source prototype module (Tier 2). */
  readonly prototypeImport?: string;
  /** Import specifier for the thin shared compiler runtime. Defaults to '@proto.ui/compiler/runtime'. */
  readonly runtimeImport?: string;
  /** Optional output file path so relative prototype imports are computed automatically. */
  readonly outputFile?: string;
  /** Optional workspace root to emit portable workspace-relative imports when outputFile is omitted. */
  readonly rootDir?: string;
}

export interface ReactEmitResult {
  readonly code: string;
  readonly componentName: string;
  readonly tier: PrototypeIR['tier'];
  readonly dependencies: readonly string[];
}

export function toPascalCase(name: string): string {
  const parts = name
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'CompiledComponent';
  const joined = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  return /^[0-9]/.test(joined) ? `C${joined}` : joined;
}

function toCamelCase(name: string): string {
  const p = toPascalCase(name);
  return p[0].toLowerCase() + p.slice(1);
}

function renderTemplateChild(
  child: TemplateChildIR,
  stateVarMap: ReadonlyMap<string, string>
): string {
  switch (child.kind) {
    case 'text':
      return JSON.stringify(child.value);
    case 'slot':
      return 'props.children';
    case 'prop-read':
      return `resolvedProps[${JSON.stringify(child.propName)}]`;
    case 'state-read':
      return stateVarMap.get(child.stateName) ?? 'undefined';
    case 'element':
      return renderTemplateElement(child.node, stateVarMap, false);
  }
}

function renderTemplateElement(
  node: TemplateElementIR,
  stateVarMap: ReadonlyMap<string, string>,
  isRoot: boolean,
  extraRootProps: readonly string[] = []
): string {
  const propEntries: string[] = [];
  if (isRoot) {
    if (node.styleTokens?.length) {
      propEntries.push(
        `className: [props.className, ${JSON.stringify(node.styleTokens.join(' '))}].filter(Boolean).join(' ') || undefined`
      );
    } else {
      propEntries.push('className: props.className');
    }
    propEntries.push('style: props.style');
    propEntries.push(...extraRootProps);
  } else if (node.styleTokens?.length) {
    propEntries.push(`className: ${JSON.stringify(node.styleTokens.join(' '))}`);
  }

  const propsObj = propEntries.length ? `{ ${propEntries.join(', ')} }` : 'null';
  const children = node.children.map((c) => renderTemplateChild(c, stateVarMap));
  if (children.length === 0) {
    return `React.createElement(${JSON.stringify(node.tag)}, ${propsObj})`;
  }
  return `React.createElement(${JSON.stringify(node.tag)}, ${propsObj}, ${children.join(', ')})`;
}

/**
 * Tier 0: Pure static functional React component (< 20 LOC, zero Proto runtime dependency).
 */
function emitStaticReact(proto: PrototypeIR, componentName: string): ReactEmitResult {
  const propsInterface = [
    `export interface ${componentName}Props {`,
    ...proto.props.map((p) => `  ${JSON.stringify(p.name)}?: ${p.tsType};`),
    '  className?: string;',
    '  style?: React.CSSProperties;',
    '  children?: React.ReactNode;',
    '}',
  ].join('\n');

  const bodyExpr =
    proto.render.kind === 'static-tree'
      ? renderTemplateElement(proto.render.root, new Map(), true)
      : `React.createElement('div', { className: props.className, style: props.style }, props.children)`;

  const code = [
    "import * as React from 'react';",
    '',
    propsInterface,
    '',
    `export function ${componentName}(props: ${componentName}Props): React.ReactElement {`,
    `  return ${bodyExpr};`,
    '}',
    '',
    `export default ${componentName};`,
    '',
  ].join('\n');

  return {
    code,
    componentName,
    tier: 'static',
    dependencies: ['react'],
  };
}

/**
 * Tier 1: Direct idiomatic React component using native `useState` + native event handlers.
 * Zero Proto UI runtime kernel!
 */
function emitReactiveReact(proto: PrototypeIR, componentName: string): ReactEmitResult {
  const stateVarMap = new Map<string, string>();
  const stateLines: string[] = [];
  const setters = new Map<string, string>();

  for (const st of proto.states) {
    const varName = toCamelCase(st.variableName ?? st.name);
    const setter = `set${toPascalCase(varName)}`;
    stateVarMap.set(st.name, varName);
    setters.set(st.name, setter);
    const init =
      st.initialValue !== undefined
        ? JSON.stringify(st.initialValue)
        : st.kind === 'bool'
          ? 'false'
          : st.kind === 'string' || st.kind === 'enum'
            ? "''"
            : '0';
    stateLines.push(`  const [${varName}, ${setter}] = React.useState(${init});`);
  }

  const resolvedPropEntries = proto.props.map((p) => {
    const fallback = p.defaultValue !== undefined ? JSON.stringify(p.defaultValue) : 'null';
    return `    ${JSON.stringify(p.name)}: props[${JSON.stringify(p.name)}] ?? ${fallback},`;
  });

  const clickActions: string[] = [];
  for (const ev of proto.events) {
    if (!ev.simpleAction) continue;
    const setter = setters.get(ev.simpleAction.stateName);
    if (!setter) continue;
    if (ev.eventName === 'press.commit' || ev.eventName === 'click') {
      if (ev.simpleAction.kind === 'increment-state') {
        clickActions.push(`${setter}((v) => v + ${ev.simpleAction.delta})`);
      } else if (ev.simpleAction.kind === 'toggle-state') {
        clickActions.push(`${setter}((v) => !v)`);
      } else if (ev.simpleAction.kind === 'set-state') {
        clickActions.push(`${setter}(${JSON.stringify(ev.simpleAction.value)})`);
      }
    }
  }

  const extraRootProps: string[] = [];
  if (clickActions.length > 0) {
    extraRootProps.push(`onClick: () => { ${clickActions.join('; ')}; }`);
  }

  const propsInterface = [
    `export interface ${componentName}Props {`,
    ...proto.props.map((p) => `  ${JSON.stringify(p.name)}?: ${p.tsType};`),
    '  className?: string;',
    '  style?: React.CSSProperties;',
    '  children?: React.ReactNode;',
    '}',
  ].join('\n');

  const rootExpr =
    proto.render.kind === 'reactive-tree' || proto.render.kind === 'static-tree'
      ? renderTemplateElement(proto.render.root, stateVarMap, true, extraRootProps)
      : `React.createElement('div', { className: props.className, style: props.style }, props.children)`;

  const code = [
    "import * as React from 'react';",
    '',
    propsInterface,
    '',
    `export function ${componentName}(props: ${componentName}Props): React.ReactElement {`,
    ...(proto.props.length > 0
      ? ['  const resolvedProps = {', ...resolvedPropEntries, '  };']
      : []),
    ...stateLines,
    `  return ${rootExpr};`,
    '}',
    '',
    `export default ${componentName};`,
    '',
  ].join('\n');

  return {
    code,
    componentName,
    tier: 'reactive',
    dependencies: ['react'],
  };
}

function computePrototypeImportSpecifier(proto: PrototypeIR, options: ReactEmitOptions): string {
  if (options.prototypeImport) return options.prototypeImport;
  if (options.outputFile) {
    let rel = path
      .relative(path.dirname(path.resolve(options.outputFile)), path.resolve(proto.sourceFile))
      .replace(/\\/g, '/')
      .replace(/\.tsx?$/, '');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel;
  }
  if (options.rootDir) {
    const rel = path
      .relative(path.resolve(options.rootDir), path.resolve(proto.sourceFile))
      .replace(/\\/g, '/')
      .replace(/\.tsx?$/, '');
    if (!rel.startsWith('..')) return `./${rel}`;
  }
  return proto.sourceFile.replace(/\\/g, '/').replace(/\.tsx?$/, '');
}

/**
 * Tier 2: Thin strictly-typed React wrapper delegating to canonical `@proto.ui/compiler/runtime`.
 * Zero `any`, zero duplicated DOM runtime, ~35 lines per component instead of 5,400+ lines.
 */
function emitProtocolReact(
  proto: PrototypeIR,
  componentName: string,
  options: ReactEmitOptions
): ReactEmitResult {
  const runtimeImport = options.runtimeImport ?? '@proto.ui/compiler/runtime';
  const protoImport = computePrototypeImportSpecifier(proto, options);
  const protoImportStmt = proto.isDefaultExport
    ? `import prototype from ${JSON.stringify(protoImport)};`
    : `import { ${proto.exportName} as prototype } from ${JSON.stringify(protoImport)};`;

  const metaLines = [
    `  name: ${JSON.stringify(proto.name)},`,
    `  tier: ${JSON.stringify(proto.tier)},`,
    `  capabilities: ${JSON.stringify(proto.capabilities)},`,
    `  capabilityMask: ${JSON.stringify(`0x${proto.capabilityMask.toString(16)}`)},`,
    `  props: ${JSON.stringify(proto.props.map((p) => p.name))},`,
    `  states: ${JSON.stringify(proto.states.map((s) => s.name))},`,
    `  exposes: ${JSON.stringify(proto.exposes.map((e) => e.name))},`,
    `  staticStyleTokens: ${JSON.stringify(proto.staticStyleTokens)},`,
  ];

  const code = [
    `import { createCompiledReactComponent, type CompiledComponentMeta, type PrototypeProps, type ReactAdapterOptions, type ReactAdapterProps } from ${JSON.stringify(runtimeImport)};`,
    protoImportStmt,
    '',
    `export type ${componentName}Props = ReactAdapterProps<PrototypeProps<typeof prototype>>;`,
    '',
    `export const ${componentName}Meta: CompiledComponentMeta = Object.freeze({`,
    ...metaLines,
    '});',
    '',
    `export function create${componentName}(options?: ReactAdapterOptions<PrototypeProps<typeof prototype>>) {`,
    `  return createCompiledReactComponent(prototype, ${componentName}Meta, options);`,
    '}',
    '',
    `export const ${componentName} = create${componentName}();`,
    `export default ${componentName};`,
    '',
  ].join('\n');

  return {
    code,
    componentName,
    tier: 'protocol',
    dependencies: [
      'react',
      '@proto.ui/compiler/runtime',
      '@proto.ui/adapter-react',
      '@proto.ui/core',
    ],
  };
}

/**
 * Emit a genuinely thin, idiomatic React TypeScript component from Proto SSA IR.
 */
export function emitReactComponent(
  proto: PrototypeIR,
  options: ReactEmitOptions = {}
): ReactEmitResult {
  const componentName = options.componentName ?? toPascalCase(proto.name);
  if (proto.tier === 'static') return emitStaticReact(proto, componentName);
  if (proto.tier === 'reactive') return emitReactiveReact(proto, componentName);
  return emitProtocolReact(proto, componentName, options);
}
