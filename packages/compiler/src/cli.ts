import { lstat, mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { compileFile, diffCompilation, writeCompilation } from './compile';
import { diagnosticsJson, formatCompilerDiagnostics } from './diagnostic-format';
import type { CompilerDiagnostic } from './ir';
import { resolveTargetProfile, TARGET_PROFILES } from './targets';
import { watchProject, type ProjectWatch, type ProjectWatchReport } from './watch';

export interface CompilerCliEnvironment {
  cwd?: string;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  /** Explicit cancellation replaces process signal listeners; cancellation exits successfully. */
  signal?: AbortSignal;
}

type Command = 'compile' | 'check' | 'inspect' | 'explain' | 'watch' | 'diff';
interface Options {
  entry?: string;
  root?: string;
  export?: string;
  output?: string;
  profile?: string;
  nativeSdkPath?: string;
  json?: boolean;
}
interface ParsedArguments {
  command?: Command;
  options: Options;
  config?: string;
  help: boolean;
}

const HELP = `Private Proto UI compiler
Usage: proto-compiler <compile|check|inspect|explain|watch|diff> [entry] [options]

Commands:
  compile  Compile an entry and exclusively create a fresh output directory.
  check    Run the same compiler and profile checks without writing artifacts.
  inspect  Compile and print checked semantic IR (JSON, private versioned format).
  explain  Compile and report requirements, emitted profile and actual dependencies.
  watch    Incrementally compile the declared input closure until SIGINT/SIGTERM.
           Publish each complete generation in a fresh versioned output location.
  diff     Compare proposed artifacts against an owned output directory, read-only.

Options:
  --entry <file>      Entry source; alternatively supply one positional entry.
  --root <directory> Declared source root (default: current working directory).
  --export <name>    Selected entry export (default: default).
  --output <dir>     Required for compile/watch/diff; never implicitly selected.
                     compile: fresh destination; watch: version container;
                     diff: existing owned artifact directory (never written).
  --profile <id>     ${Object.values(TARGET_PROFILES)
    .filter((target) => target.implemented)
    .map((target) => target.id)
    .join(', ')}.
                     Default: react-runtime-v1; no implicit target fallback.
  --native-sdk-path <dir>  GPUI SDK source crate shared by composed prototypes.
                     Omit to bundle the editable SDK in the output directory.
  --config <file>    Explicit JSON configuration file; no automatic discovery.
  --json             Machine-readable result and diagnostics on stdout.
  --help             Print this help.

Configuration is a JSON object with only these fields:
  entry, root, export, output, profile, nativeSdkPath: non-empty strings; json: boolean.
Paths in configuration are relative to the configuration file's directory.
Command-line paths are relative to cwd; command-line values override configuration.
check/inspect/explain ignore configured output and never write.
--output is valid only for compile/watch/diff. No command-specific hidden flags.
Watch writes <output>/<session UUID>/revision-<N>, with no mutable latest pointer.
Watch JSON is one result per line; failed revisions explicitly retain older output.
The output format is fixed at startup, including when configuration json changes.
Configuration is a watched input and is reloaded before publishing a generation.
Unknown fields/flags and repeated flags are errors.

Exit codes: 0 success; 1 rejected input/profile or output conflict;
            2 command/configuration error; 3 unexpected compiler defect.
diff exits 0 for identical artifacts, 1 for differences or invalid ownership.
Watch reports recoverable errors and keeps watching; its final
status reflects the latest revision. SIGINT: 130; SIGTERM: 143.
`;

class CliUsageError extends Error {
  constructor(
    message: string,
    readonly file = '<cli>'
  ) {
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
    if (!['compile', 'check', 'inspect', 'explain', 'watch', 'diff'].includes(command))
      throw new CliUsageError(
        `Unsupported command ${JSON.stringify(command)}; use --help for supported commands`
      );
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
    if (
      ![
        '--entry',
        '--root',
        '--export',
        '--output',
        '--profile',
        '--native-sdk-path',
        '--config',
        '--json',
        '--help',
      ].includes(flag)
    )
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
      throw new CliUsageError(
        `${flag} requires a value; use ${flag}=<value> for a value beginning with '-'`
      );
    const checked = nonEmptyString(value, flag);
    switch (name) {
      case 'entry':
        result.options.entry = checked;
        break;
      case 'root':
        result.options.root = checked;
        break;
      case 'export':
        result.options.export = checked;
        break;
      case 'output':
        result.options.output = checked;
        break;
      case 'profile':
        result.options.profile = checked;
        break;
      case 'native-sdk-path':
        result.options.nativeSdkPath = checked;
        break;
      case 'config':
        result.config = checked;
        break;
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
    throw new CliUsageError(
      `Cannot read JSON configuration: ${error instanceof Error ? error.message : String(error)}`,
      filename
    );
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data))
    throw new CliUsageError('Configuration must be a JSON object', filename);
  const options: Options = {};
  for (const [key, value] of Object.entries(data)) {
    switch (key) {
      case 'entry':
      case 'root':
      case 'output':
      case 'nativeSdkPath':
        options[key] = path.resolve(path.dirname(filename), nonEmptyString(value, key, filename));
        break;
      case 'export':
        options.export = nonEmptyString(value, key, filename);
        break;
      case 'profile':
        options.profile = nonEmptyString(value, key, filename);
        break;
      case 'json':
        if (typeof value !== 'boolean') throw new CliUsageError('json must be a boolean', filename);
        options.json = value;
        break;
      default:
        throw new CliUsageError(`Unknown configuration field ${JSON.stringify(key)}`, filename);
    }
  }
  return options;
}

function cliDiagnostic(
  code: string,
  category: CompilerDiagnostic['category'],
  message: string,
  file = '<cli>'
): CompilerDiagnostic {
  return {
    code,
    category,
    message,
    span: { file, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function failureExit(diagnostics: readonly CompilerDiagnostic[]): number {
  return diagnostics.some((diagnostic) => diagnostic.category === 'compiler-defect') ? 3 : 1;
}

/** The project watcher owns invalidation/cache/closure; this layer only publishes complete reports. */
async function runWatch(
  initial: Options,
  parsed: ParsedArguments,
  cwd: string,
  environment: CompilerCliEnvironment,
  stdout: (text: string) => void,
  stderr: (text: string) => void
): Promise<number> {
  const session = randomUUID();
  const json = initial.json ?? false;
  const config = parsed.config ? path.resolve(cwd, parsed.config) : undefined;
  let options = initial;
  let controller: ProjectWatch | undefined;
  let stopping = environment.signal?.aborted ?? false;
  let signalExit: number | undefined = stopping ? 0 : undefined;
  let status = 0;
  let latest = 0;
  let publication = 0;
  let lastSuccessful: { revision: number; directory: string; files: string[] } | undefined;
  let queue = Promise.resolve();
  let restart: Options | undefined;
  let reportedFatal = false;
  const reservedSessions = new Set<string>();
  async function reserveSession(output: string): Promise<void> {
    const absolute = path.resolve(cwd, output);
    let current = path.parse(absolute).root;
    for (const segment of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      try {
        await mkdir(current);
      } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST')
          throw error;
      }
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error(`Watch output parent is not a real directory: ${current}`);
    }
    const sessionDirectory = path.join(absolute, session);
    if (!reservedSessions.has(sessionDirectory)) {
      await mkdir(sessionDirectory);
      reservedSessions.add(sessionDirectory);
    }
    const stat = await lstat(sessionDirectory);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(`Watch session was replaced: ${sessionDirectory}`);
  }
  function stop(code: number): void {
    stopping = true;
    signalExit = code;
    void controller?.stop();
  }
  const interrupted = () => stop(130);
  const terminated = () => stop(143);
  const cancelled = () => stop(0);
  if (environment.signal) environment.signal.addEventListener('abort', cancelled, { once: true });
  else {
    process.on('SIGINT', interrupted);
    process.on('SIGTERM', terminated);
  }
  function rejected(
    diagnostics: readonly CompilerDiagnostic[],
    revision: number,
    code: number,
    fatal: boolean
  ): void {
    status = code;
    if (fatal) reportedFatal = true;
    if (json)
      stdout(
        JSON.stringify({
          ok: false,
          command: 'watch',
          revision,
          fatal,
          lastSuccessful: lastSuccessful ?? null,
          ...diagnosticsJson([...diagnostics]),
        }) + '\n'
      );
    else {
      stderr(formatCompilerDiagnostics([...diagnostics]) + '\n');
      if (lastSuccessful)
        stderr(
          `Retaining revision ${lastSuccessful.revision} at ${lastSuccessful.directory}; revision ${revision} failed.\n`
        );
    }
  }
  async function reportResult(report: ProjectWatchReport, revision: number): Promise<void> {
    if (stopping || restart || revision !== latest) return;
    if (config) {
      let reloaded: Options;
      try {
        reloaded = { ...(await readConfiguration(config)), ...parsed.options };
        if (!reloaded.entry || !reloaded.output)
          throw new CliUsageError('watch configuration requires entry and output', config);
        const selected = resolveTargetProfile(reloaded.profile ?? 'react-runtime-v1');
        if (!selected.ok) {
          rejected(selected.diagnostics, revision, 1, false);
          return;
        }
        reloaded.profile = selected.value.id;
      } catch (error) {
        if (!(error instanceof CliUsageError)) throw error;
        rejected(
          [cliDiagnostic('PUI9001', 'invalid-input', error.message, error.file)],
          revision,
          2,
          false
        );
        return;
      }
      if (stopping || revision !== latest) return;
      if (
        JSON.stringify([
          reloaded.entry,
          reloaded.root,
          reloaded.export,
          reloaded.output,
          reloaded.profile,
          reloaded.nativeSdkPath,
        ]) !==
        JSON.stringify([
          options.entry,
          options.root,
          options.export,
          options.output,
          options.profile,
          options.nativeSdkPath,
        ])
      ) {
        restart = reloaded;
        await controller?.stop();
        return;
      }
    }
    if (report.status === 'failure') {
      rejected(report.diagnostics, revision, failureExit(report.diagnostics), report.fatal);
      return;
    }
    const compilation = report.compilation.entries[0].compilation;
    try {
      await reserveSession(options.output!);
    } catch (error) {
      rejected(
        [
          cliDiagnostic(
            'PUI5001',
            'output-conflict',
            error instanceof Error ? error.message : String(error),
            options.output!
          ),
        ],
        revision,
        1,
        true
      );
      stopping = true;
      await controller?.stop();
      return;
    }
    const directory = path.join(
      path.resolve(cwd, options.output!),
      session,
      `revision-${++publication}`
    );
    const written = await writeCompilation(compilation, directory);
    if (stopping) return;
    if (!written.ok) {
      rejected(written.diagnostics, revision, failureExit(written.diagnostics), true);
      stopping = true;
      await controller?.stop();
      return;
    }
    // A newer report can arrive during asynchronous publication. The immutable artifact
    // remains available, but must not be presented as the successful current revision.
    lastSuccessful = { revision, ...written.value };
    if (revision !== latest) {
      if (json)
        stdout(
          JSON.stringify({
            ok: false,
            command: 'watch',
            revision,
            status: 'superseded',
            lastSuccessful,
            diagnostics: [],
          }) + '\n'
        );
      else stdout(`Retained superseded revision ${revision} at ${written.value.directory}\n`);
      return;
    }
    status = 0;
    if (json)
      stdout(
        JSON.stringify({
          ok: true,
          command: 'watch',
          revision,
          result: written.value,
          changedFiles: report.changedFiles,
          diagnostics: [],
        }) + '\n'
      );
    else
      stdout(
        `Compiled revision ${revision}: ${compilation.ir.name} (${compilation.output.profile}) to ${written.value.directory}\n`
      );
  }
  try {
    while (!stopping) {
      restart = undefined;
      reportedFatal = false;
      const started = await watchProject({
        root: path.resolve(cwd, options.root ?? cwd),
        entries: [path.resolve(cwd, options.entry!)],
        exportName: options.export,
        profile: options.profile,
        nativeSdkPath:
          options.nativeSdkPath === undefined
            ? undefined
            : path.resolve(cwd, options.nativeSdkPath),
        configFiles: config ? [config] : undefined,
        onReport(report) {
          const revision = ++latest;
          queue = queue
            .then(() => reportResult(report, revision))
            .catch(async (error: unknown) => {
              rejected(
                [
                  cliDiagnostic(
                    'PUI9002',
                    'compiler-defect',
                    error instanceof Error ? error.message : String(error)
                  ),
                ],
                revision,
                3,
                true
              );
              stopping = true;
              await controller?.stop();
            });
        },
      });
      if (!started.ok) {
        rejected(started.diagnostics, ++latest, failureExit(started.diagnostics), true);
        break;
      }
      controller = started.value;
      if (stopping) await controller.stop();
      const finished = await controller.finished;
      await queue;
      if (!finished.ok) {
        if (!reportedFatal)
          rejected(finished.diagnostics, latest, failureExit(finished.diagnostics), true);
        break;
      }
      if (!restart) break;
      options = restart;
    }
    return signalExit ?? status;
  } finally {
    stopping = true;
    await controller?.stop();
    await queue;
    if (environment.signal) environment.signal.removeEventListener('abort', cancelled);
    else {
      process.removeListener('SIGINT', interrupted);
      process.removeListener('SIGTERM', terminated);
    }
  }
}

/** argv excludes the executable and script names. Input modules are parsed, never imported. */
export async function runCompilerCli(
  argv: readonly string[],
  environment: CompilerCliEnvironment = {}
): Promise<number> {
  const cwd = path.resolve(environment.cwd ?? process.cwd());
  const stdout =
    environment.stdout ??
    ((text: string) => {
      process.stdout.write(text);
    });
  const stderr =
    environment.stderr ??
    ((text: string) => {
      process.stderr.write(text);
    });
  // Preserve machine-readable usage errors even if parsing fails before --json is reached.
  let json = argv.includes('--json');
  let command: Command | undefined;
  function fail(diagnostics: CompilerDiagnostic[], exitCode: number): number {
    if (json)
      stdout(
        JSON.stringify({ ok: false, command: command ?? null, ...diagnosticsJson(diagnostics) }) +
          '\n'
      );
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
    const configured = parsed.config
      ? await readConfiguration(path.resolve(cwd, parsed.config))
      : {};
    const options: Options = { ...configured, ...parsed.options };
    json = options.json ?? false;
    if (!options.entry)
      throw new CliUsageError('An entry is required (--entry or positional entry)');
    const usesOutput = command === 'compile' || command === 'watch' || command === 'diff';
    if (usesOutput && !options.output)
      throw new CliUsageError(
        `${command} requires an explicit --output directory or configuration output`
      );
    if (!usesOutput && parsed.options.output !== undefined)
      throw new CliUsageError('--output is only valid for compile/watch/diff');
    const selected = resolveTargetProfile(options.profile ?? 'react-runtime-v1');
    if (!selected.ok) return fail(selected.diagnostics, 1);
    if (command === 'watch')
      return await runWatch(
        { ...options, profile: selected.value.id },
        parsed,
        cwd,
        environment,
        stdout,
        stderr
      );
    const entry = path.resolve(cwd, options.entry);
    const compilationOptions = {
      root: path.resolve(cwd, options.root ?? cwd),
      exportName: options.export,
      profile: selected.value.id,
      nativeSdkPath:
        options.nativeSdkPath === undefined ? undefined : path.resolve(cwd, options.nativeSdkPath),
    };
    const result = await compileFile(entry, compilationOptions);
    if (!result.ok)
      return fail(
        result.diagnostics,
        result.diagnostics.some((diagnostic) => diagnostic.category === 'compiler-defect') ? 3 : 1
      );
    const compilation = result.value;
    if (command === 'compile') {
      const written = await writeCompilation(compilation, path.resolve(cwd, options.output!));
      if (!written.ok)
        return fail(
          written.diagnostics,
          written.diagnostics.some((diagnostic) => diagnostic.category === 'compiler-defect')
            ? 3
            : 1
        );
      if (json)
        stdout(
          JSON.stringify({ ok: true, command, result: written.value, diagnostics: [] }) + '\n'
        );
      else
        stdout(
          `Compiled ${compilation.ir.name} (${compilation.output.profile}) to ${written.value.directory}\n${written.value.files.map((file) => `  ${file}`).join('\n')}\n`
        );
    } else if (command === 'diff') {
      const compared = await diffCompilation(compilation, path.resolve(cwd, options.output!));
      if (!compared.ok) return fail(compared.diagnostics, failureExit(compared.diagnostics));
      if (json)
        stdout(
          JSON.stringify({ ok: true, command, result: compared.value, diagnostics: [] }) + '\n'
        );
      else
        stdout(
          `Artifact diff: ${compared.value.directory}\n${compared.value.changes
            .map(
              (change) =>
                `  ${change.status} ${change.path}${change.consumerModified ? ' (consumer-modified; preserved)' : ''}`
            )
            .join('\n')}\n`
        );
      return compared.value.changes.some((change) => change.status !== 'unchanged') ? 1 : 0;
    } else if (command === 'inspect') {
      stdout(
        JSON.stringify(
          json ? { ok: true, command, result: compilation.ir, diagnostics: [] } : compilation.ir,
          null,
          2
        ) + '\n'
      );
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
      if (json)
        stdout(
          JSON.stringify({ ok: true, command, result: explanation, diagnostics: [] }, null, 2) +
            '\n'
        );
      else
        stdout(
          [
            `${explanation.name}: ${explanation.profile}`,
            `Source: ${explanation.source.file} (export ${explanation.source.exportName})`,
            `Semantic requirements: ${explanation.requirements.join(', ') || '(none)'}`,
            'Actual emitted dependencies:',
            ...explanation.dependencies.map(
              (dependency) => `  ${dependency.name}@${dependency.version} [${dependency.role}]`
            ),
            'Dependency roles describe this emitted profile, not support for every capability of its framework.',
          ].join('\n') + '\n'
        );
    } else {
      if (json)
        stdout(
          JSON.stringify({
            ok: true,
            command,
            result: { name: compilation.ir.name, profile: compilation.output.profile },
            diagnostics: [],
          }) + '\n'
        );
      else stdout(`Checked ${compilation.ir.name} (${compilation.output.profile})\n`);
    }
    return 0;
  } catch (error) {
    if (error instanceof CliUsageError) {
      const file = path.isAbsolute(error.file)
        ? path.relative(cwd, error.file).split(path.sep).join('/')
        : error.file;
      return fail([cliDiagnostic('PUI9001', 'invalid-input', error.message, file)], 2);
    }
    return fail(
      [
        cliDiagnostic(
          'PUI9002',
          'compiler-defect',
          error instanceof Error ? error.message : String(error)
        ),
      ],
      3
    );
  }
}
