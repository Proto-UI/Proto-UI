import ts from 'typescript';
import { readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStaticReader, isUnknown, isFunction, unwrap } from './lib/static-public-source.mjs';

const OP = Symbol('operation');
const op = (name) => ({ [OP]: name });
const def = {
  feedback: {
    style: { use: op('style') },
    material: { declare: op('slot'), use: op('candidate') },
  },
  rule: op('rule'),
};
const walkFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((e) =>
    ['node_modules', 'dist', 'test', 'test-utils'].includes(e.name)
      ? []
      : e.isDirectory()
        ? walkFiles(resolve(directory, e.name))
        : /\.ts$/.test(e.name) && !/\.test\.|\.d\.ts$/.test(e.name)
          ? [resolve(directory, e.name)]
          : []
  );

// Only declaration facts are collected. Rule, loop and conditional contributions
// never become unconditional facts. Unsupported helpers remain explicit debt.
export function summarizePrototype(reader, file) {
  const prototype = reader.exported(file);
  if (
    !prototype ||
    isUnknown(prototype) ||
    typeof prototype.name !== 'string' ||
    !isFunction(prototype.setup)
  )
    return null;
  const summary = {
    name: prototype.name,
    location: reader.origins.get(prototype),
    styles: [],
    slots: [],
    candidates: [],
    unknowns: [],
  };
  const active = new Set();
  const note = (n, reason) => summary.unknowns.push({ ...reader.location(n), reason });
  function inspect(fn, args, conditional = false) {
    if (active.has(fn.node)) {
      note(fn.node, 'recursive composable');
      return;
    }
    active.add(fn.node);
    let env = new Map(fn.env);
    let uncertainState = false;
    fn.node.parameters.forEach((p, i) => {
      if (ts.isIdentifier(p.name))
        env.set(p.name.text, args[i] ?? reader.unknown(p, 'unknown parameter'));
    });
    function expression(raw, conditional) {
      const n = unwrap(raw);
      if (!n) return;
      if (
        (ts.isBinaryExpression(n) &&
          n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
        ts.isPostfixUnaryExpression(n) ||
        (ts.isPrefixUnaryExpression(n) &&
          [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(n.operator))
      ) {
        uncertainState = true;
        note(n, 'mutation/rebinding invalidates subsequent static setup facts');
        return;
      }
      conditional ||= uncertainState;
      if (
        ts.isConditionalExpression(n) ||
        (ts.isBinaryExpression(n) &&
          [
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken,
            ts.SyntaxKind.QuestionQuestionToken,
          ].includes(n.operatorToken.kind))
      ) {
        note(n, 'conditional expression activation requires runtime facts');
        ts.forEachChild(n, (child) => expression(child, true));
        return;
      }
      if (ts.isCallExpression(n)) {
        if (n.questionDotToken) {
          conditional = true;
          note(n, 'optional call activation requires runtime facts');
        }
        const target = reader.evaluate(n.expression, env);
        if (target?.[OP]) {
          const value = reader.evaluate(n.arguments[0], env);
          if (target[OP] === 'rule') {
            note(n, 'Rule activation and final style depend on runtime state/props');
            if (isFunction(value?.intent)) inspect(value.intent, [def], true);
            else note(n, 'unsupported Rule intent');
          } else if (target[OP] === 'style') {
            if (typeof value === 'string')
              summary.styles.push({
                tokens: value.split(/\s+/).filter(Boolean),
                conditional,
                location: reader.location(n),
              });
            else note(n, 'dynamic or unsupported style contribution');
          } else
            summary[target[OP] === 'slot' ? 'slots' : 'candidates'].push({
              value,
              conditional,
              location: reader.location(n),
            });
          return;
        }
        if (isFunction(target)) {
          inspect(
            target,
            n.arguments.map((a) => reader.evaluate(a, env)),
            conditional
          );
          return;
        }
        note(
          n,
          `unresolved call (${isUnknown(target) ? target.reason : 'unsupported callable'}); its contributions are unknown`
        );
        // A nested call such as composable().configure(...) may contain a
        // resolvable composable. Do not execute arbitrary callbacks.
        if (
          ts.isPropertyAccessExpression(n.expression) &&
          ts.isCallExpression(n.expression.expression)
        )
          expression(n.expression.expression, conditional);
        return;
      }
      if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) return;
      ts.forEachChild(n, (child) => expression(child, conditional));
    }
    function statement(n, conditional) {
      if (ts.isBlock(n)) {
        const previous = env;
        env = new Map(env);
        reader.reserve(n.statements, env);
        reader.bind(n.statements.filter(ts.isFunctionDeclaration), env);
        let returned = false;
        for (const s of n.statements)
          if (statement(s, conditional)) {
            returned = true;
            break;
          }
        env = previous;
        return returned;
      } else if (ts.isVariableStatement(n)) {
        reader.bind([n], env);
        for (const d of n.declarationList.declarations) expression(d.initializer, conditional);
      } else if (ts.isExpressionStatement(n)) expression(n.expression, conditional);
      else if (ts.isIfStatement(n)) {
        note(n, 'conditional setup requires runtime facts');
        statement(n.thenStatement, true);
        if (n.elseStatement) statement(n.elseStatement, true);
      } else if (
        ts.isForOfStatement(n) ||
        ts.isForInStatement(n) ||
        ts.isForStatement(n) ||
        ts.isWhileStatement(n)
      ) {
        note(n, 'loop multiplicity/activation is not statically certified');
        statement(n.statement, true);
      } else if (ts.isReturnStatement(n)) {
        // A render callback is a host composition boundary, not setup code.
        if (conditional) uncertainState = true;
        if (
          n.expression &&
          !ts.isArrowFunction(unwrap(n.expression)) &&
          !ts.isFunctionExpression(unwrap(n.expression))
        )
          expression(n.expression, conditional);
        return true;
      } else if (!ts.isFunctionDeclaration(n) && !ts.isEmptyStatement(n))
        note(n, 'unsupported setup statement');
    }
    if (ts.isBlock(fn.node.body)) statement(fn.node.body, conditional);
    else expression(fn.node.body, conditional);
    active.delete(fn.node);
  }
  inspect(prototype.setup, [def]);
  return summary;
}

const painted = (t) =>
  /^bg-(?:background|foreground|primary|secondary|muted|accent|card|popover|destructive|black|white)(?:\/[^ ]+)?$/.test(
    t
  ) && !t.endsWith('/0');
const transformToken = (t) => /(?:^|:)-?(?:transform|translate|rotate|scale|skew)(?:-|$)/.test(t);
const transformed = (t) =>
  /^-?(?:(?:translate-[xy]|rotate|skew-[xy])-(?:[1-9][0-9]*(?:\/[1-9][0-9]*)?|full)|scale(?:-[xy])?-(?:[0-9]+))$/.test(
    t
  ) && !/^scale(?:-[xy])?-100$/.test(t);

export function auditComposition({ root, entry, prototypeFiles, read }) {
  root = resolve(root);
  const reader = createStaticReader(root, { read });
  const summaries = new Map(),
    diagnostics = [];
  for (const file of prototypeFiles ?? walkFiles(resolve(root, 'packages/prototypes'))) {
    const summary = summarizePrototype(reader, file);
    if (summary) {
      if (
        summaries.has(summary.name) &&
        JSON.stringify(summaries.get(summary.name).location) !== JSON.stringify(summary.location)
      )
        throw new Error(`Ambiguous public prototype name: ${summary.name}`);
      summaries.set(summary.name, summary);
    }
  }
  const demo = reader.exported(resolve(root, entry));
  const report = (code, severity, location, compositionPath, reason, evidence = []) =>
    diagnostics.push({
      code,
      severity,
      certainty: code.startsWith('static-') ? 'static-declaration-risk' : 'needs-runtime',
      location,
      compositionPath,
      reason,
      evidence,
    });
  let surfaces = 0;
  function visit(node, ancestors, path) {
    if (typeof node === 'string' || typeof node === 'number' || node == null) return;
    const loc =
      reader.origins.get(node) ??
      (node?.path
        ? { path: node.path, line: node.line, column: node.column }
        : { path: entry, line: 1, column: 1 });
    if (isUnknown(node) || typeof node !== 'object' || !['proto', 'box'].includes(node.kind)) {
      report(
        'needs-runtime-composition',
        'info',
        loc,
        path,
        `Unresolved public composition: ${node?.reason ?? 'unsupported node shape'}`
      );
      return;
    }
    const current = node.kind === 'proto' ? summaries.get(node.prototypeId) : null;
    const here = `${path}/${typeof node.ref === 'string' ? node.ref : node.kind === 'proto' ? node.prototypeId : 'box'}`;
    if (node.kind === 'proto' && !current)
      report(
        'needs-runtime-prototype',
        'info',
        loc,
        here,
        `No supported static public definition for ${String(node.prototypeId)}`
      );
    const own = (current?.styles ?? [])
      .filter((s) => !s.conditional)
      .flatMap((s) => s.tokens.map((token) => ({ token, location: s.location })));
    if (typeof node.className === 'string')
      own.push(...node.className.split(/\s+/).map((token) => ({ token, location: loc })));
    if (isUnknown(node.className) || node.attrs?.style !== undefined)
      report(
        'needs-runtime-style',
        'info',
        loc,
        here,
        'Consumer style is dynamic or outside the supported token-only subset.'
      );
    for (const fact of own.filter(
      (f) =>
        /(?:^|:)bg-/.test(f.token) &&
        !painted(f.token) &&
        !['bg-transparent', 'bg-none'].includes(f.token)
    ))
      report(
        'needs-runtime-style',
        'info',
        fact.location,
        here,
        `Unclassified background token ${fact.token}; no transparent/opaque claim is made.`
      );
    for (const fact of own.filter((f) => transformToken(f.token) && !transformed(f.token)))
      report(
        'needs-runtime-transform',
        'info',
        fact.location,
        here,
        `Transform token ${fact.token} is neutral-looking, variant-dependent or outside the supported numeric subset; inspect its final lowered host style.`
      );
    if (current?.slots.length || current?.candidates.length) {
      surfaces++;
      report(
        'needs-runtime-material',
        'info',
        loc,
        here,
        'Declaration is not committed optical paint. Resolve final style/Rule/props, provider/profile, source scope, preferences, contrast, geometry, visibility, portal/reparenting and overlap at runtime.',
        current.slots.map((s) => s.location)
      );
      const usesBackdrop = current.slots.some((s) => s.value?.source?.kind === 'in-app-backdrop');
      if (usesBackdrop) {
        for (const ancestor of ancestors)
          for (const fact of ancestor.paint)
            report(
              'static-painted-ancestor',
              'warning',
              loc,
              here,
              `Authored ancestor ${ancestor.path} declares ${fact.token}; if retained between this host and the canvas source scope, the conservative canvas-backdrop profile cannot sample through that paint. A nearer source scope, material ownership, final style or a portal can change this. Intentional fallback is legal.`,
              [fact.location]
            );
        for (const fact of own.filter((f) => transformed(f.token)))
          report(
            'static-nonneutral-transform',
            'warning',
            loc,
            here,
            `Authored ${fact.token} is a non-neutral transform candidate for the conservative canvas-backdrop profile; final lowered style and physical host require runtime evidence.`,
            [fact.location]
          );
      }
      for (const u of current.unknowns)
        report('needs-runtime-authoring', 'info', u, here, u.reason);
    }
    if (current && !current.slots.length && current.unknowns.length)
      report(
        'needs-runtime-inherited-contributions',
        'info',
        loc,
        here,
        'Inherited/dynamic authoring contributions are unresolved; absence of a directly visible slot is not proof of absence.',
        current.unknowns
      );
    const next = [...ancestors, { path: here, paint: own.filter((f) => painted(f.token)) }];
    if (isUnknown(node.children) || (node.children !== undefined && !Array.isArray(node.children)))
      report(
        'needs-runtime-children',
        'info',
        loc,
        here,
        'Dynamic or unsupported children; descendants were not certified.'
      );
    else (node.children ?? []).forEach((child, i) => visit(child, next, `${here}[${i}]`));
  }
  if (isUnknown(demo) || !demo?.root)
    report(
      'needs-runtime-entry',
      'info',
      { path: entry, line: 1, column: 1 },
      '/',
      `Entry could not be statically read: ${demo?.reason ?? 'missing root'}`
    );
  else visit(demo.root, [], '');
  return {
    schemaVersion: 1,
    mode: 'report-only',
    entry,
    status: 'needs-runtime',
    surfaces,
    profile:
      'conservative Web canvas-backdrop (conditional applicability; not a portable material ban)',
    authority: [
      'C-FEEDBACK-MATERIAL-0001 (draft): PROVENANCE, SAFETY, QUALITY',
      'HC-FEEDBACK-VISUAL-SINK-0001 (draft): EVIDENCE',
    ],
    diagnostics,
    inputs: Object.fromEntries([...reader.inputs].sort(([a], [b]) => a.localeCompare(b))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0].startsWith('-')) {
    console.error(
      'Usage: node scripts/analysis/material-composition-lint.mjs <public-demo.ts> (report-only)'
    );
    process.exitCode = 2;
  } else {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    try {
      console.log(JSON.stringify(auditComposition({ root, entry: args[0] }), null, 2));
    } catch (error) {
      console.error(`Material audit incomplete: ${error.message}`);
      process.exitCode = 2;
    }
  }
}
