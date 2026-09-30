import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compileFile, writeCompilation } from './compile';
import { diagnosticsJson, formatCompilerDiagnostics } from './diagnostic-format';
import type { CompilerDiagnostic } from './ir';
import { resolveTargetProfile, TARGET_PROFILES } from './targets';

export interface CompilerCliEnvironment {
  cwd?: string;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}

type Command = 'compile' | 'check' | 'inspect' | 'explain';
interface Options {
  entry?: string;
  root?: string;
  export?: string;
  output?: string;
  profile?: string;
  json?: boolean;
}
interface ParsedArguments {
  command?: Command;
  options: Options;
  config?: string;
  help: boolean;
}

const HELP = `Private Proto UI compiler
Usage: proto-compiler <compile|check|inspect|explain> [entry] [options]

Commands:
  compile  Compile an entry and exclusively create a fresh output directory.
  check    Run the same compiler and profile checks without writing artifacts.
  inspect  Compile and print checked semantic IR (JSON, private versioned format).
  explain  Compile and report requirements, emitted profile and actual dependencies.

Options:
  --entry <file>      Entry source; alternatively supply one positional entry.
  --root <directory> Declared source root (default: current working directory).
  --export <name>    Selected entry export (default: default).
  --output <dir>     Required for compile; never overwritten or implicitly selected.
  --profile <id>     ${Object.values(TARGET_PROFILES).filter((target) => target.implemented).map((target) => target.id).join(', ')}.
                     Default: react-runtime-v1; no implicit target fallback.
  --config <file>    Explicit JSON configuration file; no automatic discovery.
  --json             Machine-readable result and diagnostics on stdout.
  --help             Print this help.

Configuration is a JSON object with only these fields:
  entry, root, export, output, profile: non-empty strings; json: boolean.
Paths in configuration are relative to the configuration file's directory.
Command-line paths are relative to cwd; command-line values override configuration.
check/inspect/explain ignore configured output and never write; --output is compile-only.
Unknown fields/flags and repeated flags are errors. No watch, incremental or diff command.

Exit codes: 0 success; 1 rejected input/profile or output conflict;
            2 command/configuration error; 3 unexpected compiler defect.
`;

class CliUsageError extends Error {
  constructor(message: string, readonly file = '<cli>') {
    super(message);
  }
}

function nonEmptyString(value: unknown, field: string, file = '<cli>'): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new CliUsageError(`${field} must be a non-empty string`, file);
  return value;
}

function parseArguments(argv: readonly string[]): ParsedArguments {
  const result: ParsedArguments = { options: {}, help: false };
  let index = 0;
  if (argv[0] && !argv[0].startsWith('-')) {
    const command = argv[index++];
    if (!['compile', 'check', 'inspect', 'explain'].includes(command))
      throw new CliUsageError(`Unsupported command ${JSON.stringify(command)}; use --help for supported commands`);
    result.command = command as Command;
  }
  const seen = new Set<string>();
  let positional = false;
  for (; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--' && !positional) {
      positional = true;
      continue;
    }
    if (positional || !token.startsWith('-')) {
      if (seen.has('entry')) throw new CliUsageError('Specify exactly one entry');
      seen.add('entry');
      result.options.entry = nonEmptyString(token, 'entry');
      continue;
    }
    const equals = token.indexOf('=');
    const flag = equals < 0 ? token : token.slice(0, equals);
    const attached = equals < 0 ? undefined : token.slice(equals + 1);
    const name = flag.slice(2);
    if (!['--entry', '--root', '--export', '--output', '--profile', '--config', '--json', '--help'].includes(flag))
      throw new CliUsageError(`Unknown flag ${JSON.stringify(flag)}`);
    if (seen.has(name)) throw new CliUsageError(`Repeated flag ${flag}`);
    seen.add(name);
    if (name === 'help' || name === 'json') {
      if (attached !== undefined) throw new CliUsageError(`${flag} does not take a value`);
      if (name === 'help') result.help = true;
      else result.options.json = true;
      continue;
    }
    const value = attached ?? argv[++index];
    if (value === undefined || (attached === undefined && value.startsWith('-')))
      throw new CliUsageError(`${flag} requires a value; use ${flag}=<value> for a value beginning with '-'`);
    const checked = nonEmptyString(value, flag);
    switch (name) {
      case 'entry': result.options.entry = checked; break;
      case 'root': result.options.root = checked; break;
      case 'export': result.options.export = checked; break;
      case 'output': result.options.output = checked; break;
      case 'profile': result.options.profile = checked; break;
      case 'config': result.config = checked; break;
    }
  }
  if (!result.command && !result.help) throw new CliUsageError('A command is required; use --help');
  return result;
}

async function readConfiguration(filename: string): Promise<Options> {
  let data: unknown;
  try {
    data = JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    throw new CliUsageError(`Cannot read JSON configuration: ${error instanceof Error ? error.message : String(error)}`, filename);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data))
    throw new CliUsageError('Configuration must be a JSON object', filename);
  const options: Options = {};
  for (const [key, value] of Object.entries(data)) {
    switch (key) {
      case 'entry': case 'root': case 'output':
        options[key] = path.resolve(path.dirname(filename), nonEmptyString(value, key, filename));
        break;
      case 'export': options.export = nonEmptyString(value, key, filename); break;
      case 'profile': options.profile = nonEmptyString(value, key, filename); break;
      case 'json':
        if (typeof value !== 'boolean') throw new CliUsageError('json must be a boolean', filename);
        options.json = value;
        break;
      default: throw new CliUsageError(`Unknown configuration field ${JSON.stringify(key)}`, filename);
    }
  }
  return options;
}

function cliDiagnostic(code: string, category: CompilerDiagnostic['category'], message: string, file = '<cli>'): CompilerDiagnostic {
  return {
    code, category, message,
    span: { file, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

/** argv excludes the executable and script names. Input modules are parsed, never imported. */
export async function runCompilerCli(argv: readonly string[], environment: CompilerCliEnvironment = {}): Promise<number> {
  const cwd = path.resolve(environment.cwd ?? process.cwd());
  const stdout = environment.stdout ?? ((text: string) => { process.stdout.write(text); });
  const stderr = environment.stderr ?? ((text: string) => { process.stderr.write(text); });
  // Preserve machine-readable usage errors even if parsing fails before --json is reached.
  let json = argv.includes('--json');
  let command: Command | undefined;
  function fail(diagnostics: CompilerDiagnostic[], exitCode: number): number {
    if (json) stdout(JSON.stringify({ ok: false, command: command ?? null, ...diagnosticsJson(diagnostics) }) + '\n');
    else stderr(formatCompilerDiagnostics(diagnostics) + '\n');
    return exitCode;
  }
  try {
    const parsed = parseArguments(argv);
    command = parsed.command;
    if (parsed.help) {
      if (json) stdout(JSON.stringify({ ok: true, help: HELP }) + '\n');
      else stdout(HELP);
      return 0;
    }
    const configured = parsed.config ? await readConfiguration(path.resolve(cwd, parsed.config)) : {};
    const options: Options = { ...configured, ...parsed.options };
    json = options.json ?? false;
    if (!options.entry) throw new CliUsageError('An entry is required (--entry or positional entry)');
    if (command === 'compile' && !options.output)
      throw new CliUsageError('compile requires an explicit --output directory or configuration output');
    if (command !== 'compile' && parsed.options.output !== undefined)
      throw new CliUsageError('--output is only valid for compile');
    const selected = resolveTargetProfile(options.profile ?? 'react-runtime-v1');
    if (!selected.ok) return fail(selected.diagnostics, 1);
    const entry = path.resolve(cwd, options.entry);
    const compilationOptions = {
      root: path.resolve(cwd, options.root ?? cwd),
      exportName: options.export,
      profile: selected.value.id,
    };
    const result = await compileFile(entry, compilationOptions);
    if (!result.ok) return fail(result.diagnostics, result.diagnostics.some((diagnostic) => diagnostic.category === 'compiler-defect') ? 3 : 1);
    const compilation = result.value;
    if (command === 'compile') {
      const written = await writeCompilation(compilation, path.resolve(cwd, options.output!));
      if (!written.ok) return fail(written.diagnostics, written.diagnostics.some((diagnostic) => diagnostic.category === 'compiler-defect') ? 3 : 1);
      if (json) stdout(JSON.stringify({ ok: true, command, result: written.value, diagnostics: [] }) + '\n');
      else stdout(`Compiled ${compilation.ir.name} (${compilation.output.profile}) to ${written.value.directory}\n${written.value.files.map((file) => `  ${file}`).join('\n')}\n`);
    } else if (command === 'inspect') {
      stdout(JSON.stringify(json ? { ok: true, command, result: compilation.ir, diagnostics: [] } : compilation.ir, null, 2) + '\n');
    } else if (command === 'explain') {
      const explanation = {
        name: compilation.ir.name,
        profile: compilation.output.profile,
        source: compilation.ir.source,
        irVersion: compilation.ir.schemaVersion,
        requirements: compilation.ir.requirements,
        dependencies: compilation.output.dependencies,
        provenance: compilation.output.provenance,
      };
      if (json) stdout(JSON.stringify({ ok: true, command, result: explanation, diagnostics: [] }, null, 2) + '\n');
      else stdout([
        `${explanation.name}: ${explanation.profile}`,
        `Source: ${explanation.source.file} (export ${explanation.source.exportName})`,
        `Semantic requirements: ${explanation.requirements.join(', ') || '(none)'}`,
        'Actual emitted dependencies:',
        ...explanation.dependencies.map((dependency) => `  ${dependency.name}@${dependency.version} [${dependency.role}]`),
        'Dependency roles describe this emitted profile, not support for every capability of its framework.',
      ].join('\n') + '\n');
    } else {
      if (json) stdout(JSON.stringify({ ok: true, command, result: { name: compilation.ir.name, profile: compilation.output.profile }, diagnostics: [] }) + '\n');
      else stdout(`Checked ${compilation.ir.name} (${compilation.output.profile})\n`);
    }
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) {
      const file = path.isAbsolute(error.file) ? path.relative(cwd, error.file).split(path.sep).join('/') : error.file;
      return fail([cliDiagnostic('PUI9001', 'invalid-input', error.message, file)], 2);
    }
    return fail([cliDiagnostic('PUI9002', 'compiler-defect', error instanceof Error ? error.message : String(error))], 3);
  }
}
