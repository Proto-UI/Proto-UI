import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { diagnostic, err, ok, type CompileResult, type CompilerDiagnostic } from '../diagnostics';
import { resolveCompilerNativeAsset } from '../native-assets';
import type {
  ActionStatementIR,
  PrototypeIR,
  RuleExpr,
  ScalarLiteral,
  TemplateElementIR,
  ValueExprIR,
} from '../ir/types';

export const GPUI_V2_DEPENDENCY = Object.freeze({
  git: 'https://github.com/zed-industries/zed',
  revision: '62e5991dd0f0c8a3af8d5e7e9c4652490d468db8',
});

export interface GpuiEmitOptions {
  readonly componentName?: string;
  readonly gpuiDependency?: 'pinned' | 'workspace';
}

export interface GpuiEmitResult {
  readonly componentName: string;
  readonly propsTypeName: string;
  readonly code: string;
  readonly cargoToml: string;
  readonly dependency: typeof GPUI_V2_DEPENDENCY;
  readonly backend: 'syn-prettyplease';
}

type ValueType = 'number' | 'boolean' | 'string';
interface NativeStyle {
  readonly method: string;
  readonly color?: number;
  readonly weight?: string;
}
const STYLE_METHODS: Readonly<Record<string, string>> = {
  flex: 'flex',
  'flex-col': 'flex_col',
  'flex-row': 'flex_row',
  'items-center': 'items_center',
  'items-start': 'items_start',
  'items-end': 'items_end',
  'justify-center': 'justify_center',
  'justify-between': 'justify_between',
  'justify-start': 'justify_start',
  'justify-end': 'justify_end',
  'w-full': 'w_full',
  'h-full': 'h_full',
  'size-full': 'size_full',
  'rounded-none': 'rounded_none',
  rounded: 'rounded',
  'rounded-sm': 'rounded_sm',
  'rounded-md': 'rounded_md',
  'rounded-lg': 'rounded_lg',
  'rounded-full': 'rounded_full',
  'cursor-pointer': 'cursor_pointer',
  'overflow-hidden': 'overflow_hidden',
  'text-xs': 'text_xs',
  'text-sm': 'text_sm',
  'text-base': 'text_base',
  'text-lg': 'text_lg',
  'text-xl': 'text_xl',
  'text-2xl': 'text_2xl',
};
const COLORS: Readonly<Record<string, number>> = {
  black: 0x000000,
  white: 0xffffff,
  'red-500': 0xef4444,
  'green-500': 0x22c55e,
  'blue-500': 0x3b82f6,
  'gray-100': 0xf3f4f6,
  'gray-500': 0x6b7280,
  'gray-900': 0x111827,
};
const identifier = (prefix: string, name: string) => prefix + name.replace(/[^A-Za-z0-9_]/g, '_');
const scalarType = (value: ScalarLiteral): ValueType | undefined =>
  typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
    ? (typeof value as ValueType)
    : undefined;
const hasLoneSurrogate = (value: string): boolean =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);

function buildPlan(proto: PrototypeIR, options: GpuiEmitOptions): CompileResult<unknown> {
  const issues: CompilerDiagnostic[] = [];
  const reject = (message: string) =>
    issues.push(diagnostic('PUI_GPUI_UNSUPPORTED', 'codegen', message, proto.span));
  const componentName =
    options.componentName ??
    proto.name
      .split(/[^A-Za-z0-9]+/)
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
      .join('');
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(componentName) || componentName === 'Self') {
    reject('GPUI requires a non-reserved PascalCase component name.');
  }
  for (const gap of proto.unlowered ?? []) reject(gap.operation + ': ' + gap.message);
  if (
    proto.hooks.length ||
    proto.contexts.length ||
    proto.exposes.length ||
    proto.lifecycle.length ||
    proto.lifecycleHandlers?.length ||
    proto.propWatches?.length
  ) {
    reject(
      'GPUI authored hooks, context, expose, lifecycle and prop watches require native lowering that is not implemented.'
    );
  }
  if (proto.render.kind !== 'static-tree' && proto.render.kind !== 'reactive-tree') {
    reject(
      'GPUI currently requires an explicit static or reactive element tree; dynamic render and slot ownership are unsupported.'
    );
  }
  const props = new Map<string, ValueType>();
  const nullableProps = new Set<string>();
  const propPlans: unknown[] = [];
  const states = new Map<string, ValueType>();
  const names = new Set<string>();
  const checkLiteral = (literal: ScalarLiteral | undefined, expected: ValueType, label: string) => {
    if (literal === undefined || scalarType(literal) !== expected)
      reject(label + ' requires an explicit ' + expected + ' value.');
    if (typeof literal === 'string' && hasLoneSurrogate(literal))
      reject(label + ' contains an unpaired UTF-16 surrogate.');
  };
  for (const prop of proto.props) {
    const type = prop.kind === 'enum' ? 'string' : prop.kind;
    if (type !== 'number' && type !== 'boolean' && type !== 'string') {
      reject('GPUI prop ' + prop.name + ' has unsupported type ' + prop.kind + '.');
      continue;
    }
    props.set(prop.name, type);
    if (prop.range && type !== 'number') reject('GPUI range constraints require a numeric prop.');
    if (typeof prop.defaultValue === 'string' && hasLoneSurrogate(prop.defaultValue)) {
      reject('Default for prop ' + prop.name + ' contains an unpaired UTF-16 surrogate.');
    }
    const validDefault =
      scalarType(prop.defaultValue ?? null) === type &&
      (type !== 'number' || Number.isFinite(prop.defaultValue)) &&
      (prop.kind !== 'enum' || !!prop.options?.includes(prop.defaultValue!)) &&
      (!prop.range ||
        (typeof prop.defaultValue === 'number' &&
          (prop.range.min === undefined || prop.defaultValue >= prop.range.min) &&
          (prop.range.max === undefined || prop.defaultValue <= prop.range.max)));
    if (!validDefault || prop.empty === 'accept') nullableProps.add(prop.name);
    propPlans.push({ ...prop, resolvedDefault: validDefault ? prop.defaultValue : null });
    const field = identifier('prop_', prop.name);
    if (names.has(field)) reject('GPUI prop names collide after identifier normalization.');
    names.add(field);
    if (
      prop.kind === 'enum' &&
      (!prop.options?.length || prop.options.some((v) => typeof v !== 'string'))
    ) {
      reject('GPUI enums require a non-empty list of string members.');
    }
  }
  for (const state of proto.states) {
    const type =
      state.kind === 'bool'
        ? 'boolean'
        : state.kind === 'string' || state.kind === 'enum'
          ? 'string'
          : 'number';
    states.set(state.name, type);
    if (
      state.options?.some(
        (value) =>
          scalarType(value) !== type || (typeof value === 'string' && hasLoneSurrogate(value))
      )
    ) {
      reject('GPUI state options must be well-formed literals of the declared scalar type.');
    }
    checkLiteral(state.initialValue, type, 'Initial state ' + state.name);
    if (state.kind === 'number.range' || state.step !== undefined || state.clamp !== undefined) {
      reject(
        'GPUI range/step/clamp state policy is not yet lowered; state ' +
          state.name +
          ' cannot be emitted.'
      );
    }
    if (type === 'number' && Number.isNaN(state.initialValue)) {
      reject('GPUI numeric state initial value cannot be NaN.');
    }
    if (state.options?.length && !state.options.includes(state.initialValue!)) {
      reject('GPUI initial state must be in its declared options.');
    } else if (
      !state.options?.length &&
      typeof state.initialValue === 'number' &&
      ((state.min !== undefined && state.initialValue < state.min) ||
        (state.max !== undefined && state.initialValue > state.max))
    ) {
      reject('GPUI initial state violates its numeric bounds.');
    }
    const field = identifier('state_', state.name);
    if (names.has(field)) reject('GPUI state names collide after identifier normalization.');
    names.add(field);
    if (
      state.kind === 'enum' &&
      (!state.options?.length || state.options.some((v) => typeof v !== 'string'))
    ) {
      reject('GPUI enums require a non-empty list of string members.');
    }
  }
  const styles = (tokens: readonly string[]): NativeStyle[] =>
    tokens.flatMap((token) => {
      if (STYLE_METHODS[token]) return [{ method: STYLE_METHODS[token] }];
      const spacing =
        /^(p|px|py|pt|pb|pl|pr|gap|w|h)-(0|1|2|3|4|5|6|8|10|12|16|20|24|32|48|64)$/.exec(token);
      if (spacing) return [{ method: spacing[1] + '_' + spacing[2] }];
      const color = /^(bg|text)-(.+)$/.exec(token);
      if (color && COLORS[color[2]] !== undefined) {
        return [{ method: color[1] === 'bg' ? 'bg' : 'text_color', color: COLORS[color[2]] }];
      }
      if (token === 'font-bold' || token === 'font-normal') {
        return [{ method: 'font_weight', weight: token === 'font-bold' ? 'BOLD' : 'NORMAL' }];
      }
      reject('GPUI style token is unsupported: ' + token);
      return [];
    });
  const checkStyleCascade = (declarations: readonly NativeStyle[]) => {
    const properties = new Map<string, string>();
    for (const style of declarations) {
      const method = style.method;
      let affected = [method];
      const spacing = /^(p|px|py|pt|pb|pl|pr|gap|w|h|size)_/.exec(method)?.[1];
      if (spacing)
        affected = (
          {
            p: ['padding-top', 'padding-bottom', 'padding-left', 'padding-right'],
            px: ['padding-left', 'padding-right'],
            py: ['padding-top', 'padding-bottom'],
            pt: ['padding-top'],
            pb: ['padding-bottom'],
            pl: ['padding-left'],
            pr: ['padding-right'],
            gap: ['gap-x', 'gap-y'],
            w: ['width'],
            h: ['height'],
            size: ['width', 'height'],
          } as Record<string, string[]>
        )[spacing];
      else if (method === 'flex_row' || method === 'flex_col') affected = ['flex-direction'];
      else if (method.startsWith('items_')) affected = ['align-items'];
      else if (method.startsWith('justify_')) affected = ['justify-content'];
      else if (method.startsWith('rounded')) affected = ['border-radius'];
      else if (method.startsWith('text_') && method !== 'text_color')
        affected = ['font-size', 'line-height'];
      const signature = JSON.stringify(style);
      for (const property of affected) {
        if (properties.has(property) && properties.get(property) !== signature) {
          reject(
            'Overlapping GPUI styles require canonical cascade lowering for ' + property + '.'
          );
        }
        properties.set(property, signature);
      }
    }
  };
  const expression = (
    expr: ValueExprIR,
    locals: Map<string, ValueType>
  ): Record<string, unknown> => {
    let type: ValueType | undefined;
    let data: Record<string, unknown> = { ...expr };
    if (expr.kind === 'literal') {
      type = scalarType(expr.value);
      if (typeof expr.value === 'string' && hasLoneSurrogate(expr.value))
        reject('A GPUI string literal contains an unpaired surrogate.');
    } else if (expr.kind === 'state') type = states.get(expr.name);
    else if (expr.kind === 'prop') {
      if (expr.source === 'previous') reject('GPUI previous-props reads require a lowered watch.');
      if (nullableProps.has(expr.name))
        reject(
          'Nullable GPUI prop ' +
            expr.name +
            ' is currently supported only in direct render and rule conditions.'
        );
      type = props.get(expr.name);
    } else if (expr.kind === 'local') type = locals.get(expr.name);
    else if (expr.kind === 'unary') {
      const operand = expression(expr.operand, locals);
      type = expr.operator === '!' ? 'boolean' : 'number';
      if (operand.valueType !== type)
        reject('GPUI unary operands require an explicit native scalar type.');
      data = { ...expr, operand };
    } else if (expr.kind === 'binary') {
      const left = expression(expr.left, locals),
        right = expression(expr.right, locals);
      if (left.valueType !== right.valueType)
        reject('GPUI binary operands must have matching scalar types.');
      if (['===', '!==', '<', '<=', '>', '>='].includes(expr.operator)) type = 'boolean';
      else type = left.valueType as ValueType;
      if (['&&', '||'].includes(expr.operator) && left.valueType !== 'boolean')
        reject('GPUI short-circuit operands must be boolean.');
      if (expr.operator === '+' && left.valueType !== 'number' && left.valueType !== 'string')
        reject('GPUI addition requires number or string operands.');
      if (
        ['-', '*', '/', '%', '<', '<=', '>', '>='].includes(expr.operator) &&
        left.valueType !== 'number'
      ) {
        reject('GPUI arithmetic and ordered comparison require numbers.');
      }
      if (expr.operator === '??')
        reject('GPUI nullish values are not represented by this typed target.');
      data = { ...expr, left, right };
    } else if (expr.kind === 'conditional') {
      const condition = expression(expr.condition, locals);
      const then = expression(expr.then, locals),
        otherwise = expression(expr.otherwise, locals);
      if (condition.valueType !== 'boolean' || then.valueType !== otherwise.valueType) {
        reject('GPUI conditional expression has incompatible native types.');
      }
      type = then.valueType as ValueType;
      data = { ...expr, condition, then, otherwise };
    }
    if (!type) reject('GPUI expression has no supported native scalar type.');
    return { ...data, valueType: type };
  };
  const actions = (
    body: readonly ActionStatementIR[],
    inherited = new Map<string, ValueType>()
  ): unknown[] => {
    const locals = new Map(inherited);
    return body.map((statement) => {
      if (statement.kind === 'return') return statement;
      if (statement.kind === 'if') {
        const condition = expression(statement.condition, locals);
        if (condition.valueType !== 'boolean') reject('GPUI action condition must be boolean.');
        return {
          ...statement,
          condition,
          then: actions(statement.then, locals),
          otherwise: actions(statement.otherwise, locals),
        };
      }
      const value = expression(statement.value, locals);
      if (statement.kind === 'local') locals.set(statement.name, value.valueType as ValueType);
      else if (value.valueType !== states.get(statement.stateName))
        reject('GPUI state assignment has the wrong scalar type.');
      return { ...statement, value };
    });
  };
  const rules = (rule: RuleExpr): unknown => {
    if (rule.kind === 'cmp') {
      const type =
        rule.source === 'state'
          ? states.get(rule.key)
          : rule.source === 'prop'
            ? props.get(rule.key)
            : undefined;
      if (
        !type ||
        type !== scalarType(rule.value) ||
        (rule.operator === 'gte' && type !== 'number')
      ) {
        reject(
          'GPUI rule requires a known compatible prop/state scalar; meta reads are unsupported.'
        );
      }
      return { ...rule, valueType: type };
    }
    if (rule.kind === 'not') return { ...rule, expr: rules(rule.expr) };
    if (rule.kind === 'all' || rule.kind === 'any')
      return { ...rule, exprs: rule.exprs.map(rules) };
    return rule;
  };
  const tree = (node: TemplateElementIR): unknown => {
    if (node.tag !== 'div' && node.tag !== 'span') {
      reject(
        'GPUI element ' +
          node.tag +
          ' requires explicit native semantics; only div/span are currently admitted.'
      );
    }
    const nativeStyles = styles(node.styleTokens ?? []);
    checkStyleCascade(nativeStyles);
    return {
      ...node,
      styles: nativeStyles,
      children: node.children.map((child) => {
        if (child.kind === 'element') return { ...child, node: tree(child.node) };
        if (child.kind === 'slot') reject('GPUI slot ownership is not implemented.');
        if (child.kind === 'text' && hasLoneSurrogate(child.value))
          reject('GPUI text contains an unpaired UTF-16 surrogate.');
        if (child.kind === 'state-read' && !states.has(child.stateName))
          reject('GPUI render reads undeclared state.');
        if (child.kind === 'prop-read' && !props.has(child.propName))
          reject('GPUI render reads undeclared prop.');
        if (
          (child.kind === 'state-read' && states.get(child.stateName) === 'boolean') ||
          (child.kind === 'prop-read' && props.get(child.propName) === 'boolean')
        ) {
          reject(
            'Boolean values are not TemplateChildrenInput; GPUI does not invent their text representation.'
          );
        }
        return child;
      }),
    };
  };
  if (proto.render.kind === 'static-tree' || proto.render.kind === 'reactive-tree') {
    checkStyleCascade(
      styles([
        ...proto.staticStyleTokens,
        ...(proto.render.root.styleTokens ?? []),
        ...proto.rules.flatMap((rule) => rule.styleTokens),
      ])
    );
  }
  const plan = {
    protocolVersion: 1,
    componentName,
    propsTypeName: componentName + 'Props',
    dependency: GPUI_V2_DEPENDENCY,
    workspaceDependency: options.gpuiDependency === 'workspace',
    props: propPlans,
    states: proto.states,
    styles: styles(proto.staticStyleTokens),
    root:
      proto.render.kind === 'static-tree' || proto.render.kind === 'reactive-tree'
        ? tree(proto.render.root)
        : null,
    rules: proto.rules.map((rule) => {
      if (rule.dynamic) reject('GPUI dynamic rule has no native lowering.');
      return { ...rule, condition: rules(rule.condition), styles: styles(rule.styleTokens) };
    }),
    events: proto.events.map((event, index) => {
      if (event.scope !== 'root' || event.eventName !== 'host:click') {
        reject(
          'GPUI event ' +
            event.eventName +
            ' has no admitted native mapping; semantic intents are not aliased to clicks.'
        );
      }
      if (!event.body) reject('GPUI events require a lowered ordered action body.');
      return { method: 'handle_click_' + index, body: actions(event.body ?? []) };
    }),
  };
  return issues.length ? err(issues) : ok(plan);
}

function stringifyPlan(plan: unknown): string {
  return JSON.stringify(plan, (_key, value: unknown) => {
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) {
      return {
        $number: Number.isNaN(value)
          ? 'nan'
          : value === Infinity
            ? '+infinity'
            : value === -Infinity
              ? '-infinity'
              : '-zero',
      };
    }
    return value;
  });
}

/** Build Rust syntax nodes through syn and print them with prettyplease. */
export function emitGpuiComponent(
  proto: PrototypeIR,
  options: GpuiEmitOptions = {}
): CompileResult<GpuiEmitResult> {
  const plan = buildPlan(proto, options);
  if (!plan.ok) return plan;
  const root = resolveCompilerNativeAsset('rust-builder');
  const manifest = path.join(root, 'Cargo.toml');
  const source = path.join(root, 'src/main.rs');
  const lock = path.join(root, 'Cargo.lock');
  if (!fs.existsSync(manifest) || !fs.existsSync(source) || !fs.existsSync(lock)) {
    return err([
      diagnostic(
        'PUI_GPUI_BUILDER001',
        'codegen',
        'The Rust AST builder is missing from this compiler installation.'
      ),
    ]);
  }
  const version = spawnSync('cargo', ['--version'], { encoding: 'utf8', timeout: 10_000 });
  if (version.status !== 0)
    return err([
      diagnostic(
        'PUI_GPUI_BUILDER001',
        'codegen',
        'GPUI emission requires Cargo and the Rust AST builder; there is no source-template fallback.'
      ),
    ]);
  const digest = createHash('sha256')
    .update(fs.readFileSync(source))
    .update(fs.readFileSync(manifest))
    .update(fs.readFileSync(lock))
    .update(version.stdout)
    .digest('hex');
  const targetDir = path.join(os.tmpdir(), 'pui-rust-ast-builder', digest);
  const executable = path.join(
    targetDir,
    'debug',
    process.platform === 'win32' ? 'proto-ui-rust-ast-builder.exe' : 'proto-ui-rust-ast-builder'
  );
  if (!fs.existsSync(executable)) {
    const built = spawnSync(
      'cargo',
      ['build', '--locked', '--manifest-path', manifest, '--target-dir', targetDir],
      { encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 }
    );
    if (built.status !== 0)
      return err([
        diagnostic(
          'PUI_GPUI_BUILDER002',
          'codegen',
          'Building the syn/prettyplease driver failed: ' +
            (built.stderr || built.error?.message || 'unknown failure')
        ),
      ]);
  }
  const built = spawnSync(executable, [], {
    input: stringifyPlan(plan.value),
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (built.status !== 0)
    return err([
      diagnostic(
        'PUI_GPUI_BUILDER003',
        'codegen',
        'Rust AST construction failed: ' +
          (built.stderr || built.error?.message || 'unknown failure')
      ),
    ]);
  try {
    const output = JSON.parse(built.stdout) as {
      componentName: string;
      propsTypeName: string;
      code: string;
      cargoToml: string;
    };
    return ok({ ...output, dependency: GPUI_V2_DEPENDENCY, backend: 'syn-prettyplease' });
  } catch (error) {
    return err([
      diagnostic(
        'PUI_GPUI_BUILDER003',
        'codegen',
        'Invalid Rust builder response: ' + String(error)
      ),
    ]);
  }
}
