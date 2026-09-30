import { createHash } from 'node:crypto';
import { validateIR, validIdentifier } from './ir-validation';
import { OPERATION_RULES } from './operations';
import { formatDataType } from './data-types';
import { isDataValueType } from './ir';
import type { CompileResult, ExpressionIR, FunctionIR, GeneratedModule, ParameterIR, PrototypeIR, StatementIR, ValueType } from './ir';
import type { RuleCondition } from './rule-declarations';

/** Direct checked semantic calls; never input-source evaluation or an IR interpreter. */
export function emitReact(input: PrototypeIR, options: {componentName?:string} = {}): CompileResult<GeneratedModule> {
  const checked = validateIR(input);
  if (!checked.ok) return checked;
  const ir = checked.value;
  const componentName = options.componentName ?? 'CompiledComponent';
  if (!validIdentifier(componentName) || ['prototype','createComponent','GeneratedProps','GeneratedExposes'].includes(componentName))
    return {ok:false,diagnostics:[{code:'PUI3001',category:'invalid-input',message:'Choose a valid, non-reserved generated component identifier.',span:ir.setup.span}]};
  const names = new Set([componentName]);
  const collect = (value:unknown):void => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') for (const [key,item] of Object.entries(value)) { if (key === 'name' && typeof item === 'string') names.add(item); collect(item); }
  };
  collect(ir.setup); ir.hooks.forEach((hook) => collect(hook.setup));
  let p = '__pui';
  while ([...names].some((name) => name.startsWith(p))) p += '_';
  const core = `${p}Core`;
  const hooks = new Map(ir.hooks.map((hook,index) => [hook.id,`${p}Hook${index}`]));
  const keys = new Map(ir.contextKeys.map((key,index) => [key.id,{name:`${p}Context${index}`,file:`context-${createHash('sha256').update(key.id).digest('hex').slice(0,24)}.ts`} ]));
  function typeName(type:ValueType):string {
    if (isDataValueType(type)) return formatDataType(type);
    if (type === 'def') return `${core}.DefHandle<GeneratedProps, GeneratedExposes>`;
    if (type === 'run') return `${core}.RunHandle<GeneratedProps>`;
    if (type === 'render') return `${core}.RendererHandle<GeneratedProps>`;
    if (type === 'props') return `${core}.PropsSnapshot<GeneratedProps>`;
    if (type === 'event') return `Parameters<${core}.ProtoEventCallback<GeneratedProps>>[1]`;
    if (type === 'style-handle') return `${core}.StyleHandle`;
    if (type === 'rule-handle') return `${core}.RuleHandle`;
    if (typeof type === 'string' && type.startsWith('state:')) return `${core}.State<${type.slice(6)}>`;
    if (type === 'observed:boolean') return `${core}.ObservedStateHandle<boolean, GeneratedProps>`;
    if (type === 'record') return 'Record<string, unknown>';
    if (type === 'array') return 'readonly unknown[]';
    return 'unknown';
  }
  function parameters(values:readonly ParameterIR[]):string {
    return values.map((value) => `${value.name}${value.optional ? '?':''}: ${typeName(value.type)}`).join(', ');
  }
  function fn(value:FunctionIR,depth:number):string {
    return `(${parameters(value.parameters)}) => {\n${statements(value.body,depth+1)}${'  '.repeat(depth)}}`;
  }
  function expression(value:ExpressionIR,depth:number):string {
    switch(value.kind) {
      case 'literal': return JSON.stringify(value.value);
      case 'reference': return value.name;
      case 'context-key': return keys.get(value.keyId)!.name;
      case 'style-handle': return `${core}.tw(${JSON.stringify(value.handle.tokens.join(' '))})`;
      case 'rule': {
        const declaration = value.declaration;
        const states = new Map(value.states.map((state) => [state.id,state.value]));
        const builder = `${p}When`, intent = `${p}Intent`;
        const condition = (node:RuleCondition):string => {
          if (node.type === 'true' || node.type === 'false') return `${builder}.${node.type === 'true' ? 't':'f'}()`;
          if (node.type === 'eq') {
            const signal = node.left.type === 'prop' ? `${builder}.prop(${JSON.stringify(node.left.key)})`
              : `${builder}.state(${expression(states.get(node.left.id)!,depth)})`;
            return `${signal}.eq(${JSON.stringify(node.right)})`;
          }
          if (node.type === 'not') return `${builder}.not(${condition(node.expr)})`;
          return `${builder}.${node.type}(${node.exprs.map(condition).join(', ')})`;
        };
        const operations = declaration.intent.ops.map((operation) =>
          `${intent}.feedback.style.use(${operation.handles.map((handle) => `${core}.tw(${JSON.stringify(handle.tokens.join(' '))})`).join(', ')});`).join(' ');
        const metadata = `${declaration.label === undefined ? '':`label: ${JSON.stringify(declaration.label)}, `}${declaration.note === undefined ? '':`note: ${JSON.stringify(declaration.note)}, `}`;
        return `${expression(value.receiver,depth)}.rule({ ${metadata}when: (${builder}) => ${condition(declaration.when)}, intent: (${intent}) => { ${operations} } })`;
      }
      case 'member': return `(${expression(value.object,depth)})${value.optional ? '?.':''}[${JSON.stringify(value.property)}]`;
      case 'unary': return `(${value.operator}${expression(value.operand,depth)})`;
      case 'binary': return `(${expression(value.left,depth)} ${value.operator} ${expression(value.right,depth)})`;
      case 'array': return `[${value.elements.map((item) => expression(item,depth)).join(', ')}]`;
      case 'record': return `{ ${value.entries.map((entry) => `${entry.key === '__proto__' ? `[${JSON.stringify(entry.key)}]`:JSON.stringify(entry.key)}: ${expression(entry.value,depth)}`).join(', ')} }`;
      case 'function': return fn(value.function,depth);
      case 'helper-call': return `${value.name}(${value.arguments.map((argument) => expression(argument,depth)).join(', ')})`;
      case 'authored-hook': return `${hooks.get(value.hookId)}()`;
      case 'operation': {
        const rule = OPERATION_RULES[value.operation];
        const callee = value.operation.startsWith('hook.') ? `${p}Hooks.${rule.path}` : `${expression(value.receiver!,depth)}.${rule.path}`;
        return `${callee}(${value.arguments.map((argument) => expression(argument,depth)).join(', ')})`;
      }
    }
  }
  function statements(body:readonly StatementIR[],depth:number):string {
    const indent = '  '.repeat(depth);
    return body.map((statement) => {
      const origin = `${indent}// Source ${JSON.stringify(statement.span.file)}:${statement.span.line}:${statement.span.column}\n`;
      switch(statement.kind) {
        case 'const': return `${origin}${indent}const ${statement.name} = ${expression(statement.value,depth)};\n`;
        case 'effect': return `${origin}${indent}${expression(statement.expression,depth)};\n`;
        case 'return': return `${origin}${indent}return${statement.value ? ` ${expression(statement.value,depth)}`:''};\n`;
        case 'if': return `${origin}${indent}if (${expression(statement.condition,depth)}) {\n${statements(statement.then,depth+1)}${indent}}${statement.otherwise.length ? ` else {\n${statements(statement.otherwise,depth+1)}${indent}}`:''}\n`;
      }
    }).join('');
  }
  const props = ir.props.map((prop) => `  ${JSON.stringify(prop.name)}?: ${formatDataType(prop.type)};`).join('\n');
  const exposes = ir.exposes.map((value) => {
    const type = value.kind === 'state' ? `${core}.ExposeState<${value.type}>`
      : value.kind === 'event' ? `${core}.ExposeEvent<${formatDataType(value.payload)}>`
      : `${core}.ExposeMethod<(${parameters(value.parameters)}) => ${typeName(value.returnType)}>`;
    return `  ${JSON.stringify(value.name)}: ${type};`;
  }).join('\n');
  const hookCode = ir.hooks.map((hook) => `const ${hooks.get(hook.id)} = ${core}.defineAsHook<GeneratedProps, GeneratedExposes>({\n  name: ${JSON.stringify(hook.name)},\n  setup: ${fn(hook.setup,1)},\n});\n`).join('\n');
  const contextImports = ir.contextKeys.map((key) => `import { key as ${keys.get(key.id)!.name} } from ${JSON.stringify('./'+keys.get(key.id)!.file.replace(/\.ts$/,''))};`).join('\n');
  const supportingFiles = ir.contextKeys.map((key) => ({path:keys.get(key.id)!.file,kind:'source' as const,contents:`import { createContextKey } from '@proto.ui/core';\n// Original declaration ${JSON.stringify(key.id)}\nexport const key = createContextKey<${formatDataType(key.type)}>(${JSON.stringify(key.name)});\n`}));
  const code = `// Editable generated source. Profile: react-runtime-v1.\n// Retains Proto-UI Runtime and React Adapter; NOT zero-runtime output.\n// Source graph SHA-256: ${ir.source.sha256}\nimport * as ${p}React from 'react';\nimport * as ${core} from '@proto.ui/core';\nimport * as ${p}Hooks from '@proto.ui/hooks';\nimport { createReactAdapter as ${p}CreateAdapter } from '@proto.ui/adapter-react';\nimport type { ReactAdapterOptions as ${p}Options } from '@proto.ui/adapter-react';\n${contextImports}\n\nexport type GeneratedProps = {\n${props}\n};\nexport type GeneratedExposes = {\n${exposes}\n};\n\n${hookCode}\nexport const prototype = ${core}.definePrototype<GeneratedProps, GeneratedExposes>({\n  name: ${JSON.stringify(ir.name)},\n  setup: ${fn(ir.setup,1)},\n});\nconst ${p}Adapt = ${p}CreateAdapter(${p}React);\nexport function createComponent(options?: ${p}Options<GeneratedProps>) {\n  return ${p}Adapt(prototype, options);\n}\nexport const ${componentName} = createComponent();\nexport default ${componentName};\n`;
  return {ok:true,value:{code,profile:'react-runtime-v1',supportingFiles,dependencies:[
    {name:'react',version:'19.2.6',role:'target'}, {name:'react-dom',version:'19.2.6',role:'target'},
    {name:'@proto.ui/core',version:'0.3.0-alpha.1',role:'semantic-runtime'}, {name:'@proto.ui/hooks',version:'0.3.0-alpha.1',role:'semantic-runtime'},
    {name:'@proto.ui/adapter-react',version:'0.3.0-alpha.1',role:'host-bridge'},
  ],provenance:{source:ir.source,irVersion:ir.schemaVersion,backend:'react-runtime-v1'}}};
}
