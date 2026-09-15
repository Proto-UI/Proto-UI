// @ts-nocheck
// Legacy command orchestration retained from the original .mjs implementation.
// The extracted services and the newer commands, registry, and configuration
// surfaces carry the reusable implementation boundaries.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import prompts from 'prompts';

import {
  ADAPTER_PACKAGES,
  PROTOTYPE_PACKAGES,
  CLI_PACKAGE,
  DEFAULT_THEME_NAME,
  DEFAULT_THEME_IMPORT,
  DEFAULT_TOKENS_IMPORT,
  SHADCN_STYLE_TOKENS,
  SHADCN_THEME_CSS,
  BRUTALIST_STYLE_TOKENS,
  BRUTALIST_THEME_CSS,
} from './type.js';
import {
  renderPrefixedThemeCss,
  renderProtoStyleEntryCss,
  renderProtoStyleTokenCss,
} from '../services/proto-style-css.js';
import {
  collectProtoStyleTokens,
  collectProtoShadowStyleTokenUsage,
} from '../services/prototype-style-tokens.js';
import { generateShadowStyleOutputs, shadowOutputPath } from '../services/shadow-style-output.js';

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
    throw new Error('The tailwindcss command has been removed. Use `proto-ui style` instead.');
  }

  if (command === 'style') {
    await runGenerateStyleCss(rest);
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
  proto-ui init [--styles-dir <dir>] [--no-styles] [--adapter <name>] [--prototypes <name>] [--install] [--no-install] [--no-interactive] [--defaults|-y]
  proto-ui <shadcn|brutalist> [--styles-dir <dir>] [--shadow-out <file.js>]
  proto-ui tokens --input <dir> --out <file> [--shadow-out <file.js>]
  proto-ui style [--theme-import <path>] [--tokens-import <path>] --out <file>
  proto-ui theme <name> --out <file>

--shadow-out writes an ESM protoShadowStyleArtifact and same-stem .d.ts alongside
the document CSS generation. It does not activate a split Shadow Adapter.

Init layout (same as website Quick Start):
${PROTO_UI_LAYOUT_TXT}

Examples:
  proto-ui init --adapter vue --prototypes shadcn --install
  proto-ui init --defaults --no-styles
  proto-ui init --no-interactive --no-styles
  proto-ui init --no-styles
  proto-ui shadcn --styles-dir ./src/styles
  proto-ui tokens --input ./packages/prototypes --out ./src/styles/proto-ui-tokens.generated.css
  proto-ui style --out ./src/styles/proto-ui-style.css
  proto-ui theme shadcn --out ./src/styles/shadcn-theme.css
`);
}

// 打印 init 帮助信息
// TODO：还没有写好
function printInitHelp() {
  console.log(`proto-ui init

Creates ./proto-ui/ at the project root (see Quick Start docs). Typical layout:

${PROTO_UI_LAYOUT_TXT}

Also writes proto-ui/config.json and (unless --no-styles) generates Proto UI CSS presets under --styles-dir.

Usage:
  proto-ui init [--help|-h|-help] [...]
  proto-ui init [--styles-dir <dir>] [--no-styles] [--adapter <name>] [--prototypes <name>] [--install] [--no-install] [--no-interactive] [--defaults|-y]

Options:
  --styles-dir <dir>     Where to write CSS presets (default: ./src/styles).
  --no-styles            Skip generating shadcn tokens + theme + Proto UI style preset files.
  --no-tailwind          Alias of --no-styles.
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
  proto-ui init --defaults --no-styles
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
        { title: 'brutalist-style', value: 'brutalist' },
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
  const skipStyles = options['no-styles'] === 'true' || options['no-tailwind'] === 'true';
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
    styles: {
      enabled: !skipStyles,
      preset: !skipStyles ? prototypesKey || DEFAULT_THEME_NAME : null,
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

  if (!skipStyles) {
    await runPreset(prototypesKey || DEFAULT_THEME_NAME, ['--styles-dir', stylesDir]);
  } else {
    console.log('[proto-ui] init: skipped style preset generation');
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
  const shadowPath = shadowOutputPath(args);
  const options = parseOptions(args);
  const normalizedTheme = themeName.toLowerCase();
  if (normalizedTheme !== DEFAULT_THEME_NAME && normalizedTheme !== 'brutalist') {
    throw new Error(
      `unsupported theme "${themeName}". currently supported: ${DEFAULT_THEME_NAME}, brutalist.`
    );
  }
  const stylesDir = options['styles-dir'] ?? './src/styles';
  const tokensFileName = options['tokens-file'] ?? 'proto-ui-tokens.generated.css';
  const styleFileName = options['style-file'] ?? options['tailwind-file'] ?? 'proto-ui-style.css';
  const themeFileName = options['theme-file'] ?? `${normalizedTheme}-theme.css`;

  const tokensOut = path.join(stylesDir, tokensFileName);
  const themeOut = path.join(stylesDir, themeFileName);
  const styleOut = path.join(stylesDir, styleFileName);

  const tokensOutputFile = path.resolve(process.cwd(), tokensOut);
  const presetTokens =
    normalizedTheme === 'brutalist' ? BRUTALIST_STYLE_TOKENS : SHADCN_STYLE_TOKENS;
  if (shadowPath) {
    const styleAbs = path.resolve(styleOut);
    const themeAbs = path.resolve(themeOut);
    await generateShadowStyleOutputs({
      shadowPath,
      cssPath: tokensOutputFile,
      tokens: async () => presetTokens,
      additional: [
        {
          path: themeAbs,
          content: renderPrefixedThemeCss(
            normalizedTheme === 'brutalist' ? BRUTALIST_THEME_CSS : SHADCN_THEME_CSS
          ),
        },
        {
          path: styleAbs,
          content: renderProtoStyleEntryCss({
            themeImport: toCssImportPath(styleAbs, themeAbs),
            tokensImport: toCssImportPath(styleAbs, tokensOutputFile),
          }),
        },
      ],
    });
    return;
  }
  await ensureDirectory(tokensOutputFile);
  await fs.writeFile(tokensOutputFile, renderTokenCss(presetTokens), 'utf8');
  console.log(`[proto-ui] tokens(preset): wrote ${relativeToCwd(tokensOutputFile)}`);

  await runGenerateTheme([normalizedTheme, '--out', themeOut]);

  const styleAbs = path.resolve(process.cwd(), styleOut);
  const themeImport = toCssImportPath(styleAbs, path.resolve(process.cwd(), themeOut));
  const tokensImport = toCssImportPath(styleAbs, path.resolve(process.cwd(), tokensOut));

  await runGenerateStyleCss([
    '--out',
    styleOut,
    '--theme-import',
    themeImport,
    '--tokens-import',
    tokensImport,
  ]);

  console.log(
    `[proto-ui] setup(${normalizedTheme}): completed tokens + theme + proto-ui style in ${stylesDir}`
  );
}

async function runGenerateTokens(args) {
  const shadowPath = shadowOutputPath(args);
  const options = parseOptions(args);
  const input = requiredOption(options, 'input');
  const outFile = requiredOption(options, 'out');
  const root = path.resolve(process.cwd(), input);
  const outputFile = path.resolve(process.cwd(), outFile);

  if (shadowPath) {
    await generateShadowStyleOutputs({
      shadowPath,
      cssPath: outputFile,
      tokens: () => collectProtoShadowStyleTokenUsage(root),
    });
    return;
  }

  const tokens = await collectProtoStyleTokens(root);
  const css = renderTokenCss(tokens);
  await ensureDirectory(outputFile);
  await fs.writeFile(outputFile, css, 'utf8');
  console.log(`[proto-ui] tokens: wrote ${tokens.length} tokens -> ${relativeToCwd(outputFile)}`);
}

async function runGenerateStyleCss(args) {
  const options = parseOptions(args);
  const outFile = requiredOption(options, 'out');
  const themeImport = options['theme-import'] ?? DEFAULT_THEME_IMPORT;
  const tokensImport = options['tokens-import'] ?? DEFAULT_TOKENS_IMPORT;
  const outputFile = path.resolve(process.cwd(), outFile);
  const css = renderProtoStyleEntryCss({ themeImport, tokensImport });

  await ensureDirectory(outputFile);
  await fs.writeFile(outputFile, css, 'utf8');
  console.log(`[proto-ui] style: wrote ${relativeToCwd(outputFile)}`);
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
    css = renderPrefixedThemeCss(SHADCN_THEME_CSS);
  } else if (normalizedName === 'brutalist') {
    css = renderPrefixedThemeCss(BRUTALIST_THEME_CSS);
  } else {
    throw new Error(
      `unsupported theme "${name}". currently supported: ${DEFAULT_THEME_NAME}, brutalist.`
    );
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

function renderTokenCss(tokens) {
  return renderProtoStyleTokenCss(tokens);
}
