import ts from 'typescript';
import {
  COMPILER_VERSION,
  LANGUAGE_VERSION,
  PRELUDE_PATH,
  RULE_SET_VERSION,
  createProtoProgram,
  getProtoSourceClosure,
} from './program.ts';
import { PROTO_TARGETS } from './types.ts';
import type {
  ProtoAnalysis,
  ProtoAnalysisOptions,
  ProtoDiagnostic,
  ProtoFileAnalysisOptions,
  ProtoSourceLocation,
  ProtoTarget,
} from './types.ts';

const foundation = (name: string) => `C-COMPILER-FOUNDATION-0001-${name}`;
const TRACKING_REF = 'https://github.com/Proto-UI/Proto-UI/pull/1915';

export const PROTO_RULES = Object.freeze({
  'proto/explicit-bool-condition': { criterion: [foundation('VALUES')], coverage: 'partial' },
  'proto/no-implicit-coercion': {
    criterion: [foundation('VALUES'), foundation('EQUALITY')],
    coverage: 'partial',
  },
  'proto/text-api': { criterion: [foundation('TEXT')], coverage: 'partial' },
  'proto/pure-derivation': { criterion: [foundation('PHASES')], coverage: 'missing' },
  'proto/no-capability-assertion': {
    criterion: [foundation('LANGUAGE'), foundation('VALUES')],
    coverage: 'missing',
  },
} as const);

type Domain =
  | 'boolean'
  | 'number'
  | 'string'
  | 'bigint'
  | 'symbol'
  | 'null'
  | 'undefined'
  | 'object'
  | 'unknown'
  | 'never';

function domains(type: ts.Type, checker: ts.TypeChecker, seen = new Set<ts.Type>()): Set<Domain> {
  if (seen.has(type)) return new Set(['unknown']);
  seen.add(type);
  if (type.isUnion())
    return new Set(type.types.flatMap((item) => [...domains(item, checker, new Set(seen))]));
  if (type.isIntersection()) {
    const parts = type.types.map((item) => domains(item, checker, new Set(seen)));
    const primitive = parts.find((part) =>
      [...part].some((value) => !['object', 'unknown'].includes(value))
    );
    return primitive ?? new Set(['object']);
  }
  const flags = type.flags;
  if (flags & ts.TypeFlags.BooleanLike) return new Set(['boolean']);
  if (flags & ts.TypeFlags.NumberLike) return new Set(['number']);
  if (flags & ts.TypeFlags.StringLike) return new Set(['string']);
  if (flags & ts.TypeFlags.BigIntLike) return new Set(['bigint']);
  if (flags & ts.TypeFlags.ESSymbolLike) return new Set(['symbol']);
  if (flags & ts.TypeFlags.Null) return new Set(['null']);
  if (flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) return new Set(['undefined']);
  if (flags & ts.TypeFlags.Never) return new Set(['never']);
  if (flags & ts.TypeFlags.TypeParameter) {
    const constraint = checker.getBaseConstraintOfType(type);
    return constraint ? domains(constraint, checker, seen) : new Set(['unknown']);
  }
  if (flags & ts.TypeFlags.Object) return new Set(['object']);
  return new Set(['unknown']);
}

function only(domain: Set<Domain>, wanted: Domain): boolean {
  return domain.size === 1 && domain.has(wanted);
}

function isUnknown(domain: Set<Domain>): boolean {
  return domain.has('unknown') || domain.has('never');
}

function location(file: ts.SourceFile, start: number, length: number): ProtoSourceLocation {
  const point = file.getLineAndCharacterOfPosition(Math.min(start, file.text.length));
  return { file: file.fileName, line: point.line + 1, column: point.character + 1, length };
}

function nodeLocation(node: ts.Node): ProtoSourceLocation {
  const file = node.getSourceFile();
  return location(file, node.getStart(file), node.getWidth(file));
}

function nodeAt(file: ts.SourceFile, start: number): ts.Node {
  let found: ts.Node = file;
  const visit = (node: ts.Node) => {
    if (node.pos <= start && node.end > start) {
      found = node;
      node.forEachChild(visit);
    }
  };
  visit(file);
  return found;
}

function accessAt(
  node: ts.Node
): ts.PropertyAccessExpression | ts.ElementAccessExpression | undefined {
  for (
    let current: ts.Node | undefined = node;
    current && !ts.isSourceFile(current);
    current = current.parent
  ) {
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
      return current;
    if (ts.isStatement(current)) return undefined;
  }
  return undefined;
}

// These legacy accesses have an established unit mismatch. Other undeclared
// methods (including slice/split) are API/analysis gaps: their spelling alone
// cannot prove that every operation would violate well-formed scalar text.
const codeUnitMembers = new Set(['length', 'charAt']);

function stringReceiver(type: ts.Type, checker: ts.TypeChecker): boolean {
  if (only(domains(type, checker), 'string')) return true;
  // A user record with a field named length (or a user type named String) is
  // not the controlled primitive String interface.
  return (
    type.symbol?.getName() === 'String' &&
    type.symbol.declarations?.some(
      (declaration) => declaration.getSourceFile().fileName === PRELUDE_PATH
    ) === true
  );
}

function memberName(
  access: ts.PropertyAccessExpression | ts.ElementAccessExpression
): string | undefined {
  if (ts.isPropertyAccessExpression(access)) return access.name.text;
  const argument = access.argumentExpression;
  return argument && ts.isStringLiteralLike(argument) ? argument.text : undefined;
}

const arithmeticTokens = new Set([
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
]);
const comparisonTokens = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);
const equalityTokens = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

/** Analyze a factory-created Program; this increment cannot certify a whole program. */
export function analyzeProtoProgram(
  program: ts.Program,
  input: ProtoAnalysisOptions = {}
): ProtoAnalysis {
  if (input.target !== undefined && !PROTO_TARGETS.includes(input.target)) {
    throw new TypeError(`Unknown Proto target: ${String(input.target)}`);
  }
  const sourceClosure = getProtoSourceClosure(program, input.target);
  const checker = program.getTypeChecker();
  const diagnostics: ProtoDiagnostic[] = [];
  const specializedAccesses = new Set<ts.Node>();

  const bindingContext = (
    node?: ts.Node
  ): Pick<ProtoDiagnostic, 'relatedLocations' | 'callChain'> => {
    if (!node) return {};
    const subject = ts.isCallExpression(node) ? node.expression : node;
    let symbol = checker.getSymbolAtLocation(subject);
    if (!symbol && ts.isPropertyAccessExpression(subject))
      symbol = checker.getSymbolAtLocation(subject.name);
    if (!symbol) return {};
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declarations = symbol.declarations ?? [];
    return {
      relatedLocations: declarations
        .filter((item) => item.getSourceFile().fileName !== PRELUDE_PATH)
        .map(nodeLocation),
      callChain: [symbol.getName()],
    };
  };
  const invalid = (
    code: string,
    ruleId: string,
    criterion: string[],
    message: string,
    node: ts.Node
  ) => {
    diagnostics.push({
      code,
      ruleId,
      criterion,
      category: 'source-invalid',
      severity: 'error',
      message,
      location: nodeLocation(node),
      ...bindingContext(node),
    });
  };
  const missing = (
    capabilityKey: string,
    message: string,
    node?: ts.Node,
    ruleId = 'proto/complete-analysis',
    criterion = [foundation('COMPLETE')]
  ) => {
    diagnostics.push({
      code: 'PUI_COMPILER_MISSING',
      ruleId,
      criterion,
      category: 'compiler-missing',
      severity: 'info',
      message,
      ...(node ? { location: nodeLocation(node), ...bindingContext(node) } : {}),
      capabilityKey,
      trackingRef: TRACKING_REF,
    });
  };
  const typeName = (node: ts.Node) => checker.typeToString(checker.getTypeAtLocation(node));

  const booleanCondition = (node: ts.Expression) => {
    const domain = domains(checker.getTypeAtLocation(node), checker);
    if (isUnknown(domain)) {
      if (!only(domain, 'never'))
        missing(
          'frontend/condition-domain',
          'The condition domain is unresolved; a boolean proof is still required.',
          node,
          'proto/explicit-bool-condition',
          [foundation('VALUES')]
        );
      return;
    }
    if (!only(domain, 'boolean')) {
      invalid(
        'PUI_BOOL_CONDITION',
        'proto/explicit-bool-condition',
        [foundation('VALUES')],
        `A Proto condition requires boolean; resolved type is ${typeName(node)}. Write an explicit predicate with the intended semantics; no truthiness or NaN-changing autofix is applied.`,
        node
      );
    }
  };
  const requireNumber = (node: ts.Expression, operation: string) => {
    const domain = domains(checker.getTypeAtLocation(node), checker);
    if (isUnknown(domain) || domain.size > 1) {
      if (!only(domain, 'never'))
        missing(
          'frontend/numeric-operand-domain',
          `The ${operation} operand domain is unresolved.`,
          node,
          'proto/no-implicit-coercion',
          [foundation('VALUES')]
        );
    } else if (!only(domain, 'number')) {
      invalid(
        'PUI_IMPLICIT_COERCION',
        'proto/no-implicit-coercion',
        [foundation('VALUES'), foundation('EQUALITY')],
        `Numeric ${operation} requires number; resolved operand type is ${typeName(node)}. Declare an explicit conversion with its failure semantics.`,
        node
      );
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node))
      booleanCondition(node.expression);
    else if (ts.isForStatement(node) && node.condition) booleanCondition(node.condition);
    else if (ts.isConditionalExpression(node)) booleanCondition(node.condition);
    else if (ts.isPrefixUnaryExpression(node)) {
      if (node.operator === ts.SyntaxKind.ExclamationToken) booleanCondition(node.operand);
      else if (
        [
          ts.SyntaxKind.PlusToken,
          ts.SyntaxKind.MinusToken,
          ts.SyntaxKind.PlusPlusToken,
          ts.SyntaxKind.MinusMinusToken,
        ].includes(node.operator)
      )
        requireNumber(node.operand, ts.tokenToString(node.operator) ?? 'operation');
    } else if (ts.isPostfixUnaryExpression(node))
      requireNumber(node.operand, ts.tokenToString(node.operator) ?? 'operation');

    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      const left = domains(checker.getTypeAtLocation(node.left), checker);
      const right = domains(checker.getTypeAtLocation(node.right), checker);
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
        // Only the left side is intrinsically a condition. A value-producing
        // right side is not banned by inventing an unspecified syntax rule;
        // if the complete expression is a condition it is checked above.
        booleanCondition(node.left);
        if (!only(right, 'boolean'))
          missing(
            'frontend/short-circuit-value-semantics',
            'Value-producing short-circuit lowering is not implemented; the left predicate was checked independently.',
            node
          );
      } else if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.PlusEqualsToken) {
        if (isUnknown(left) || isUnknown(right) || left.size > 1 || right.size > 1) {
          missing(
            'frontend/addition-domains',
            'Addition needs unresolved operand-domain correlation or overload analysis; a union is not itself proof of implicit conversion.',
            node,
            'proto/no-implicit-coercion',
            [foundation('VALUES')]
          );
        } else if (
          !(
            (only(left, 'number') && only(right, 'number')) ||
            (only(left, 'string') && only(right, 'string'))
          )
        ) {
          invalid(
            'PUI_IMPLICIT_COERCION',
            'proto/no-implicit-coercion',
            [foundation('VALUES'), foundation('EQUALITY')],
            `Addition cannot implicitly convert ${typeName(node.left)} and ${typeName(node.right)}. Use compatible numeric/text operands or an explicit conversion.`,
            node
          );
        }
      } else if (arithmeticTokens.has(op)) {
        requireNumber(node.left, ts.tokenToString(op) ?? 'operation');
        requireNumber(node.right, ts.tokenToString(op) ?? 'operation');
      } else if (comparisonTokens.has(op)) {
        if (isUnknown(left) || isUnknown(right) || left.size > 1 || right.size > 1) {
          missing(
            'frontend/comparison-domains',
            'Comparison operand-domain correlation is not implemented for these unresolved or union types.',
            node,
            'proto/no-implicit-coercion',
            [foundation('VALUES')]
          );
        } else if (only(left, 'number') && only(right, 'number')) {
          // A defined numeric comparison supplies boolean, including NaN cases.
        } else if (only(left, 'string') && only(right, 'string')) {
          missing(
            'frontend/text-ordering',
            'Text ordering has not been admitted/lowered by this frontend increment.',
            node,
            'proto/text-api',
            [foundation('TEXT')]
          );
        } else if (!isUnknown(left) && !isUnknown(right)) {
          invalid(
            'PUI_IMPLICIT_COERCION',
            'proto/no-implicit-coercion',
            [foundation('VALUES'), foundation('EQUALITY')],
            `Comparison cannot implicitly convert ${typeName(node.left)} and ${typeName(node.right)}. Establish compatible domains explicitly.`,
            node
          );
        }
      } else if (equalityTokens.has(op)) {
        // Equality is a Proto value operation, not a spelling-based ban on ==.
        // Mixed/structural domain admission needs its own implemented proof;
        // TypeScript's no-overlap heuristic is not that language definition.
        if (
          !(
            left.size === 1 &&
            right.size === 1 &&
            [...left][0] === [...right][0] &&
            !isUnknown(left) &&
            !left.has('object')
          )
        ) {
          missing(
            'frontend/equality-domain-compatibility',
            'Complete typed equality/structural comparability is not implemented for these operand domains; no JavaScript coercion is assumed.',
            node,
            'proto/no-implicit-coercion',
            [foundation('VALUES'), foundation('EQUALITY')]
          );
        }
      }
    }

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const type = checker.getTypeAtLocation(node.expression);
      if (stringReceiver(type, checker)) {
        const member = memberName(node);
        const argument = ts.isElementAccessExpression(node) ? node.argumentExpression : undefined;
        const index =
          argument &&
          (only(domains(checker.getTypeAtLocation(argument), checker), 'number') ||
            (ts.isStringLiteralLike(argument) && /^\d+$/.test(argument.text)));
        if ((member !== undefined && codeUnitMembers.has(member)) || index) {
          specializedAccesses.add(node);
          invalid(
            'PUI_TEXT_API',
            'proto/text-api',
            [foundation('TEXT')],
            `String ${member ?? 'index access'} uses undeclared JavaScript UTF-16 code-unit semantics. Use a defined scalar/grapheme or explicit host-conversion operation; no unit-changing autofix is applied.`,
            node
          );
        }
      }
    }
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      if (!node.text.isWellFormed()) {
        invalid(
          'PUI_UNICODE_LITERAL',
          'proto/text-api',
          [foundation('TEXT')],
          'This literal contains an unpaired surrogate. Proto String values must be well-formed Unicode; replacement is not implicit.',
          node
        );
      }
    }
    node.forEachChild(visit);
  };
  for (const file of program.getSourceFiles()) {
    if (file.fileName !== PRELUDE_PATH && !file.isDeclarationFile) visit(file);
  }

  // Classify only established TS source violations as author errors. Missing
  // prelude capabilities, unknown globals, incomplete inference and heuristic
  // warnings remain visible implementation diagnostics, not new language bans.
  const definiteTypeErrors = new Set([
    2300, 2305, 2322, 2345, 2349, 2351, 2353, 2393, 2416, 2430, 2451, 2554, 2555,
  ]);
  const syntaxDiagnostics = program.getSyntacticDiagnostics();
  const syntactic = new Set<ts.Diagnostic>(syntaxDiagnostics);
  const tsDiagnostics = [
    ...syntaxDiagnostics,
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ];
  for (const diagnostic of tsDiagnostics) {
    const file = diagnostic.file;
    const at = file && diagnostic.start !== undefined ? nodeAt(file, diagnostic.start) : undefined;
    const access = at ? accessAt(at) : undefined;
    if (access && specializedAccesses.has(access)) continue;
    let authorError = syntactic.has(diagnostic) || definiteTypeErrors.has(diagnostic.code);
    if ((diagnostic.code === 2339 || diagnostic.code === 2551) && access) {
      const type = checker.getTypeAtLocation(access.expression);
      const domain = domains(type, checker);
      // Tuple and union types can lack an owning declaration symbol. Missing
      // members stay prelude debt only when every union branch has that origin.
      const memberTypes = type.isUnion() ? type.types : [type];
      const isPreludeType = memberTypes.every(
        (memberType) =>
          checker.isTupleType(memberType) ||
          memberType.symbol?.declarations?.some(
            (declaration) => declaration.getSourceFile().fileName === PRELUDE_PATH
          )
      );
      // A typo on an actually declared user record is different from an absent
      // API in today's intentionally incomplete primitive/host prelude.
      authorError = only(domain, 'object') && !isPreludeType;
    }
    if (
      file?.fileName === PRELUDE_PATH ||
      !file ||
      (file.isDeclarationFile && !syntactic.has(diagnostic))
    )
      authorError = false;
    diagnostics.push({
      code: `PUI_TYPESCRIPT_${diagnostic.code}`,
      ruleId: syntactic.has(diagnostic)
        ? 'proto/typescript-syntax'
        : authorError
          ? 'proto/typescript-type'
          : 'proto/typescript-capability',
      criterion: [foundation('LANGUAGE'), foundation('DIAGNOSTICS')],
      category: authorError ? 'source-invalid' : 'compiler-missing',
      severity: authorError ? 'error' : 'info',
      message: `${authorError ? '' : 'Analysis/prelude capability remains unresolved: '}${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`,
      ...(file && diagnostic.start !== undefined
        ? { location: location(file, diagnostic.start, diagnostic.length ?? 0) }
        : {}),
      ...(at ? bindingContext(at) : {}),
      ...(!authorError
        ? { capabilityKey: `frontend/typescript-${diagnostic.code}`, trackingRef: TRACKING_REF }
        : {}),
    });
  }

  for (const item of sourceClosure.missing) {
    missing(
      'frontend/source-closure',
      `${item.reason} ${item.path ?? item.specifier ?? ''}`.trim(),
      undefined,
      'proto/source-closure',
      [foundation('LANGUAGE'), foundation('COMPLETE')]
    );
  }
  // These obligations are deliberately unconditional: local success of the
  // implemented checks cannot certify all reached source or any target.
  missing(
    'frontend/phase-effect-analysis',
    'Declaration/derivation/action/lifecycle phase and transitive effect analysis is not implemented.',
    undefined,
    'proto/pure-derivation',
    [foundation('PHASES')]
  );
  missing(
    'frontend/capability-origin-ownership',
    'Capability origin, assertion validity, capture ownership and lifetime proofs are not implemented.',
    undefined,
    'proto/no-capability-assertion',
    [foundation('LANGUAGE'), foundation('VALUES'), foundation('CAPTURES'), foundation('LIFETIME')]
  );
  missing(
    'frontend/reactive-transaction-analysis',
    'Automatic dependencies, controlled values, transactions, failure, reentry and view-commit analysis are not implemented.',
    undefined,
    'proto/complete-analysis',
    ['DEPENDENCIES', 'CONTROLLED', 'TRANSACTIONS', 'FAILURE', 'REENTRY', 'VIEW-COMMIT'].map(
      foundation
    )
  );
  missing(
    'frontend/async-context-extern-analysis',
    'Owned async segmentation, Context and extern binding/target analysis are not implemented.',
    undefined,
    'proto/complete-analysis',
    ['ASYNC', 'CONTEXT', 'EXTERNS'].map(foundation)
  );
  missing(
    'frontend/complete-value-analysis',
    'Checked integer boundaries, immutable composite domains, full equality, Option/Result and host text conversion analysis are not implemented.',
    undefined,
    'proto/complete-analysis',
    ['VALUES', 'EQUALITY', 'TEXT', 'RESULTS'].map(foundation)
  );
  missing(
    'frontend/typed-ir',
    'General lint does not produce a selected component. The source producer separately checks the reached component and behavior operations.',
    undefined,
    'proto/complete-analysis',
    ['IR', 'COMPLETE'].map(foundation)
  );
  for (const target of PROTO_TARGETS) {
    diagnostics.push({
      code: 'PUI_BACKEND_MISSING',
      ruleId: 'proto/target-support',
      criterion: [foundation('EMISSION'), foundation('COMPLETE')],
      category: 'backend-missing',
      severity: 'info',
      message:
        target === 'react' || target === 'gpui'
          ? `Lint did not compile a selected export for ${target}. The bounded source compiler checks its reached operations separately.`
          : `The ${target} backend is not implemented; no artifact was generated.`,
      capabilityKey: `backend/${target}`,
      trackingRef: TRACKING_REF,
      targetProfile: target,
    });
  }
  const unique = [
    ...new Map(diagnostics.map((diagnostic) => [JSON.stringify(diagnostic), diagnostic])).values(),
  ];
  unique.sort(
    (a, b) =>
      (a.location?.file ?? '\uffff').localeCompare(b.location?.file ?? '\uffff') ||
      (a.location?.line ?? 0) - (b.location?.line ?? 0) ||
      (a.location?.column ?? 0) - (b.location?.column ?? 0) ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.message.localeCompare(b.message)
  );
  return {
    schemaVersion: 1,
    languageVersion: LANGUAGE_VERSION,
    ruleSetVersion: RULE_SET_VERSION,
    compilerVersion: COMPILER_VERSION,
    analysisComplete: false,
    sourceValid: unique.some((diagnostic) => diagnostic.category === 'source-invalid')
      ? false
      : null,
    ...(input.target ? { selectedTarget: input.target } : {}),
    diagnostics: unique,
    sourceClosure,
    targets: Object.fromEntries(
      PROTO_TARGETS.map((target) => [target, { compilable: false, reason: 'backend-missing' }])
    ) as Record<ProtoTarget, { compilable: false; reason: 'backend-missing' }>,
  };
}

export function analyzeProtoFiles(input: ProtoFileAnalysisOptions): ProtoAnalysis {
  return analyzeProtoProgram(createProtoProgram(input), { target: input.target });
}
