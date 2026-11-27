import path from 'node:path';
import ts from 'typescript';
import { COMPILER_STATUS } from './index.ts';
import { analyzeProtoFiles } from './frontend/index.ts';

const usage = `Usage: proto-compiler lint <source.proto.ts...> [--target TARGET] [--project tsconfig.json] [--json]

Analyze source without executing author modules or generating an artifact.
Targets: ${Object.keys(COMPILER_STATUS.targets).join(', ')}
Exit status: 0 = complete requested analysis; 1 = invalid source;
             2 = incomplete analysis or unavailable requested target; 64 = invalid invocation.
`;

function parseArguments(args) {
  const result = { rootNames: [], target: undefined, project: undefined, json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') result.json = true;
    else if (arg === '--target' || arg === '--project') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      const key = arg === '--target' ? 'target' : 'project';
      if (result[key] !== undefined) throw new Error(`${arg} must be supplied once.`);
      result[key] = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else result.rootNames.push(path.resolve(arg));
  }
  if (result.rootNames.length === 0) throw new Error('At least one source entry is required.');
  if (result.target !== undefined && !Object.hasOwn(COMPILER_STATUS.targets, result.target)) {
    throw new Error(`Unknown target: ${result.target}`);
  }
  return result;
}

function projectOptions(project, cwd) {
  const config = project ? path.resolve(project) : ts.findConfigFile(cwd, ts.sys.fileExists);
  if (!config) return {};
  const read = ts.readConfigFile(config, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(config),
    {},
    config
  );
  // Explicit CLI entries select the closure. A config's include/files selection
  // is not a requirement that a separate, explicitly supplied entry match it.
  const errors = parsed.errors.filter((diagnostic) => diagnostic.code !== 18003);
  if (errors.length) {
    throw new Error(
      errors
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        .join('\n')
    );
  }
  return parsed.options;
}

export function runLintCli(args, io = process) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    io.stdout.write(usage);
    return 0;
  }
  let options;
  let compilerOptions;
  try {
    options = parseArguments(args);
    compilerOptions = projectOptions(options.project, process.cwd());
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage}`);
    return 64;
  }
  const analysis = analyzeProtoFiles({
    rootNames: options.rootNames,
    compilerOptions,
    currentDirectory: process.cwd(),
    target: options.target,
  });
  if (options.json) io.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
  else {
    for (const diagnostic of analysis.diagnostics) {
      const at = diagnostic.location;
      const location = at ? `${at.file}:${at.line}:${at.column}: ` : '';
      io.stdout.write(
        `${location}${diagnostic.severity} [${diagnostic.ruleId}] (${diagnostic.category}) ${diagnostic.message}\n`
      );
    }
    const validity =
      analysis.sourceValid === null ? 'undetermined' : analysis.sourceValid ? 'valid' : 'invalid';
    io.stdout.write(
      `Source: ${validity}; analysis: ${analysis.analysisComplete ? 'complete' : 'incomplete'}\n`
    );
    for (const [target, state] of Object.entries(analysis.targets)) {
      io.stdout.write(`${target}: ${state.compilable ? 'compilable' : 'not compilable'}\n`);
    }
    io.stdout.write(
      `Source closure: ${analysis.sourceClosure.files.length} files; sha256 ${analysis.sourceClosure.digest}\n`
    );
  }
  if (analysis.sourceValid === false) return 1;
  if (!analysis.analysisComplete || analysis.sourceValid === null) return 2;
  if (options.target && !analysis.targets[options.target].compilable) return 2;
  return 0;
}
