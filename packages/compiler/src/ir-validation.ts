import { createHash } from 'node:crypto';
import { CompilerRejection, reject } from './diagnostics';
import {
  IR_VERSION, MODULE_CAPABILITY_TYPES, isDataValueType, isPublicValueType, isCapabilityAssignable, type CompileResult, type FunctionContext,
  type ExpressionIR, type FunctionIR, type ModuleDeclarationIR, type Phase, type PrototypeIR,
  type SourceSpan, type StaticCapabilityIR, type ValueType,
} from './ir';
import {
  OPERATION_RULES, operationCallbackRule, operationArgumentRule, operationResultType,
  validateOperationArguments, validateOperationPhase, isTemplateChildType, capabilityMemberType, capabilityBinaryType, stateValue,
  type ArgumentRule, type CallbackContext, type OperationBindings, type OperationRule, type SemanticOperation,
} from './operations';
import { dataTypeEqual, isAssignable, parseDataType, type DataType } from './data-types';
import { inferBinaryType, inferUnaryType, memberDataType, conditionRefinements } from './expression-types';
import { sourceName } from './source-resolution';
import { lowerRulePlan } from './rule-plan';
import { assertTwTokenV0 } from '../../core/src/spec/feedback/tokens';
import { acceptsValue } from './data-types';
import type { RuleCondition, RuleDeclarationIR } from './rule-declarations';

const CAPABILITIES = new Set(['unknown','def','run','render','event','host-event','props','focus','accessible','context-key','style-handle','style-disposer','template-props','rule-handle','function','record','array','template','state:boolean','observed:boolean','state:number','state:string', ...MODULE_CAPABILITY_TYPES]);
const CONTEXTS = new Set(['setup','render','helper','event','props-watch','context-watch','context-update','state-watch','collection-meta','positioning','created','mounted','updated','unmounted','before-dispose','expose-method']);
const RESERVED = new Set('await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield'.split(' '));
const FALLBACK: SourceSpan = { file: '<ir>', start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 };

export function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) && !RESERVED.has(value);
}
function bad(message: string, location: SourceSpan = FALLBACK): never { return reject('PUI2002', message, location, 'invalid-ir'); }
function object(value: unknown, allowed?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) bad('IR requires plain data records.');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || allowed && !allowed.includes(key)) bad('Unknown IR field.');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !descriptor.enumerable) bad('IR accessors/non-data fields are forbidden.');
  }
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.keys(value).length !== value.length) bad('IR requires a dense array.');
  if (Object.getPrototypeOf(value) !== Array.prototype && Object.getPrototypeOf(value) !== null) bad('IR array subclasses are forbidden.');
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)) bad('IR arrays cannot have custom properties.');
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor) || !descriptor.enumerable) bad('IR arrays cannot contain accessors.');
  }
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) bad('IR arrays cannot be sparse.');
  return value;
}
function staticRecord(value: unknown, location: SourceSpan): Record<string, unknown> {
  const active = new Set<object>(), checked = new Set<object>();
  function visit(item: unknown): void {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (!item || typeof item !== 'object') bad('Static declarations require finite JSON data.',location);
    if (active.has(item)) bad('Static declarations cannot contain cycles.',location);
    if (checked.has(item)) return;
    active.add(item);
    const children = Array.isArray(item) ? array(item) : Object.values(object(item));
    for (const child of children) visit(child);
    active.delete(item); checked.add(item);
  }
  const result = object(value);
  visit(result);
  return result;
}
function validateStaticConfig(kind: string, config: Record<string, unknown>, location: SourceSpan): void {
  if (kind === 'a11y-ref') {
    if (Object.keys(config).length) bad('A11y semantic references have no configuration.',location);
    return;
  }
  if (kind === 'focus-scope-key' || kind === 'focus-roving-key') {
    if (Object.entries(config).some(([key,value]) => !['kind','debugLabel'].includes(key) || typeof value !== 'string'))
      bad('Focus key metadata supports only kind and debugLabel strings.',location);
    return;
  }
  object(config,['roles','relations','profiles']);
  const roles = object(config.roles);
  if (!Object.hasOwn(roles,'root')) bad('Anatomy family must define a root role.',location);
  function cardinality(value: unknown, base?: Record<string,unknown>): Record<string,unknown> {
    const declaration = object(value,['min','max']);
    const min = declaration.min ?? base?.min, max = declaration.max ?? base?.max;
    if (typeof min !== 'number' || min < 0 || max !== '*' && (typeof max !== 'number' || max < min))
      bad('Invalid Anatomy role cardinality.',location);
    if (base && (min < Number(base.min) || base.max !== '*' && (max === '*' || Number(max) > Number(base.max))))
      bad('Anatomy profile cannot relax family cardinality.',location);
    return {min,max};
  }
  function requires(value: unknown): void {
    if (value === undefined) return;
    for (const item of array(value)) {
      const requirement = object(item,['kind','name']);
      if (requirement.kind !== 'hook' || typeof requirement.name !== 'string' || !requirement.name)
        bad('Anatomy requirements need a nonempty hook name.',location);
    }
  }
  function relations(value: unknown): void {
    if (value === undefined) return;
    for (const item of array(value)) {
      const relation = object(item,['kind','parent','child']);
      if (relation.kind !== 'contains' || typeof relation.parent !== 'string' || typeof relation.child !== 'string' ||
          !Object.hasOwn(roles,relation.parent) || !Object.hasOwn(roles,relation.child))
        bad('Anatomy relations must contain declared roles.',location);
    }
  }
  const limits = new Map<string,Record<string,unknown>>();
  for (const [name,value] of Object.entries(roles)) {
    const role = object(value,['cardinality','requires']);
    limits.set(name,cardinality(role.cardinality)); requires(role.requires);
  }
  relations(config.relations);
  if (config.profiles !== undefined) for (const value of Object.values(object(config.profiles))) {
    const profile = object(value,['roles','relations']);
    if (profile.roles !== undefined) for (const [name,value] of Object.entries(object(profile.roles))) {
      if (!limits.has(name)) bad('Anatomy profile references an undeclared role.',location);
      const role = object(value,['cardinality','requires']);
      if (role.cardinality !== undefined) cardinality(role.cardinality,limits.get(name));
      requires(role.requires);
    }
    relations(profile.relations);
  }
}
function text(value: unknown): string { if (typeof value !== 'string' || !value) bad('IR requires a nonempty string.'); return value; }
function safeFile(value: unknown): string {
  const file = text(value);
  try { if (sourceName(file) !== file) bad('IR source paths must be canonical relative identities.'); }
  catch (error) { if (error instanceof CompilerRejection) bad('IR source paths must remain within the declared source graph.'); throw error; }
  return file;
}
function span(value: unknown): SourceSpan {
  const record = object(value, ['file','start','end','line','column','endLine','endColumn']);
  safeFile(record.file);
  for (const key of ['start','end','line','column','endLine','endColumn']) {
    const n = record[key];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < (key === 'start' || key === 'end' ? 0 : 1)) bad('Invalid IR source position.');
  }
  const result = record as unknown as SourceSpan;
  if (result.end < result.start || result.endLine < result.line || (result.endLine === result.line && result.endColumn < result.column)) bad('Reversed IR source span.');
  return result;
}
function valueType(value: unknown, location = FALLBACK): ValueType {
  if (typeof value === 'string' && CAPABILITIES.has(value)) return value as ValueType;
  if (typeof value === 'string' && /^(nullable|optional):/.test(value) &&
      (MODULE_CAPABILITY_TYPES as readonly string[]).includes(value.slice(value.indexOf(':')+1))) return value as ValueType;
  try { return parseDataType(value); } catch (error) { if (error instanceof TypeError) bad(error.message, location); throw error; }
}
function sameType(a: ValueType, b: ValueType): boolean {
  return a === b || (isDataValueType(a) && isDataValueType(b) && dataTypeEqual(a, b));
}
function assignable(a: ValueType, b: ValueType): boolean {
  return sameType(a,b) || b === 'template' && isTemplateChildType(a) || isCapabilityAssignable(a,b) || (isDataValueType(a) && isDataValueType(b) && isAssignable(a,b));
}
function dataAction(location: SourceSpan, action: () => DataType): DataType {
  try { return action(); } catch (error) { if (error instanceof TypeError) bad(error.message, location); throw error; }
}
const EXPRESSION_FIELDS = ['kind','type','span','value','name','object','property','optional','operator','operand','left','right','elements','entries','operation','receiver','arguments','hookId','keyId','declarationId','function','handle','declaration','states'];
interface Parameter { name: string; type: ValueType; optional?: boolean }
interface Binding { type: ValueType; helper?: FunctionIR; keyId?: string }
type Scope = Map<string, Binding>;

export function validateIR(input: unknown): CompileResult<PrototypeIR> {
  try {
    const root = object(input,['schemaVersion','name','source','sourceFiles','setup','hooks','contextKeys','staticDeclarations','moduleDeclarations','props','exposes','requirements']);
    if (root.schemaVersion !== IR_VERSION) reject('PUI2001','Unsupported private IR schema version.',FALLBACK,'invalid-ir');
    text(root.name);
    const source = object(root.source,['file','exportName','sha256']);
    const entry = safeFile(source.file); text(source.exportName);
    if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)) bad('Invalid source digest.');
    const sourceFiles = new Map<string,string>();
    for (const value of array(root.sourceFiles)) {
      const file = object(value,['file','content','sha256']);
      const name = safeFile(file.file);
      if (sourceFiles.has(name) || typeof file.content !== 'string') bad('Duplicate or invalid source file.');
      if (file.sha256 !== createHash('sha256').update(file.content).digest('hex')) bad('Source file digest does not match its recorded content.');
      sourceFiles.set(name,file.content);
    }
    if (!sourceFiles.has(entry)) bad('Entry is missing from recorded source graph.');
    const graphDigest = createHash('sha256').update(JSON.stringify([...sourceFiles].sort(([a],[b]) => a.localeCompare(b)))).digest('hex');
    if (source.sha256 !== graphDigest) bad('Source graph digest does not match recorded inputs.');
    const props = new Map<string,DataType>();
    for (const value of array(root.props)) {
      const prop = object(value,['name','type','span']);
      const name = text(prop.name), location = span(prop.span), type = valueType(prop.type,location);
      if (props.has(name) || !isDataValueType(type) || type === 'void') bad('Invalid or duplicate prop metadata.',location);
      props.set(name,type);
    }
    const keys = new Map<string,DataType>();
    for (const value of array(root.contextKeys)) {
      const key = object(value,['id','name','type','span']);
      const id = text(key.id); text(key.name);
      const type = valueType(key.type,span(key.span));
      if (keys.has(id) || !isDataValueType(type)) bad('Invalid context key metadata.');
      const members = typeof type !== 'string' && type.kind === 'union' ? type.members : [type];
      if (members.some((member) => typeof member === 'string' || member.kind !== 'record')) bad('Context keys must declare JSON object values.');
      keys.set(id,type);
    }
    const exposures = new Map<string,Record<string,unknown>>();
    for (const value of array(root.exposes)) {
      const exposure = object(value,['name','kind','type','payload','parameters','returnType','span']);
      const name = text(exposure.name), location = span(exposure.span);
      if (exposures.has(name)) bad('Duplicate expose metadata.',location);
      if (exposure.kind === 'state') {
        if (!['boolean','number','string'].includes(String(exposure.type))) bad('Invalid exposed state type.',location);
      } else if (exposure.kind === 'value') {
        if (!isPublicValueType(valueType(exposure.type,location))) bad('Invalid public Expose value boundary.',location);
      } else if (exposure.kind === 'event') {
        if (!isDataValueType(valueType(exposure.payload,location))) bad('Outward event payload must be serializable data.',location);
      } else if (exposure.kind === 'method') {
        parameters(exposure.parameters);
        if (!isPublicValueType(valueType(exposure.returnType,location))) bad('Exposed methods cannot return setup or execution-scope capabilities.',location);
      } else bad('Invalid exposure kind.',location);
      exposures.set(name,exposure);
    }
    const staticCapabilities = new Map<string,StaticCapabilityIR>();
    for (const value of array(root.staticDeclarations)) {
      const capability = object(value,['id','kind','name','config','span']);
      const id = text(capability.id), location = span(capability.span);
      if (!['anatomy-family','focus-scope-key','focus-roving-key','a11y-ref'].includes(String(capability.kind))) bad('Invalid static capability kind.',location);
      text(capability.name);
      const config = staticRecord(capability.config,location);
      if (staticCapabilities.has(id)) bad('Duplicate static capability declaration.',location);
      validateStaticConfig(String(capability.kind),config,location);
      staticCapabilities.set(id,capability as unknown as StaticCapabilityIR);
    }
    const moduleDeclarations = new Map<string,ModuleDeclarationIR>();
    for (const value of array(root.moduleDeclarations)) {
      const declaration = object(value,['id','config','span']);
      const id = text(declaration.id), location = span(declaration.span);
      if (moduleDeclarations.has(id)) bad('Duplicate Module declaration.',location);
      const config = staticRecord(declaration.config,location);
      if (id === '@proto.ui/text-control/declaration') {
        if (Object.keys(config).some((key) => !['content','lineMode','engine'].includes(key)) ||
          config.content !== 'plain-text' || !['single','multiline'].includes(String(config.lineMode)) || config.engine !== 'host')
          bad('Text Control requires content plain-text, lineMode single or multiline, and engine host.',location);
      } else if (id === '@proto.ui/image-view/declaration') {
        if (Object.keys(config).some((key) => !['source','alternativeText','a11yMode','fit'].includes(key)) ||
          typeof config.source !== 'string' || typeof config.alternativeText !== 'string' ||
          !['informative','decorative'].includes(String(config.a11yMode)) || !['contain','cover','fill'].includes(String(config.fit)))
          bad('Image View requires source/alternativeText strings, informative or decorative a11yMode, and contain/cover/fill fit.',location);
      } else bad('Unknown Module declaration.',location);
      moduleDeclarations.set(id,declaration as unknown as ModuleDeclarationIR);
    }
    const hooks = array(root.hooks).map((value) => object(value,['id','name','setup','span']));
    const hookIds = new Set<string>();
    for (const hook of hooks) {
      const id = text(hook.id); text(hook.name); span(hook.span);
      if (hookIds.has(id)) bad('Duplicate authored hook identity.');
      hookIds.add(id);
    }
    for (const requirement of array(root.requirements)) text(requirement);
    const active = new Set<object>();
    function parameters(value: unknown): Parameter[] {
      const names = new Set<string>();
      let optionalSeen = false;
      return array(value).map((item) => {
        const param = object(item,['name','type','optional']);
        if (!validIdentifier(param.name) || names.has(param.name) || (param.optional !== undefined && typeof param.optional !== 'boolean')) bad('Invalid function parameter.');
        if (optionalSeen && param.optional !== true) bad('Required parameter follows an optional parameter.');
        optionalSeen ||= param.optional === true;
        names.add(param.name);
        return { name:param.name, type:valueType(param.type), ...(param.optional === true ? {optional:true}: {}) };
      });
    }
    function fn(value: unknown, outer: Scope, expectedPhase?: Phase): FunctionIR {
      const func = object(value,['parameters','body','phase','context','returnType','span']);
      const location = span(func.span), phase = String(func.phase) as Phase, context = String(func.context) as FunctionContext;
      if (!['setup','callback','render'].includes(phase) || (expectedPhase && phase !== expectedPhase) || !CONTEXTS.has(context) ||
          (context !== 'helper' && (phase !== 'callback' ? context !== phase : context === 'setup' || context === 'render'))) bad('Function phase/context mismatch.',location);
      const params = parameters(func.parameters), declaredReturn = valueType(func.returnType,location);
      if (context === 'setup' && (params.length > 1 || (params.length === 1 && params[0].type !== 'def'))) bad('Setup signature must receive its definition handle.',location);
      const scope = new Map(outer);
      for (const parameter of params) scope.set(parameter.name,{type: parameter.optional && isDataValueType(parameter.type) ? parseDataType({kind:'union',members:[parameter.type,'void']}) : parameter.type});
      const returns: ValueType[] = [];
      const terminal = statements(func.body,scope,phase,context,returns);
      if (!terminal) returns.push('void');
      if (!returns.every((type) => assignable(type,declaredReturn))) bad('Function returns do not satisfy recorded result type.',location);
      return func as unknown as FunctionIR;
    }
    function helperContext(helper: FunctionIR, context: FunctionContext, phase: Phase): void {
      const inspect = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach(inspect); return; }
        const node = value as Record<string,unknown>;
        if (node.kind === 'function' && (node.function as FunctionIR).context !== 'helper') return;
        if (node.kind === 'operation') {
          const issues = validateOperationPhase(String(node.operation),phase,phase === 'callback' ? context as CallbackContext : undefined);
          if (issues.length) bad(issues[0].message,span(node.span));
        }
        for (const [key,child] of Object.entries(node)) if (key !== 'span' && key !== 'type') inspect(child);
      };
      inspect(helper.body);
    }
    function expression(value: unknown, scope: Scope, phase: Phase, context: FunctionContext, allowFunction = false, argumentRule?: ArgumentRule): ValueType {
      const node = object(value,EXPRESSION_FIELDS), location = span(node.span);
      if (active.has(node)) bad('Cyclic IR expression.',location);
      active.add(node);
      try {
        let type: ValueType;
        switch (node.kind) {
          case 'literal':
            if ((node.value !== null && !['boolean','number','string'].includes(typeof node.value)) || (typeof node.value === 'number' && !Number.isFinite(node.value))) bad('IR literals must be finite primitives.',location);
            type = node.value === null ? 'null' : typeof node.value as ValueType; break;
          case 'reference':
            if (!validIdentifier(node.name) || !scope.has(node.name)) bad('Unbound IR reference.',location);
            type = scope.get(node.name)!.type; break;
          case 'static-capability':
            const declarationId = text(node.declarationId);
            if (!staticCapabilities.has(declarationId)) bad('Unknown static capability declaration.',location);
            type = staticCapabilities.get(declarationId)!.kind; break;
          case 'context-key':
            if (!keys.has(text(node.keyId))) bad('Unknown context declaration identity.',location);
            type = 'context-key'; break;
          case 'style-handle': {
            const handle = object(node.handle,['kind','tokens']);
            if (handle.kind !== 'tw') bad('Only checked portable token handles are admitted.',location);
            for (const token of array(handle.tokens)) {
              if (typeof token !== 'string') bad('Style token must be a string.',location);
              try { assertTwTokenV0(token,'compiler IR'); }
              catch (error) { bad(error instanceof Error ? error.message:String(error),location); }
            }
            type = 'style-handle'; break;
          }
          case 'rule': {
            if (phase !== 'setup' || expression(node.receiver,scope,phase,context) !== 'def') bad('Rule declarations are setup-only.',location);
            const declaration = node.declaration as RuleDeclarationIR;
            const plan = lowerRulePlan([declaration],location);
            if (!plan.ok) bad(plan.diagnostics[0].message,location);
            const stateTypes = new Map<string,DataType>();
            for (const item of array(node.states)) {
              const state = object(item,['id','value']), id = text(state.id);
              const handleType = expression(state.value,scope,phase,context);
              const primitive = stateValue(handleType);
              if (stateTypes.has(id) || !primitive) bad('Invalid Rule state reference.',location);
              stateTypes.set(id,primitive);
            }
            for (const dependency of declaration.deps) {
              if (dependency.kind === 'prop' ? !props.has(dependency.key) : !stateTypes.has(dependency.id)) bad('Rule dependency does not resolve to a declared source.',dependency.span);
            }
            const check = (condition:RuleCondition):void => {
              if (condition.type === 'eq') {
                const valueType = condition.left.type === 'prop' ? props.get(condition.left.key) : stateTypes.get(condition.left.id);
                if (!valueType || !acceptsValue(valueType,condition.right)) bad('Rule literal does not match its source type.',condition.span);
              } else if (condition.type === 'not') check(condition.expr);
              else if (condition.type === 'all' || condition.type === 'any') condition.exprs.forEach(check);
            };
            check(declaration.when);
            type = 'rule-handle'; break;
          }
          case 'array': {
            const types = array(node.elements).map((item) => expression(item,scope,phase,context));
            if (types.every(isDataValueType)) type = {kind:'array',element:parseDataType({kind:'union',members:types})};
            else if (types.every((type) => type === 'a11y-ref')) type = 'a11y-ref-list';
            else if (types.every(isTemplateChildType)) type = 'array';
            else bad('Data arrays cannot contain semantic handles.',location);
            break;
          }
          case 'record': {
            const fields: {name:string;type:DataType}[] = [], names = new Set<string>();
            let templateProps = false, moduleConfig = false;
            for (const item of array(node.entries)) {
              const entry = object(item,['key','value']), name = text(entry.key);
              if (names.has(name)) bad('Duplicate IR record key.',location);
              names.add(name);
              const fieldRule = argumentRule?.fields?.[name];
              const field = expression(entry.value,scope,phase,context,!!fieldRule?.callback,fieldRule);
              if (!isDataValueType(field)) {
                if (phase === 'render' && name === 'style' && field === 'style-handle') templateProps = true;
                else if (['def', 'run', 'render'].includes(String(field)) || field === 'function' && !fieldRule?.callback) bad('Configuration records cannot contain execution-scope handles or escaping callbacks.',location);
                else moduleConfig = true;
              } else fields.push({name,type:field});
            }
            if (templateProps && names.size !== 1) bad('TemplateProps supports only one style handle.',location);
            type = moduleConfig ? 'module-config' : templateProps ? 'template-props' : {kind:'record',fields}; break;
          }
          case 'unary': {
            const operand = expression(node.operand,scope,phase,context);
            if (node.operator === '!' && !isDataValueType(operand)) { type='boolean'; break; }
            if (!isDataValueType(operand)) bad('Unary operators require data.',location);
            type = dataAction(location,() => inferUnaryType(String(node.operator),operand)); break;
          }
          case 'binary': {
            const left = expression(node.left,scope,phase,context), right = expression(node.right,scope,phase,context);
            const capabilityType = capabilityBinaryType(String(node.operator),left,right);
            if (capabilityType) {type=capabilityType;break;}
            if ((node.operator === '===' || node.operator === '!==') && (!isDataValueType(left) || !isDataValueType(right))) { type='boolean'; break; }
            if (!isDataValueType(left) || !isDataValueType(right)) bad('Binary operators require data.',location);
            type = dataAction(location,() => inferBinaryType(String(node.operator),left,right)); break;
          }
          case 'member': {
            const owner = expression(node.object,scope,phase,context), key = text(node.property);
            if (typeof node.optional !== 'boolean') bad('IR member optionality must be explicit.',location);
            const capabilityType = capabilityMemberType(owner,key,node.optional as boolean);
            if (capabilityType !== undefined) type = capabilityType;
            else if (owner === 'props' && props.has(key)) type = props.get(key)!;
            else if (owner === 'event' && ['key','type','control'].includes(key)) type = key === 'control' ? 'event' : key === 'type' ? 'string' : parseDataType({kind:'union',members:['string','void']});
            else if (owner === 'event' && ['shiftKey','ctrlKey','altKey','metaKey','repeat'].includes(key)) type = parseDataType({kind:'union',members:['boolean','void']});
            else if (isDataValueType(owner)) type = dataAction(location,() => memberDataType(owner,key,{optional:node.optional as boolean}));
            else bad('Unsupported IR property access.',location);
            break;
          }
          case 'function':
            if (!allowFunction) bad('Escaping function values are unsupported.',location);
            fn(node.function,scope); type = 'function'; break;
          case 'helper-call': {
            if (!validIdentifier(node.name)) bad('Invalid helper name.',location);
            const helper = scope.get(node.name)?.helper;
            if (!helper) bad('Unknown or recursive helper call.',location);
            const args = array(node.arguments), required = helper.parameters.filter((param) => !param.optional).length;
            if (args.length < required || args.length > helper.parameters.length) bad('Helper argument count mismatch.',location);
            args.forEach((argument,index) => { if (!assignable(expression(argument,scope,phase,context),helper.parameters[index].type)) bad('Helper argument type mismatch.',location); });
            if (context !== 'helper') helperContext(helper,context,phase);
            type = helper.returnType; break;
          }
          case 'authored-hook':
            if (phase !== 'setup' || !hookIds.has(text(node.hookId))) bad('Invalid authored-hook call.',location);
            type = 'void'; break;
          case 'operation': {
            const operation = text(node.operation);
            if (!Object.hasOwn(OPERATION_RULES,operation)) bad('Unknown semantic operation.',location);
            const rule: OperationRule = OPERATION_RULES[operation as SemanticOperation];
            const issues = validateOperationPhase(operation,phase,phase === 'callback' ? context as CallbackContext : undefined);
            if (issues.length && !(context === 'helper' && issues.every((issue) => issue.code === 'context'))) bad(issues[0].message,location);
            const receiver = node.receiver === undefined ? undefined : expression(node.receiver,scope,phase,context);
            const args = array(node.arguments), bindings: OperationBindings = {propNames:new Set(props.keys()),stateValueType:stateValue(receiver), ...(phase === 'callback' ? {callbackContext:context as CallbackContext}: {})};
            const first = args[0] ? object(args[0],EXPRESSION_FIELDS):undefined;
            if (first?.kind === 'context-key') bindings.contextValueType = keys.get(text(first.keyId));
            if (operation === 'event.on' || operation === 'event.onGlobal') {
              if (first?.kind !== 'literal' || typeof first.value !== 'string') bad('Input registrations require static types.',location);
              bindings.inputPayloadType = first.value.startsWith('host:') ? 'host-event' : 'event';
            }
            if (operation === 'expose.emit' || operation === 'expose.method') {
              if (first?.kind !== 'literal' || typeof first.value !== 'string') bad('Exposure operations require static declared keys.',location);
              const exposure = exposures.get(first.value);
              if (operation === 'expose.emit') {
                if (!exposure || exposure.kind !== 'event') bad('Emit requires a declared outward event.',location);
                bindings.eventPayloadType = valueType(exposure.payload,location) as DataType;
              } else {
                if (!exposure || exposure.kind !== 'method') bad('Expose method must have recorded signature.',location);
                bindings.methodParameters = parameters(exposure.parameters);
                bindings.methodReturnType = valueType(exposure.returnType,location);
              }
            }
            args.forEach((argument,index) => {
              const callback = operationCallbackRule(operation,index);
              const record = object(argument,EXPRESSION_FIELDS);
              if (callback && (!callback.acceptsValue || record.kind === 'function')) {
                if (record.kind !== 'function') bad('Operation requires a checked callback.',location);
                const checked = fn(record.function,scope,callback.phase);
                const expectedContext = callback.contextFrom === 'caller' ? context:callback.context;
                if (checked.context !== expectedContext) bad('Callback origin cannot grant another lifecycle authority.',location);
              } else expression(argument,scope,phase,context,false,operationArgumentRule(operation,index));
            });
            const argumentIssues = validateOperationArguments(operation,args as never,receiver,bindings);
            if (argumentIssues.length) bad(argumentIssues[0].message,location);
            if (operation === 'expose.state') {
              const exposure = first?.kind === 'literal' ? exposures.get(String(first.value)):undefined;
              const handle = args[1] ? object(args[1],EXPRESSION_FIELDS):undefined;
              if (!exposure || exposure.kind !== 'state' || !handle || stateValue(valueType(handle.type,location)) !== exposure.type) bad('Exposed state metadata does not match declared source.',location);
            }
            if (operation === 'expose.value') {
              const exposure = first?.kind === 'literal' ? exposures.get(String(first.value)) : undefined;
              const value = args[1] ? object(args[1],EXPRESSION_FIELDS) : undefined;
              if (!exposure || exposure.kind !== 'value' || !value || !sameType(valueType(exposure.type,location),valueType(value.type,location)))
                bad('Exposed value metadata does not match its declared source.',location);
            }
            type = operationResultType(operation,receiver,bindings)!;
            if (type === undefined) bad('Semantic operation has unresolved result type.',location);
            break;
          }
          default: bad('Unknown IR expression kind.',location);
        }
        if (!sameType(valueType(node.type,location),type)) bad('IR expression type mismatch.',location);
        return type;
      } finally { active.delete(node); }
    }
    function statements(value: unknown, scope: Scope, phase: Phase, context: FunctionContext, returns: ValueType[]): boolean {
      let terminal = false;
      for (const item of array(value)) {
        const node = object(item,['kind','span','name','value','expression','condition','then','otherwise']), location = span(node.span);
        if (active.has(node)) bad('Cyclic IR statements.',location);
        active.add(node);
        try {
          switch (node.kind) {
            case 'const': {
              if (!validIdentifier(node.name) || scope.has(node.name)) bad('Invalid/rebound local identifier.',location);
              const val = object(node.value,EXPRESSION_FIELDS), type = expression(val,scope,phase,context,val.kind === 'function');
              const alias = val.kind === 'reference' ? scope.get(String(val.name)) : undefined;
              scope.set(node.name,{...alias,type,...(val.kind === 'function' ? {helper:fn(val.function,scope)}: {})});
              break;
            }
            case 'effect': expression(node.expression,scope,phase,context); break;
            case 'if': {
              expression(node.condition,scope,phase,context);
              const branch = (truth: boolean): Scope => {
                const next = new Map(scope);
                for (const [name,type] of conditionRefinements(node.condition as ExpressionIR,truth)) if (next.has(name)) next.set(name,{...next.get(name)!,type});
                return next;
              };
              const thenScope = branch(true), elseScope = branch(false);
              const a = statements(node.then,thenScope,phase,context,returns), b = statements(node.otherwise,elseScope,phase,context,returns);
              const continuing = a ? elseScope : b ? thenScope : undefined;
              if (continuing) for (const name of scope.keys()) scope.set(name,continuing.get(name)!);
              terminal ||= a && b; break;
            }
            case 'return':
              returns.push(node.value === undefined ? 'void' : expression(node.value,scope,phase,context,phase === 'setup'));
              terminal = true; break;
            default: bad('Unknown IR statement.',location);
          }
        } finally { active.delete(node); }
      }
      return terminal;
    }
    for (const hook of hooks) fn(hook.setup,new Map(),'setup');
    fn(root.setup,new Map(),'setup');
    return {ok:true,value:input as PrototypeIR};
  } catch (error) {
    if (error instanceof CompilerRejection) return {ok:false,diagnostics:[error.diagnostic]};
    return {ok:false,diagnostics:[{code:'PUI2002',category:'invalid-ir',message:`Invalid IR: ${error instanceof Error ? error.message:String(error)}`,span:FALLBACK}]};
  }
}
