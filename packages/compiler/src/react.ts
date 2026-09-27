import { validateIR, validIdentifier } from './ir-validation';
import { OPERATION_RULES } from './operations';
import type {
  CompileResult,
  ExpressionIR,
  FunctionIR,
  GeneratedModule,
  ParameterIR,
  PrototypeIR,
  StatementIR,
  ValueType,
} from './ir';

/** Emits direct checked operations, never a runtime IR interpreter or copied source snippet. */
export function emitReact(
  input: PrototypeIR,
  options: { componentName?: string } = {}
): CompileResult<GeneratedModule> {
  const validated = validateIR(input);
  if (!validated.ok) return validated;
  const ir = validated.value;
  const componentName = options.componentName ?? 'CompiledComponent';
  if (
    !validIdentifier(componentName) ||
    ['prototype', 'createComponent', 'GeneratedProps', 'GeneratedExposes'].includes(componentName)
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI3001',
          category: 'invalid-input',
          message: 'Choose a valid, non-reserved generated component identifier.',
          span: ir.setup.span,
        },
      ],
    };
  }
  const names = new Set<string>([componentName]);
  function collect(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
    } else if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key === 'name' && typeof item === 'string') names.add(item);
        collect(item);
      }
    }
  }
  collect(ir);
  let prefix = '__pui';
  while ([...names].some((name) => name.startsWith(prefix))) prefix += '_';
  const core = `${prefix}Core`;
  const hookAliases = new Map(ir.hooks.map((hook, index) => [hook.id, `${prefix}Hook${index}`]));

  function typeName(type: ValueType): string {
    if (type === 'def') return `${core}.DefHandle<GeneratedProps, GeneratedExposes>`;
    if (type === 'run') return `${core}.RunHandle<GeneratedProps>`;
    if (type === 'render') return `${core}.RendererHandle<GeneratedProps>`;
    if (type === 'props') return `${core}.PropsSnapshot<GeneratedProps>`;
    if (type === 'event') return `Parameters<${core}.ProtoEventCallback<GeneratedProps>>[1]`;
    if (type === 'focus-options') return `${core}.FocusRequestOptions`;
    if (type.startsWith('state:')) return `${core}.State<${type.slice('state:'.length)}>`;
    if (['boolean', 'number', 'string', 'null', 'void', 'unknown'].includes(type)) return type;
    return 'unknown';
  }

  function parameters(values: readonly ParameterIR[]): string {
    return values
      .map(
        (parameter) =>
          `${parameter.name}${parameter.optional ? '?' : ''}: ${typeName(parameter.type)}`
      )
      .join(', ');
  }

  function emitFunction(fn: FunctionIR, depth: number): string {
    return `(${parameters(fn.parameters)}) => {\n${statements(fn.body, depth + 1)}${'  '.repeat(depth)}}`;
  }

  function expression(node: ExpressionIR, depth: number): string {
    switch (node.kind) {
      case 'literal':
        return JSON.stringify(node.value);
      case 'reference':
        return node.name;
      case 'member':
        return `(${expression(node.object, depth)})${node.optional ? '?.' : '.'}${node.property}`;
      case 'unary':
        return `(${node.operator}${expression(node.operand, depth)})`;
      case 'binary':
        return `(${expression(node.left, depth)} ${node.operator} ${expression(node.right, depth)})`;
      case 'array':
        return `[${node.elements.map((element) => expression(element, depth)).join(', ')}]`;
      case 'record':
        return `{ ${node.entries.map((entry) => `${entry.key === '__proto__' ? `[${JSON.stringify(entry.key)}]` : JSON.stringify(entry.key)}: ${expression(entry.value, depth)}`).join(', ')} }`;
      case 'function':
        return emitFunction(node.function, depth);
      case 'helper-call':
        return `${node.name}(${node.arguments.map((argument) => expression(argument, depth)).join(', ')})`;
      case 'authored-hook':
        return `${hookAliases.get(node.hookId)}()`;
      case 'operation': {
        const rule = OPERATION_RULES[node.operation];
        const callee = node.operation.startsWith('hook.')
          ? `${prefix}Hooks.${rule.path}`
          : `${expression(node.receiver!, depth)}.${rule.path}`;
        return `${callee}(${node.arguments.map((argument) => expression(argument, depth)).join(', ')})`;
      }
    }
  }

  function statements(body: readonly StatementIR[], depth: number): string {
    const indent = '  '.repeat(depth);
    return body
      .map((statement) => {
        const origin = `${indent}// Source ${statement.span.line}:${statement.span.column}\n`;
        switch (statement.kind) {
          case 'const':
            return `${origin}${indent}const ${statement.name} = ${expression(statement.value, depth)};\n`;
          case 'effect':
            return `${origin}${indent}${expression(statement.expression, depth)};\n`;
          case 'return':
            return `${origin}${indent}return${statement.value ? ` ${expression(statement.value, depth)}` : ''};\n`;
          case 'if':
            return `${origin}${indent}if (${expression(statement.condition, depth)}) {\n${statements(statement.then, depth + 1)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise, depth + 1)}${indent}}` : ''}\n`;
        }
      })
      .join('');
  }

  const props = ir.props.map((prop) => `  ${JSON.stringify(prop.name)}?: ${prop.type};`).join('\n');
  const exposed = ir.exposes
    .map((entry) => {
      const type =
        entry.kind === 'state'
          ? `${core}.ExposeState<${entry.type}>`
          : entry.kind === 'event'
            ? `${core}.ExposeEvent<void>`
            : `${core}.ExposeMethod<(${parameters(entry.parameters)}) => void>`;
      return `  ${JSON.stringify(entry.name)}: ${type};`;
    })
    .join('\n');
  const hooks = ir.hooks
    .map(
      (hook) =>
        `const ${hookAliases.get(hook.id)} = ${core}.defineAsHook<GeneratedProps, GeneratedExposes>({\n  name: ${JSON.stringify(hook.name)},\n  setup: ${emitFunction(hook.setup, 1)},\n});\n`
    )
    .join('\n');
  const code = `// Editable generated source. Profile: react-runtime-v1.\n// Retains the Proto-UI Runtime and React Adapter host bridge; NOT zero-runtime output.\n// Source graph SHA-256: ${ir.source.sha256}\nimport * as ${prefix}React from 'react';\nimport * as ${core} from '@proto.ui/core';\nimport * as ${prefix}Hooks from '@proto.ui/hooks';\nimport { createReactAdapter as ${prefix}CreateAdapter, type ReactAdapterOptions as ${prefix}Options } from '@proto.ui/adapter-react';\n\nexport type GeneratedProps = {\n${props}\n};\nexport type GeneratedExposes = {\n${exposed}\n};\n\n${hooks}\nexport const prototype = ${core}.definePrototype<GeneratedProps, GeneratedExposes>({\n  name: ${JSON.stringify(ir.name)},\n  setup: ${emitFunction(ir.setup, 1)},\n});\n\nconst ${prefix}Adapt = ${prefix}CreateAdapter(${prefix}React);\nexport function createComponent(options?: ${prefix}Options<GeneratedProps>) {\n  return ${prefix}Adapt(prototype, options);\n}\nexport const ${componentName} = createComponent();\nexport default ${componentName};\n`;
  return {
    ok: true,
    value: {
      code,
      profile: 'react-runtime-v1',
      dependencies: [
        { name: 'react', version: '19.2.6', role: 'target' },
        { name: 'react-dom', version: '19.2.6', role: 'target' },
        { name: '@proto.ui/core', version: '0.3.0-alpha.1', role: 'semantic-runtime' },
        { name: '@proto.ui/hooks', version: '0.3.0-alpha.1', role: 'semantic-runtime' },
        { name: '@proto.ui/adapter-react', version: '0.3.0-alpha.1', role: 'host-bridge' },
      ],
      provenance: { source: ir.source, irVersion: ir.schemaVersion, backend: 'react-runtime-v1' },
    },
  };
}
