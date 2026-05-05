import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import prompts from 'prompts';
import ts from 'typescript';

import {
  ADAPTER_PACKAGES,
  PROTOTYPE_PACKAGES,
  CLI_PACKAGE,
  DEFAULT_THEME_NAME,
  DEFAULT_THEME_IMPORT,
  DEFAULT_TOKENS_IMPORT,
  SHADCN_TOKENS_CSS,
  SHADCN_THEME_CSS,
  TAILWIND_BASE_TEMPLATE,
} from './type.js';

/** Matches docs: apps/www/src/content/docs/zh-cn/start-here/quick-start.mdx (proto-ui/ tree). */
const PROTO_UI_LAYOUT_TXT = `your-project/
├── src/                    # your app (not created by init; shown as typical layout)
├── proto-ui/               # created by proto-ui init
│   ├── adapters/           # adapters used by this project
│   ├── prototypes/         # prototypes installed into this project
│   └── components/         # assembled component entry points
├── package.json
└── ...`;

function isHelpToken(token) {
  if (!token || typeof token !== 'string') return false;
  return token === '--help' || token === '-h' || token === '-help' || token === 'help';
}

export async function run(argv) {
  const [command, ...rest] = argv;

  if (!command || isHelpToken(command)) {
    printHelp();
    return;
  }

  if (command === 'init') {
    await runInit(rest);
    return;
  }

  if (command === 'tokens') {
    await runGenerateTokens(rest);
    return;
  }

  if (command === 'tailwindcss') {
    await runGenerateTailwindCss(rest);
    return;
  }

  if (command === 'theme') {
    await runGenerateTheme(rest);
    return;
  }

  await runPreset(command, rest);
}
// 打印帮助信息
function printHelp() {
  console.log(`proto-ui

Usage:
  proto-ui [--help|-h|-help|help]
  proto-ui init [--help|-h|-help] [...]
  proto-ui init [--styles-dir <dir>] [--no-tailwind] [--adapter <name>] [--prototypes <name>] [--install] [--no-install] [--no-interactive] [--defaults|-y]
  proto-ui <theme> [--styles-dir <dir>]
  proto-ui tokens --input <dir> --out <file>
  proto-ui tailwindcss [--theme-import <path>] [--tokens-import <path>] --out <file>
  proto-ui theme <name> --out <file>

Init layout (same as website Quick Start):
${PROTO_UI_LAYOUT_TXT}

Examples:
  proto-ui init --adapter vue --prototypes shadcn --install
  proto-ui init --defaults --no-tailwind
  proto-ui init --no-interactive --no-tailwind
  proto-ui init --no-tailwind
  proto-ui shadcn --styles-dir ./src/styles
  proto-ui tokens --input ./packages/prototypes --out ./src/styles/prototype-tokens.generated.css
  proto-ui tailwindcss --out ./src/styles/tailwindcss.css
  proto-ui theme shadcn --out ./src/styles/shadcn-theme.css
`);
}

// 打印 init 帮助信息
// TODO：还没有写好
function printInitHelp() {
  console.log(`proto-ui init

Creates ./proto-ui/ at the project root (see Quick Start docs). Typical layout:

${PROTO_UI_LAYOUT_TXT}

Also writes proto-ui/config.json and (unless --no-tailwind) generates shadcn CSS presets under --styles-dir.

Usage:
  proto-ui init [--help|-h|-help] [...]
  proto-ui init [--styles-dir <dir>] [--no-tailwind] [--adapter <name>] [--prototypes <name>] [--install] [--no-install] [--no-interactive] [--defaults|-y]

Options:
  --styles-dir <dir>     Where to write CSS presets (default: ./src/styles). Used when Tailwind setup runs.
  --no-tailwind          Skip generating shadcn tokens + theme + tailwindcss preset files.
  --adapter <name>       Host adapter package: vue | react | web-component | wc
  --prototypes <name>    Prototype library: shadcn
  --install              Force running the package manager (also needed in non-interactive mode without TTY prompts).
  --no-install           In interactive mode, skip auto-install and only print suggested npm/pnpm/yarn commands.
  --no-interactive       Never prompt (use in CI / scripts).
  --defaults, -y        When not prompting (non-TTY / --no-interactive), set adapter vue + prototypes shadcn unless passed explicitly.

When stdin and stdout are both TTYs, omitting --adapter / --prototypes shows interactive menus. By default, init runs your package manager to add adapter, prototypes, and @proto.ui/cli (dev), even if npx reports a non-TTY stream; use --no-install to skip. In CI or with --no-interactive, pass --install to install, or --no-install to only print suggested commands.

Examples:
  proto-ui init
  proto-ui init --adapter vue --prototypes shadcn --install
  proto-ui init --defaults --no-tailwind
  proto-ui init --styles-dir ./app/styles --adapter react --prototypes shadcn --install
`);
}

function hasCliFlag(argv, name) {
  const prefix = `--${name}=`;
  return argv.some((a) => a === `--${name}` || a.startsWith(prefix));
}

function allowInitPrompts(argv) {
  if (hasCliFlag(argv, 'no-interactive')) return false;
  if (process.env.CI === 'true' || process.env.CI === '1') return false;
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  return true;
}

/**
 * Whether init should run the package manager without `--install`.
 * Intentionally not tied to TTY: `npx` often runs with stdin/stdout not reported as TTY,
 * but a human still expects deps installed after `init` (unless CI / --no-interactive / --no-install).
 */
function allowDefaultInitInstall(argv) {
  if (hasCliFlag(argv, 'no-interactive')) return false;
  if (process.env.CI === 'true' || process.env.CI === '1') return false;
  return true;
}

// 提示用户选择框架适配器
async function promptAdapterKey() {
  const response = await prompts(
    {
      type: 'select',
      name: 'adapter',
      message: 'Which framework adapter should Proto UI target?',
      initial: 0,
      choices: [
        { title: 'Vue', value: 'vue' },
        { title: 'React', value: 'react' },
        { title: 'Web Components', value: 'web-component' },
        { title: 'Skip (configure later)', value: '' },
      ],
    },
    {
      onCancel: () => {
        throw new Error('init cancelled by user');
      },
    }
  );
  return response.adapter ?? '';
}

// 提示用户选择原型库
async function promptPrototypesKey() {
  const response = await prompts(
    {
      type: 'select',
      name: 'prototypes',
      message: 'Which prototype / component library?',
      initial: 0,
      choices: [
        { title: 'shadcn-style', value: 'shadcn' },
        { title: 'Skip (configure later)', value: '' },
      ],
    },
    {
      onCancel: () => {
        throw new Error('init cancelled by user');
      },
    }
  );
  return response.prototypes ?? '';
}

async function runInit(args) {
  if (args.some(isHelpToken)) {
    printInitHelp();
    return;
  }

  const options = parseOptions(args);
  const cwd = process.cwd();
  const stylesDir = options['styles-dir'] ?? './src/styles';
  const skipTailwind = options['no-tailwind'] === 'true';
  let adapterKey = (options['adapter'] ?? '').toLowerCase();
  let prototypesKey = (options['prototypes'] ?? '').toLowerCase();
  let doInstall = options['install'] === 'true';
  const skipInstallPrompt = hasCliFlag(args, 'no-install') || options['no-install'] === 'true';

  const usePrompts = allowInitPrompts(args);
  const useDefaults = hasCliFlag(args, 'defaults') || hasCliFlag(args, 'y') || args.includes('-y');

  if (!usePrompts && useDefaults) {
    if (!hasCliFlag(args, 'adapter') && !adapterKey) adapterKey = 'vue';
    if (!hasCliFlag(args, 'prototypes') && !prototypesKey) prototypesKey = 'shadcn';
  }

  if (usePrompts && (!hasCliFlag(args, 'adapter') || !hasCliFlag(args, 'prototypes'))) {
    if (!hasCliFlag(args, 'adapter')) {
      adapterKey = await promptAdapterKey();
    }
    if (!hasCliFlag(args, 'prototypes')) {
      prototypesKey = await promptPrototypesKey();
    }
  }

  if (adapterKey && !ADAPTER_PACKAGES[adapterKey]) {
    const label = options['adapter'] ?? adapterKey;
    throw new Error(`unknown adapter "${label}". supported: vue, react, web-component`);
  }
  if (prototypesKey && !PROTOTYPE_PACKAGES[prototypesKey]) {
    const label = options['prototypes'] ?? prototypesKey;
    throw new Error(
      `unknown prototypes "${label}". supported: ${Object.keys(PROTOTYPE_PACKAGES).join(', ')}`
    );
  }

  if (!doInstall && !skipInstallPrompt && allowDefaultInitInstall(args)) {
    doInstall = true;
  }

  const protoRoot = path.join(cwd, 'proto-ui');
  await fs.mkdir(path.join(protoRoot, 'adapters'), { recursive: true });
  await fs.mkdir(path.join(protoRoot, 'prototypes'), { recursive: true });
  await fs.mkdir(path.join(protoRoot, 'components'), { recursive: true });

  const adapterPackage = adapterKey ? ADAPTER_PACKAGES[adapterKey] : null;
  const prototypePackages = prototypesKey ? [PROTOTYPE_PACKAGES[prototypesKey]] : [];

  const config = {
    version: 1,
    stylesDir,
    tailwind: {
      enabled: !skipTailwind,
      preset: !skipTailwind ? DEFAULT_THEME_NAME : null,
    },
    adapter: adapterPackage,
    prototypeLibraries: prototypePackages,
  };

  const configPath = path.join(protoRoot, 'config.json');
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(`[proto-ui] init: wrote ${relativeToCwd(configPath)}`);
  console.log(
    '[proto-ui] init: created proto-ui/adapters, proto-ui/prototypes, proto-ui/components (matches Quick Start layout)'
  );

  if (!skipTailwind) {
    await runPreset(DEFAULT_THEME_NAME, ['--styles-dir', stylesDir]);
  } else {
    console.log('[proto-ui] init: skipped Tailwind preset generation (--no-tailwind)');
  }

  if (doInstall) {
    const pm = await detectPackageManager(cwd);
    const prod = [];
    if (adapterPackage) prod.push(adapterPackage);
    prod.push(...prototypePackages);
    if (prod.length) {
      runPmAdd(pm, cwd, prod, false);
    }
    runPmAdd(pm, cwd, [CLI_PACKAGE], true);
    console.log(`[proto-ui] init: installed packages via ${pm}`);
  } else {
    const pm = await detectPackageManager(cwd);
    console.log(
      '[proto-ui] init: next steps (install packages yourself, or re-run with --install):'
    );
    if (adapterPackage) {
      console.log(`  ${formatPmInstallLine(pm, adapterPackage, false)}`);
    }
    for (const pkg of prototypePackages) {
      console.log(`  ${formatPmInstallLine(pm, pkg, false)}`);
    }
    console.log(`  ${formatPmInstallLine(pm, CLI_PACKAGE, true)}`);
  }
}

async function detectPackageManager(cwd) {
  try {
    await fs.access(path.join(cwd, 'pnpm-lock.yaml'));
    return 'pnpm';
  } catch {
    /* ignore */
  }
  try {
    await fs.access(path.join(cwd, 'yarn.lock'));
    return 'yarn';
  } catch {
    /* ignore */
  }
  return 'npm';
}

function runPmAdd(pm, cwd, packages, dev) {
  let cmd;
  let args;
  if (pm === 'pnpm') {
    cmd = 'pnpm';
    args = dev ? ['add', '-D', ...packages] : ['add', ...packages];
  } else if (pm === 'yarn') {
    cmd = 'yarn';
    args = dev ? ['add', '-D', ...packages] : ['add', ...packages];
  } else {
    cmd = 'npm';
    args = dev ? ['install', '--save-dev', ...packages] : ['install', '--save', ...packages];
  }
  // Windows: spawnSync needs shell:true to resolve npm/yarn/pnpm via .cmd shims.
  // Node 18.20+ blocks .cmd/.bat under shell:false (CVE-2024-27980 mitigation).
  const isWindows = process.platform === 'win32';
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: isWindows,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited with code ${result.status ?? 'unknown'}`);
  }
}

function formatPmInstallLine(pm, pkg, dev) {
  if (pm === 'pnpm') return dev ? `pnpm add -D ${pkg}` : `pnpm add ${pkg}`;
  if (pm === 'yarn') return dev ? `yarn add -D ${pkg}` : `yarn add ${pkg}`;
  return dev ? `npm install --save-dev ${pkg}` : `npm install --save ${pkg}`;
}

async function runPreset(themeName, args) {
  const options = parseOptions(args);
  const normalizedTheme = themeName.toLowerCase();
  if (normalizedTheme !== DEFAULT_THEME_NAME) {
    throw new Error(
      `unsupported theme "${themeName}". currently supported: ${DEFAULT_THEME_NAME}.`
    );
  }
  const stylesDir = options['styles-dir'] ?? './src/styles';
  const tokensFileName = options['tokens-file'] ?? 'prototype-tokens.generated.css';
  const tailwindFileName = options['tailwind-file'] ?? 'tailwindcss.css';
  const themeFileName = options['theme-file'] ?? `${normalizedTheme}-theme.css`;

  const tokensOut = path.join(stylesDir, tokensFileName);
  const themeOut = path.join(stylesDir, themeFileName);
  const tailwindOut = path.join(stylesDir, tailwindFileName);

  const tokensOutputFile = path.resolve(process.cwd(), tokensOut);
  await ensureDirectory(tokensOutputFile);
  await fs.writeFile(tokensOutputFile, SHADCN_TOKENS_CSS, 'utf8');
  console.log(`[proto-ui] tokens(preset): wrote ${relativeToCwd(tokensOutputFile)}`);

  await runGenerateTheme([normalizedTheme, '--out', themeOut]);

  const tailwindAbs = path.resolve(process.cwd(), tailwindOut);
  const themeImport = toCssImportPath(tailwindAbs, path.resolve(process.cwd(), themeOut));
  const tokensImport = toCssImportPath(tailwindAbs, path.resolve(process.cwd(), tokensOut));

  await runGenerateTailwindCss([
    '--out',
    tailwindOut,
    '--theme-import',
    themeImport,
    '--tokens-import',
    tokensImport,
  ]);

  console.log(
    `[proto-ui] setup(${normalizedTheme}): completed tokens + theme + tailwindcss in ${stylesDir}`
  );
}

async function runGenerateTokens(args) {
  const options = parseOptions(args);
  const input = requiredOption(options, 'input');
  const outFile = requiredOption(options, 'out');
  const root = path.resolve(process.cwd(), input);
  const outputFile = path.resolve(process.cwd(), outFile);

  const files = await collectSourceFiles(root);
  const tokens = new Set();

  for (const file of files) {
    const sourceText = await fs.readFile(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKindForFile(file)
    );
    const scope = createScope();
    walk(sourceFile, scope, tokens);
  }

  const css = renderTokenCss(Array.from(tokens).sort());
  await ensureDirectory(outputFile);
  await fs.writeFile(outputFile, css, 'utf8');
  console.log(`[proto-ui] tokens: wrote ${tokens.size} tokens -> ${relativeToCwd(outputFile)}`);
}

async function runGenerateTailwindCss(args) {
  const options = parseOptions(args);
  const outFile = requiredOption(options, 'out');
  const themeImport = options['theme-import'] ?? DEFAULT_THEME_IMPORT;
  const tokensImport = options['tokens-import'] ?? DEFAULT_TOKENS_IMPORT;
  const outputFile = path.resolve(process.cwd(), outFile);
  const css = TAILWIND_BASE_TEMPLATE.replace('__THEME_IMPORT__', themeImport).replace(
    '__TOKENS_IMPORT__',
    tokensImport
  );

  await ensureDirectory(outputFile);
  await fs.writeFile(outputFile, css, 'utf8');
  console.log(`[proto-ui] tailwindcss: wrote ${relativeToCwd(outputFile)}`);
}

async function runGenerateTheme(args) {
  const [name, ...rest] = args;
  if (!name || name.startsWith('-')) {
    throw new Error(
      'theme name is required. Example: proto-ui theme shadcn --out ./src/styles/shadcn-theme.css'
    );
  }

  const options = parseOptions(rest);
  const outFile = requiredOption(options, 'out');
  const outputFile = path.resolve(process.cwd(), outFile);
  const normalizedName = name.toLowerCase();

  let css = '';
  if (normalizedName === DEFAULT_THEME_NAME) {
    css = SHADCN_THEME_CSS;
  } else {
    throw new Error(`unsupported theme "${name}". currently supported: ${DEFAULT_THEME_NAME}.`);
  }

  await ensureDirectory(outputFile);
  await fs.writeFile(outputFile, css, 'utf8');
  console.log(`[proto-ui] theme(${normalizedName}): wrote ${relativeToCwd(outputFile)}`);
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = 'true';
      continue;
    }
    options[key] = next;
    i += 1;
  }
  return options;
}

function requiredOption(options, key) {
  const value = options[key];
  if (!value) throw new Error(`missing required option: --${key}`);
  return value;
}

async function ensureDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function relativeToCwd(filePath) {
  return path.relative(process.cwd(), filePath) || '.';
}

function toCssImportPath(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  const relative = path.relative(fromDir, toFile).replace(/\\/g, '/');
  if (relative.startsWith('.')) return relative;
  return `./${relative}`;
}

function createScope(parent = null) {
  return { parent, bindings: new Map() };
}

function walk(node, scope, tokens) {
  if (createsScope(node)) {
    const nextScope = createScope(scope);

    if (hasStatements(node)) {
      for (const stmt of node.statements) {
        if (ts.isVariableStatement(stmt)) {
          for (const decl of stmt.declarationList.declarations) {
            registerDeclaration(decl, nextScope);
            if (decl.initializer) walk(decl.initializer, nextScope, tokens);
          }
          continue;
        }
        walk(stmt, nextScope, tokens);
      }
      return;
    }

    ts.forEachChild(node, (child) => walk(child, nextScope, tokens));
    return;
  }

  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'tw'
  ) {
    for (const arg of node.arguments) {
      const value = resolveExpression(arg, scope);
      for (const token of value.strings.flatMap(splitTokens)) {
        tokens.add(token);
      }
    }
  }

  if (ts.isCallExpression(node) && isPropertyNamed(node.expression, 'rule')) {
    collectRuleVariantTokens(node, scope, tokens);
  }

  ts.forEachChild(node, (child) => walk(child, scope, tokens));
}

function createsScope(node) {
  return (
    ts.isSourceFile(node) ||
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  );
}

function hasStatements(node) {
  return (
    ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node) || ts.isCaseBlock(node)
  );
}

function registerDeclaration(decl, scope) {
  if (!ts.isIdentifier(decl.name) || !decl.initializer) return;
  scope.bindings.set(decl.name.text, resolveBinding(decl.initializer, scope));
}

function resolveExpression(node, scope) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return asStringValue([node.text]);
  }

  if (ts.isArrayLiteralExpression(node)) {
    const parts = [];
    for (const element of node.elements) {
      const value = resolveExpression(element, scope);
      if (!value.single) return emptyValue();
      parts.push(value.single);
    }
    return asStringValue([parts.join(',')]);
  }

  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'join'
  ) {
    return resolveJoinCall(node, scope);
  }

  if (ts.isIdentifier(node)) {
    return lookup(node.text, scope);
  }

  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    return resolveExpression(node.expression, scope);
  }

  if (ts.isObjectLiteralExpression(node)) {
    const entries = new Map();
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = getPropertyName(prop.name);
        if (!key) continue;
        const value = resolveExpression(prop.initializer, scope);
        if (value.strings.length > 0) entries.set(key, value.strings);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        const value = lookup(prop.name.text, scope);
        if (value.strings.length > 0) entries.set(prop.name.text, value.strings);
      }
    }
    return asMapValue(entries);
  }

  if (ts.isElementAccessExpression(node)) {
    const base = resolveExpression(node.expression, scope);
    if (!base.map) return emptyValue();

    if (node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) {
      return asStringValue(base.map.get(node.argumentExpression.text) ?? []);
    }

    const out = new Set();
    for (const strings of base.map.values()) {
      for (const value of strings) out.add(value);
    }
    return asStringValue(Array.from(out));
  }

  if (ts.isConditionalExpression(node)) {
    const values = new Set([
      ...resolveExpression(node.whenTrue, scope).strings,
      ...resolveExpression(node.whenFalse, scope).strings,
    ]);
    return asStringValue(Array.from(values));
  }

  return emptyValue();
}

function resolveJoinCall(node, scope) {
  const separatorArg = node.arguments[0];
  const separator =
    separatorArg &&
    (ts.isStringLiteralLike(separatorArg) || ts.isNoSubstitutionTemplateLiteral(separatorArg))
      ? separatorArg.text
      : ',';
  const base = resolveExpression(node.expression.expression, scope);
  if (!base.single) return emptyValue();
  return asStringValue([base.single.split(',').join(separator)]);
}

function lookup(name, scope) {
  let current = scope;
  while (current) {
    const value = current.bindings.get(name);
    if (value) return value;
    current = current.parent;
  }
  return emptyValue();
}

function resolveBinding(node, scope) {
  const semantic = resolveSemanticBinding(node);
  const value = resolveExpression(node, scope);
  return semantic ? { ...value, semantic } : value;
}

function resolveSemanticBinding(node) {
  if (
    !ts.isCallExpression(node) ||
    !isPropertyAccessChain(node.expression, ['state', 'fromInteraction'])
  ) {
    if (
      !ts.isCallExpression(node) ||
      !isPropertyAccessChain(node.expression, ['state', 'fromAccessibility'])
    ) {
      return null;
    }
  }

  const kind = node.expression.name.text === 'fromInteraction' ? 'interaction' : 'accessibility';
  const firstArg = node.arguments[0];
  if (!firstArg || !ts.isStringLiteralLike(firstArg)) return null;
  const name = firstArg.text;

  if (kind === 'interaction') {
    return (
      {
        hovered: 'hover',
        pressed: 'active',
        disabled: 'data-[disabled]',
        focused: 'data-[focused]',
        focusVisible: 'data-[focus-visible]',
      }[name] ?? null
    );
  }

  return (
    {
      expanded: 'aria-expanded',
      invalid: 'aria-invalid',
      selected: 'aria-selected',
      checked: 'aria-checked',
      current: 'aria-current',
    }[name] ?? null
  );
}

function collectRuleVariantTokens(node, scope, tokens) {
  const config = node.arguments[0];
  if (!config || !ts.isObjectLiteralExpression(config)) return;

  const whenProp = config.properties.find(
    (prop) => ts.isPropertyAssignment(prop) && getPropertyName(prop.name) === 'when'
  );
  const intentProp = config.properties.find(
    (prop) => ts.isPropertyAssignment(prop) && getPropertyName(prop.name) === 'intent'
  );
  if (
    !whenProp ||
    !intentProp ||
    !ts.isPropertyAssignment(whenProp) ||
    !ts.isPropertyAssignment(intentProp)
  ) {
    return;
  }

  const variants = analyzeWhenVariants(whenProp.initializer, scope);
  if (variants.length === 0) return;

  const intentTokens = collectTwTokens(intentProp.initializer, scope);
  for (const token of intentTokens) {
    tokens.add(`${variants.join(':')}:${token}`);
  }
}

function analyzeWhenVariants(node, scope) {
  const out = new Set();

  visit(node);
  return Array.from(out).sort(compareVariants);

  function visit(current) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      visit(current.body);
      return;
    }

    if (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      visit(current.expression);
      return;
    }

    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const method = current.expression.name.text;

      if (method === 'all' || method === 'any') {
        for (const arg of current.arguments) visit(arg);
        return;
      }

      if (method === 'eq') {
        const subject = current.expression.expression;
        if (ts.isCallExpression(subject) && ts.isPropertyAccessExpression(subject.expression)) {
          const subjectMethod = subject.expression.name.text;
          if (subjectMethod === 'state') {
            const firstArg = subject.arguments[0];
            if (firstArg && ts.isIdentifier(firstArg)) {
              const binding = lookup(firstArg.text, scope);
              if (binding.semantic) out.add(binding.semantic);
            }
            return;
          }

          if (subjectMethod === 'meta') {
            const key = subject.arguments[0];
            const value = current.arguments[0];
            if (
              key &&
              value &&
              ts.isStringLiteralLike(key) &&
              ts.isStringLiteralLike(value) &&
              key.text === 'colorScheme' &&
              value.text === 'dark'
            ) {
              out.add('dark');
            }
          }
        }
      }
    }

    ts.forEachChild(current, visit);
  }
}

function collectTwTokens(node, scope) {
  const found = new Set();

  visit(node, scope);
  return Array.from(found);

  function visit(current, currentScope) {
    if (createsScope(current)) {
      const nextScope = createScope(currentScope);
      if (hasStatements(current)) {
        for (const stmt of current.statements) {
          if (ts.isVariableStatement(stmt)) {
            for (const decl of stmt.declarationList.declarations) {
              registerDeclaration(decl, nextScope);
              if (decl.initializer) visit(decl.initializer, nextScope);
            }
            continue;
          }
          visit(stmt, nextScope);
        }
        return;
      }
    }

    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === 'tw'
    ) {
      for (const arg of current.arguments) {
        const value = resolveExpression(arg, currentScope);
        for (const token of value.strings.flatMap(splitTokens)) found.add(token);
      }
    }

    ts.forEachChild(current, (child) => visit(child, currentScope));
  }
}

function compareVariants(a, b) {
  const order = ['dark', 'hover', 'active', 'focus', 'focus-visible', 'disabled'];
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return a.localeCompare(b);
}

function isPropertyNamed(node, name) {
  return ts.isPropertyAccessExpression(node) && node.name.text === name;
}

function isPropertyAccessChain(node, names) {
  let current = node;
  for (let i = names.length - 1; i >= 0; i -= 1) {
    if (!ts.isPropertyAccessExpression(current) || current.name.text !== names[i]) return false;
    current = current.expression;
  }
  return ts.isIdentifier(current);
}

function getPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return null;
}

function splitTokens(value) {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function emptyValue() {
  return { strings: [], single: null, map: null, semantic: null };
}

function asStringValue(strings) {
  return {
    strings,
    single: strings.length === 1 ? strings[0] : null,
    map: null,
    semantic: null,
  };
}

function asMapValue(map) {
  const strings = [];
  for (const values of map.values()) strings.push(...values);
  return {
    strings,
    single: null,
    map,
    semantic: null,
  };
}

function renderTokenCss(tokens) {
  const lines = [
    '/* This file is auto-generated by @proto.ui/cli (proto-ui tokens). */',
    '/* Do not edit by hand. */',
    '',
  ];

  for (const token of tokens) {
    lines.push(`@source inline("${escapeForCss(token)}");`);
  }

  lines.push('');
  return lines.join('\n');
}

function escapeForCss(token) {
  return token.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function scriptKindForFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

async function collectSourceFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'test' || entry.name === 'node_modules') continue;
      out.push(...(await collectSourceFiles(fullPath)));
      continue;
    }
    if (
      entry.isFile() &&
      /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry.name) &&
      !/\.d\.ts$/i.test(entry.name)
    ) {
      out.push(fullPath);
    }
  }
  return out;
}
