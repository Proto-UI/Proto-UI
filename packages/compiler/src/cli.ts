import fs from 'node:fs';
import path from 'node:path';
import { createCompiler, COMPILATION_TARGETS, type CompilationTarget } from './compiler';
import { formatDiagnostics } from './diagnostics';
import { detectLlvmToolchain } from './llvm';
import { writeGeneratedArtifacts } from './output';

export interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const commands = new Set(['check', 'compile', 'ir', 'llvm', 'inventory', 'info']);
const valueFlags = new Set([
  '--root',
  '--export',
  '--out',
  '--target',
  '--component',
  '--gpui-dependency',
]);
const booleanFlags = new Set(['--json', '--optimize', '--wasm', '--ll', '--pir', '--overwrite']);
const targets = new Set<CompilationTarget>(COMPILATION_TARGETS);
const usage = [
  'Usage: proto-compiler <command> <entry> [options]',
  '',
  'Commands:',
  '  check      <entry>       Typecheck, verify IR and lower the selected native target',
  '  compile    <entry>       Emit the selected native target',
  '  ir         <entry>       Print semantic IR, including unresolved operations',
  '  llvm       <entry>       Build LLVM objects and print the resulting module',
  '  inventory  <paths...>    Report native emission and unsupported coverage separately',
  '  info                    Print compiler and installed LLVM toolchain status',
  '',
  'Options:',
  '  --target <react|gpui|kernel|ir>   Target (default: react)',
  '  --root <dir>                    Resolve inputs and outputs under this workspace',
  '  --export <name>                 Select one prototype export',
  '  --component <name>              Name the primary generated component',
  '  --out <dir>                     Write artifacts after all lowering succeeds',
  '  --gpui-dependency <pinned|workspace>   GPUI Cargo dependency mode',
  '  --ll                            Also emit the LLVM kernel',
  '  --wasm                          Also compile a WASM kernel (requires --out)',
  '  --optimize                      Optimize the requested LLVM kernel at O2',
  '  --pir                           Include the semantic IR artifact',
  '  --overwrite                     Replace existing generated output files',
  '  --json                          Print a structured result',
  '',
].join('\n');

function invalid(message: string): CliResult {
  return { exitCode: 2, stdout: '', stderr: message + '\n' };
}

function entriesUnder(input: string): string[] {
  if (!fs.statSync(input).isDirectory()) return [input];
  const entries: string[] = [];
  for (const item of fs.readdirSync(input, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === '.git') continue;
    const child = path.join(input, item.name);
    if (item.isDirectory()) entries.push(...entriesUnder(child));
    else if (item.isFile() && item.name.endsWith('.proto.ts')) entries.push(child);
  }
  return entries.sort();
}

/** Parse options before resolving paths or compiling, so flag values cannot become the entry. */
export function runCompilerCli(argv: readonly string[]): CliResult {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h')
    return { exitCode: 0, stdout: usage, stderr: '' };
  if (!commands.has(command)) return invalid('Unknown command: ' + command);
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const inputs: string[] = [];
  let positionalOnly = false;
  for (let index = 0; index < rest.length; index++) {
    const argument = rest[index];
    if (!positionalOnly && argument === '--') {
      positionalOnly = true;
      continue;
    }
    if (positionalOnly || !argument.startsWith('-')) {
      inputs.push(argument);
      continue;
    }
    if (valueFlags.has(argument)) {
      const value = rest[++index];
      if (!value || value.startsWith('--')) return invalid('Missing value for ' + argument);
      if (values.has(argument)) return invalid('Duplicate option: ' + argument);
      values.set(argument, value);
    } else if (booleanFlags.has(argument)) flags.add(argument);
    else return invalid('Unknown option: ' + argument);
  }
  if (command === 'info') {
    if (inputs.length) return invalid('The info command does not accept an entry.');
    if (values.size || [...flags].some((flag) => flag !== '--json'))
      return invalid('The info command accepts only --json.');
    return {
      exitCode: 0,
      stdout:
        JSON.stringify(
          {
            compiler: '@proto.ui/compiler',
            irVersion: 2,
            targets: COMPILATION_TARGETS,
            llvm: detectLlvmToolchain(),
          },
          null,
          2
        ) + '\n',
      stderr: '',
    };
  }
  if (!inputs.length) return invalid('Missing entry for ' + command);
  if (command !== 'inventory' && inputs.length !== 1)
    return invalid(command + ' accepts exactly one entry.');
  const targetText =
    values.get('--target') ?? (command === 'llvm' ? 'kernel' : command === 'ir' ? 'ir' : 'react');
  if (!targets.has(targetText as CompilationTarget))
    return invalid('Unsupported target: ' + targetText);
  const target = targetText as CompilationTarget;
  if ((command === 'ir' && target !== 'ir') || (command === 'llvm' && target !== 'kernel'))
    return invalid('Command and target disagree.');
  const gpuiDependency = values.get('--gpui-dependency') ?? 'pinned';
  if (gpuiDependency !== 'pinned' && gpuiDependency !== 'workspace')
    return invalid('GPUI dependency must be pinned or workspace.');
  if (values.has('--gpui-dependency') && target !== 'gpui')
    return invalid('--gpui-dependency requires the GPUI target.');
  const outArgument = values.get('--out');
  if (
    command !== 'compile' &&
    (outArgument || ['--wasm', '--ll', '--pir', '--overwrite'].some((flag) => flags.has(flag)))
  )
    return invalid('Artifact-writing options require the compile command.');
  if (flags.has('--pir') && !outArgument)
    return invalid('--pir requires --out; use the ir command to print IR.');
  if (flags.has('--overwrite') && !outArgument) return invalid('--overwrite requires --out.');
  if (flags.has('--optimize') && (command === 'ir' || command === 'inventory'))
    return invalid('--optimize requires a command that verifies or emits an LLVM kernel.');
  if (flags.has('--wasm') && !outArgument)
    return invalid('--wasm requires --out so the binary artifact can be written.');
  if (
    command === 'inventory' &&
    (outArgument || flags.has('--ll') || flags.has('--wasm') || flags.has('--optimize'))
  )
    return invalid(
      'Inventory reports native component coverage and does not write kernel artifacts.'
    );
  const rootDir = path.resolve(values.get('--root') ?? process.cwd());
  const json = flags.has('--json');
  const compiler = createCompiler({ rootDir });
  const options = {
    target,
    exportName: values.get('--export'),
    componentName: values.get('--component'),
    gpui: { gpuiDependency },
  } as const;
  try {
    if (command === 'inventory') {
      if (target !== 'react' && target !== 'gpui')
        return invalid('Inventory requires the React or GPUI component target.');
      const entries = inputs.flatMap((input) => entriesUnder(path.resolve(rootDir, input)));
      if (!entries.length) return invalid('No .proto.ts inputs found.');
      const report = compiler.inventoryProject(entries, options);
      if (!report.ok)
        return {
          exitCode: 1,
          stdout: json ? JSON.stringify(report, null, 2) + '\n' : '',
          stderr: json ? '' : formatDiagnostics(report.diagnostics) + '\n',
        };
      return { exitCode: 0, stdout: JSON.stringify(report.value, null, 2) + '\n', stderr: '' };
    }
    const requestLlvm =
      target === 'kernel' || flags.has('--ll') || flags.has('--wasm') || flags.has('--optimize');
    const result = compiler.compileFile(inputs[0], {
      ...options,
      llvm: requestLlvm
        ? {
            verify: true,
            optimize: flags.has('--optimize') ? 'O2' : false,
            emitWasm: flags.has('--wasm'),
          }
        : undefined,
    });
    if (!result.ok)
      return {
        exitCode: 1,
        stdout: json ? JSON.stringify(result, null, 2) + '\n' : '',
        stderr: json ? '' : formatDiagnostics(result.diagnostics) + '\n',
      };
    const output = result.value;
    if (command === 'ir') return { exitCode: 0, stdout: output.irText + '\n', stderr: '' };
    if (command === 'llvm')
      return { exitCode: 0, stdout: output.llvm.optimizedIr ?? output.llvm.ir, stderr: '' };
    if (command === 'check')
      return {
        exitCode: 0,
        stdout:
          JSON.stringify(
            {
              ok: true,
              target,
              artifactKind: output.artifactKind,
              sourceFile: output.sourceFile,
              prototypes: output.ir.prototypes.map((proto) => proto.name),
              nativeEmittedPrototypes: output.prototypes.length + output.gpuiPrototypes.length,
              llvmEmitted: output.llvm.emitted,
              llvmVerified: output.llvm.verified,
              elapsedMs: output.elapsedMs,
            },
            null,
            2
          ) + '\n',
        stderr: '',
      };
    if (!outArgument) {
      const code =
        target === 'react'
          ? output.primary?.react.code
          : target === 'gpui'
            ? output.primaryGpui?.gpui.code
            : target === 'kernel'
              ? (output.llvm.optimizedIr ?? output.llvm.ir)
              : output.irText;
      if (code === undefined) return invalid('The selected entry has no target artifact.');
      return {
        exitCode: 0,
        stdout: json ? JSON.stringify({ ok: true, target, code }, null, 2) + '\n' : code,
        stderr: '',
      };
    }
    const outDir = path.resolve(rootDir, outArgument);
    const artifacts: { destination: string; content: string | Uint8Array }[] = [];
    for (const artifact of output.prototypes)
      artifacts.push({
        destination: path.join(outDir, artifact.react.componentName + '.tsx'),
        content: artifact.react.code,
      });
    for (const artifact of output.gpuiPrototypes) {
      const crateDir = path.join(outDir, artifact.gpui.componentName);
      artifacts.push({
        destination: path.join(crateDir, 'Cargo.toml'),
        content: artifact.gpui.cargoToml,
      });
      artifacts.push({
        destination: path.join(crateDir, 'src/lib.rs'),
        content: artifact.gpui.code,
      });
    }
    const moduleName =
      output.primary?.react.componentName ?? output.primaryGpui?.gpui.componentName ?? 'module';
    if (output.llvm.emitted)
      artifacts.push({
        destination: path.join(outDir, moduleName + '.ll'),
        content: output.llvm.optimizedIr ?? output.llvm.ir,
      });
    if (output.llvm.wasm)
      artifacts.push({
        destination: path.join(outDir, moduleName + '.wasm'),
        content: output.llvm.wasm,
      });
    if (target === 'ir' || flags.has('--pir'))
      artifacts.push({
        destination: path.join(outDir, moduleName + '.pir.json'),
        content: output.irText,
      });
    const inputPaths = new Set(
      compiler.session
        .ensureFiles([path.resolve(rootDir, inputs[0])])
        .getSourceFiles()
        .map((file) => path.resolve(file.fileName))
    );
    const destinations = new Set<string>();
    for (const artifact of artifacts) {
      const relative = path.relative(outDir, artifact.destination);
      if (relative.startsWith('..') || path.isAbsolute(relative))
        return invalid('Generated artifact path escapes the output directory.');
      if (destinations.has(artifact.destination))
        return invalid('Generated components have a colliding artifact path.');
      destinations.add(artifact.destination);
      if (
        inputPaths.has(artifact.destination) ||
        (fs.existsSync(artifact.destination) &&
          inputPaths.has(fs.realpathSync(artifact.destination)))
      )
        return invalid('Refusing to overwrite a compiler input: ' + artifact.destination);
      if (fs.existsSync(artifact.destination) && !flags.has('--overwrite'))
        return invalid(
          'Output already exists; use --overwrite to replace generated artifacts: ' +
            artifact.destination
        );
    }
    writeGeneratedArtifacts(outDir, artifacts, flags.has('--overwrite'));
    const written = artifacts.map((artifact) => artifact.destination);
    return {
      exitCode: 0,
      stdout: json
        ? JSON.stringify({ ok: true, target, written, elapsedMs: output.elapsedMs }, null, 2) + '\n'
        : written.map((file) => 'wrote ' + file).join('\n') + '\n',
      stderr: '',
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: (error instanceof Error ? error.message : String(error)) + '\n',
    };
  }
}
