import { omitSupportDeclarations } from './native-support/template-ast';
import {
  fullNativeInteractionTemplate,
  plannedNativeInteractionArtifacts,
} from './native-support/artifacts';
import type { NativeSupportPlan } from './native-support/plan';
export { planNativeSupport } from './native-support/plan';
import {
  isDataValueType,
  type CompilerDiagnostic,
  type ExpressionIR,
  type FunctionIR,
  type PrototypeIR,
  type StatementIR,
} from './ir';
import { isAssignable } from './data-types';
import { FOCUS_OPTIONS_TYPE } from './operations';
import { nativeImageViewArtifact } from './native-image-view';
import { nativeControlLabelArtifact } from './native-control-label';
import { NativeLexicalScope, moduleLexicalScope } from './template-shape';
import { interactionValueAlternatives } from './interaction-value-shape';
import { ordinaryValueChildren } from './value-children';
import type { TargetOperationAnalysis } from './targets';
import {
  nativeAdapterModulesWithOwnership,
  nativeOwnershipArtifact,
  nativeTextControlArtifact,
} from './native-adapter-modules';

const interactionFile = '.proto-ui/interaction/native-v1.ts';
const semanticEvents = [
  'press.start',
  'press.end',
  'press.cancel',
  'press.commit',
  'key.down',
  'key.up',
  'pointer.down',
  'pointer.move',
  'pointer.up',
  'pointer.cancel',
  'pointer.enter',
  'pointer.leave',
  'nav.focus',
  'nav.blur',
  'text.focus',
  'text.blur',
  'input',
  'change',
  'context.menu',
];
const stateAttributes: Record<string, string> = {
  atomic: 'aria-atomic',
  autocomplete: 'aria-autocomplete',
  current: 'aria-current',
  sort: 'aria-sort',
  busy: 'aria-busy',
  checked: 'aria-checked',
  disabled: 'aria-disabled',
  expanded: 'aria-expanded',
  hasPopup: 'aria-haspopup',
  invalid: 'aria-invalid',
  live: 'aria-live',
  orientation: 'aria-orientation',
  pressed: 'aria-pressed',
  rowCount: 'aria-rowcount',
  columnCount: 'aria-colcount',
  rowIndex: 'aria-rowindex',
  columnIndex: 'aria-colindex',
  rowSpan: 'aria-rowspan',
  columnSpan: 'aria-colspan',
  readOnly: 'aria-readonly',
  selected: 'aria-selected',
  modal: 'aria-modal',
  hidden: 'aria-hidden',
  valueMin: 'aria-valuemin',
  valueMax: 'aria-valuemax',
  valueNow: 'aria-valuenow',
  valueText: 'aria-valuetext',
  level: 'aria-level',
  posInSet: 'aria-posinset',
  setSize: 'aria-setsize',
};
export const nativeAccessibleStateKeys: readonly string[] = Object.freeze(
  Object.keys(stateAttributes)
);

/** Validate checked interaction declarations before direct native helper emission. */
export function validateNativeInteraction(
  ir: PrototypeIR,
  reached?: ReadonlySet<FunctionIR>
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  function reject(expression: ExpressionIR, message: string) {
    diagnostics.push({
      code: 'PUI_NATIVE_INTERACTION_UNSUPPORTED',
      category: 'unsupported-input',
      message,
      span: expression.span,
    });
  }
  function visitFunction(fn: FunctionIR, inherited = NativeLexicalScope.empty()) {
    if (reached && !reached.has(fn)) return;
    let bindings = inherited;
    // Unknown callback formals shadow captures. No caller annotation may invent
    // a record value; a helper result is followed through its actual call frame.
    for (const parameter of fn.parameters)
      bindings = bindings.parameter(parameter.name, undefined, inherited, null);
    const resolve = (value: ExpressionIR, scope = bindings) =>
      interactionValueAlternatives(value, scope) ?? [{ value, scope }];
    function shape(
      value: ExpressionIR | undefined,
      fields: readonly string[],
      operation: ExpressionIR
    ): { value: Extract<ExpressionIR, { kind: 'record' }>; scope: NativeLexicalScope }[] {
      if (!value) return [];
      const records: {
        value: Extract<ExpressionIR, { kind: 'record' }>;
        scope: NativeLexicalScope;
      }[] = [];
      for (const alternative of resolve(value)) {
        if (alternative.value?.kind !== 'record') {
          reject(operation, 'Native interaction options require a statically known record shape.');
          continue;
        }
        records.push({ value: alternative.value, scope: alternative.scope });
        for (const entry of alternative.value.entries) {
          if (!fields.includes(entry.key))
            reject(entry.value, 'Native interaction v1 does not support option ' + entry.key + '.');
        }
      }
      return records;
    }
    function expression(value: ExpressionIR) {
      if (value.kind === 'operation') {
        const args = value.arguments;
        if (value.operation === 'event.on' || value.operation === 'event.onGlobal') {
          const types = args[0] ? resolve(args[0]) : [];
          if (
            !types.length ||
            types.some(
              ({ value: type }) =>
                !type ||
                type.kind !== 'literal' ||
                typeof type.value !== 'string' ||
                !(
                  semanticEvents.includes(type.value) ||
                  (type.value.startsWith('host:') && type.value.length > 5)
                )
            )
          ) {
            reject(
              value,
              'Native interaction requires a supported static Proto input type or nonempty host:* extension.'
            );
          } else if (
            args[2] &&
            types.some(
              ({ value: type }) =>
                type?.kind === 'literal' &&
                typeof type.value === 'string' &&
                !type.value.startsWith('host:')
            )
          ) {
            reject(
              value,
              'Portable semantic listeners do not accept capture/once/passive options; only host:* does.'
            );
          }
          shape(args[2], ['capture', 'once', 'passive'], value);
        }
        if (value.operation === 'focus.configure') {
          const patches = shape(
            args[0],
            ['scopeKey', 'groupKey', 'autoFocus', 'disabled', 'navParticipation', 'meta'],
            value
          );
          for (const patch of patches)
            for (const entry of patch.value.entries)
              for (const { value: setting } of resolve(entry.value, patch.scope)) {
                if (entry.key === 'scopeKey' && setting?.type !== 'focus-scope-key')
                  reject(entry.value, 'Focus scopeKey requires a declared scope identity.');
                if (entry.key === 'groupKey' && setting?.type !== 'focus-roving-key')
                  reject(entry.value, 'Focus groupKey requires a declared roving identity.');
                if (
                  entry.key === 'navParticipation' &&
                  !(setting?.kind === 'literal' && ['auto', 'none'].includes(String(setting.value)))
                )
                  reject(
                    entry.value,
                    'Native focus navParticipation must be the static value auto or none.'
                  );
                if (['autoFocus', 'disabled'].includes(entry.key) && setting?.type !== 'boolean')
                  reject(entry.value, 'Native focus ' + entry.key + ' must be boolean.');
              }
        }
        if (
          value.operation === 'focus.focusSelf' &&
          args[0] &&
          !(
            isDataValueType(args[0].type) &&
            isAssignable(args[0].type, { kind: 'union', members: [FOCUS_OPTIONS_TYPE, 'void'] })
          )
        ) {
          const alternatives = shape(args[0], ['reason', 'preventScroll'], value);
          for (const options of alternatives)
            for (const entry of options.value.entries)
              for (const { value: setting } of resolve(entry.value, options.scope)) {
                if (
                  entry.key === 'reason' &&
                  !(
                    setting?.kind === 'literal' &&
                    ['programmatic', 'keyboard', 'pointer'].includes(String(setting.value))
                  )
                )
                  reject(
                    entry.value,
                    'Native focus reason must be programmatic, keyboard or pointer.'
                  );
                if (entry.key === 'preventScroll' && setting?.type !== 'boolean')
                  reject(entry.value, 'Native focus preventScroll must be boolean.');
              }
        }
        if (value.operation === 'accessible.action') {
          const specs = shape(args[1], ['event'], value);
          if (
            specs.some((spec) =>
              spec.value.entries.some((entry) =>
                resolve(entry.value, spec.scope).some((setting) => setting.value?.type !== 'string')
              )
            )
          )
            reject(value, 'Accessible action event must be an outward Expose event name.');
        }
        if (value.receiver) expression(value.receiver);
        for (const arg of args) expression(arg);
      } else if (ordinaryValueChildren(value)) ordinaryValueChildren(value)!.forEach(expression);
      else if (value.kind === 'function') visitFunction(value.function, bindings);
      else if (value.kind === 'member') expression(value.object);
      else if (value.kind === 'unary') expression(value.operand);
      else if (value.kind === 'lexical-cell') expression(value.value);
      else if (value.kind === 'lexical-read' || value.kind === 'lexical-update')
        expression(value.cell);
      else if (value.kind === 'lexical-write') {
        expression(value.cell);
        expression(value.value);
      } else if (value.kind === 'binary') {
        expression(value.left);
        expression(value.right);
      } else if (value.kind === 'array') value.elements.forEach(expression);
      else if (value.kind === 'record') value.entries.forEach((entry) => expression(entry.value));
      else if (value.kind === 'helper-call') value.arguments.forEach(expression);
      else if (value.kind === 'rule') {
        expression(value.receiver);
        value.states.forEach((entry) => expression(entry.value));
      }
    }
    function statements(body: readonly StatementIR[]) {
      for (const statement of body) {
        if (statement.kind === 'const') {
          expression(statement.value);
          bindings = bindings.bind(statement.name, statement.value);
        } else if (statement.kind === 'effect') expression(statement.expression);
        else if (statement.kind === 'return') {
          if (statement.value) expression(statement.value);
        } else if (statement.kind === 'throw') expression(statement.value);
        else if (statement.kind === 'try') {
          const saved = bindings;
          statements(statement.body);
          bindings = saved;
          if (statement.catch) {
            if (statement.catch.name)
              bindings = bindings.parameter(statement.catch.name, undefined, saved, null);
            statements(statement.catch.body);
            bindings = saved;
          }
          if (statement.finally) statements(statement.finally);
          bindings = saved;
        } else {
          expression(statement.condition);
          const saved = bindings;
          statements(statement.then);
          bindings = saved;
          statements(statement.otherwise);
          bindings = saved;
        }
      }
    }
    for (const parameter of fn.parameters) if (parameter.default) expression(parameter.default);
    statements(fn.body);
  }
  const moduleScope = moduleLexicalScope(ir);
  for (const binding of ir.moduleBindings ?? [])
    if (binding.value.kind === 'function') visitFunction(binding.value.function, moduleScope);
  visitFunction(ir.setup, moduleScope);
  ir.hooks.forEach((hook) => visitFunction(hook.setup, moduleScope));
  return diagnostics;
}

let fullInteractionTemplate: string | undefined;
export const nativeInteractionArtifact = {
  path: interactionFile,
  kind: 'source' as const,
  get contents() {
    return (fullInteractionTemplate ??= fullNativeInteractionTemplate(
      semanticEvents,
      stateAttributes
    ));
  },
};

/**
 * Use only the canonical admitted call graph. This narrow implemented family
 * closure is conservative: every other reached host family keeps its existing
 * complete implementation until its own split and controls are supplied.
 */
export function selectNativeSupport(
  ir: Pick<PrototypeIR, 'moduleDeclarations'>,
  admitted: Pick<TargetOperationAnalysis, 'operations'>
): 'text-single' | 'text-multiline' | 'image' | 'full' {
  const imageOnly =
    ir.moduleDeclarations.length === 1 &&
    ir.moduleDeclarations[0].id === '@proto.ui/image-view/declaration';
  if (
    !imageOnly &&
    (!ir.moduleDeclarations.length ||
      ir.moduleDeclarations.some(
        (declaration) =>
          declaration.id !== 'text-control' &&
          declaration.id !== '@proto.ui/text-control/declaration'
      ))
  )
    return 'full';
  for (const operation of admitted.operations) {
    if (
      imageOnly
        ? operation === 'hook.asImageView' || operation.startsWith('imageView.')
        : operation === 'hook.asTextControl' || operation.startsWith('textControl.')
    )
      continue;
    // Existing owner/template/state/style/context operations have no additional
    // interaction-host family. Unknown/new operations conservatively keep full.
    if (
      /^(props\.|render\.|lifecycle\.|state\.|expose\.|context\.|style\.|rule\.|feedback\.)/.test(
        operation
      )
    )
      continue;
    if (operation === 'run.update' || (imageOnly && operation === 'subscription.release')) continue;
    return 'full';
  }
  // validateIR has already checked the physical declaration and its literal config.
  if (imageOnly) return 'image';
  return ir.moduleDeclarations[0].config.lineMode === 'single' ? 'text-single' : 'text-multiline';
}

export function nativeInteractionArtifacts(
  selection: 'text-single' | 'text-multiline' | 'image' | 'full',
  options: { controlLabel?: boolean } = {}
) {
  if (options.controlLabel && selection !== 'full')
    throw new Error('ControlLabel requires the complete legacy native factory.');
  const ownership = nativeOwnershipArtifact(nativeInteractionArtifact.contents);
  if (selection === 'image') return [ownership, nativeImageViewArtifact];
  if (selection !== 'full')
    return [ownership, nativeTextControlArtifact(selection === 'text-single')];
  const source =
    "import { rootOwners, logicalOwners, exposeSignals, defaultPreventedSamples, type RootOwner } from './ownership-v1';\n" +
    omitSupportDeclarations(
      options.controlLabel
        ? fullNativeInteractionTemplate(semanticEvents, stateAttributes, options)
        : nativeInteractionArtifact.contents,
      ['RootOwner', 'rootOwners', 'logicalOwners', 'exposeSignals', 'defaultPreventedSamples']
    );
  // Keep the established component import ABI. Explicit directory migration
  // reassembles old/new artifacts into one actual helper instance; untouched
  // legacy support is not silently overwritten or claimed compatible.
  return [
    ownership,
    {
      path: '.proto-ui/interaction/native-v1.ts',
      kind: 'source' as const,
      contents: source,
    },
    nativeAdapterModulesWithOwnership(options),
    ...(options.controlLabel ? [nativeControlLabelArtifact] : []),
  ];
}

const supportArtifactCache = new Map<
  string,
  ReturnType<typeof plannedNativeInteractionArtifacts>
>();
export function nativeSupportArtifacts(plan: NativeSupportPlan) {
  let files = supportArtifactCache.get(plan.id);
  if (!files) {
    files = plannedNativeInteractionArtifacts(plan, semanticEvents, stateAttributes);
    supportArtifactCache.set(plan.id, files);
  }
  return files.map((file) => ({ ...file }));
}
