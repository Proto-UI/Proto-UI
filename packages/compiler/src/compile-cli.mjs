import { randomUUID } from 'node:crypto';
import { open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { createProtoProgram, PROTO_TARGETS } from './frontend/index.ts';
import { projectOptions } from './lint-cli.mjs';
import { AUTHORING_DECLARATIONS, produceComponentIR } from './producer/index.ts';
import { ComponentIRDiagnostic } from './targets/validation/diagnostic.ts';

const usage = `Usage: proto-compiler compile <file> --target TARGET [--project tsconfig.json] [--export name] [--name PublicBinding] [--out file]

Generate one component from its selected source export. Output defaults to stdout.
By default, find the nearest tsconfig.json from the source file's directory upward.
An explicit --project path is resolved from the working directory.
Targets: ${PROTO_TARGETS.join(', ')}
Exit status: 0 for generated source, 1 for invalid source or a compilation error,
             2 for unavailable compilation, 64 for an invalid invocation.
`;

const flags = new Set(['--target', '--project', '--export', '--name', '--out']);
const emitters = {
  react: async (component) => (await import('./targets/react.ts')).emitReact(component),
  gpui: async (component) => (await import('./targets/gpui.ts')).emitGpui(component),
};

function authoringPaths(paths) {
  const specifier = '@proto.ui/core/authoring';
  // An exact default would otherwise take precedence over a project wildcard.
  // Use the same pattern selection as the pinned TypeScript module resolver.
  if (paths && ts.matchPatternOrExact(ts.tryParsePatterns(paths), specifier) !== undefined)
    return paths;
  return { ...paths, [specifier]: [AUTHORING_DECLARATIONS] };
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (flags.has(argument)) {
      const key = argument.slice(2);
      if (Object.hasOwn(options, key)) throw new Error(`${argument} must be supplied once.`);
      const value = args[++index];
      if (!value || value.startsWith('-')) throw new Error(`${argument} requires a value.`);
      options[key] = value;
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (options.file !== undefined) {
      throw new Error('Compile accepts exactly one source entry.');
    } else {
      options.file = path.resolve(argument);
    }
  }
  if (!options.file) throw new Error('A source entry is required.');
  if (!options.target) throw new Error('--target is required.');
  if (!PROTO_TARGETS.includes(options.target)) throw new Error(`Unknown target: ${options.target}`);
  return options;
}

function showDiagnostic(stream, diagnostic) {
  const at = diagnostic.location;
  const location = at ? `${at.file}:${at.line}:${at.column}: ` : '';
  const capability = diagnostic.capabilityKey ? ` [${diagnostic.capabilityKey}]` : '';
  stream.write(
    `${location}[${diagnostic.code}] (${diagnostic.category})${capability} ${diagnostic.message}\n`
  );
  if (diagnostic.callChain?.length) stream.write(`  ${diagnostic.callChain.join(' -> ')}\n`);
}

async function publishFile(destination, source) {
  const temporary = path.join(path.dirname(destination), `.proto-compile-${randomUUID()}.tmp`);
  const file = await open(temporary, 'wx');
  try {
    try {
      await file.writeFile(source, 'utf8');
    } finally {
      await file.close();
    }
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function runCompileCli(args, io = process) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    io.stdout.write(usage);
    return 0;
  }

  const cwd = process.cwd();
  let options;
  let project;
  try {
    options = parseArguments(args);
    project = projectOptions(options.project, path.dirname(options.file));
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage}`);
    return 64;
  }

  const emit = emitters[options.target];
  if (!emit)
    io.stderr.write(
      `[PUI_BACKEND_MISSING] (backend-missing) No source emitter for ${options.target}.\n`
    );
  try {
    const program = createProtoProgram({
      rootNames: [options.file],
      currentDirectory: cwd,
      compilerOptions: {
        ...project,
        allowNonTsExtensions: true,
        paths: authoringPaths(project.paths),
      },
    });
    const result = produceComponentIR(program, {
      fileName: options.file,
      exportName: options.export,
      publicName: options.name,
    });
    if (result.status === 'unavailable') {
      for (const diagnostic of result.diagnostics) showDiagnostic(io.stderr, diagnostic);
      return result.diagnostics.some((item) => item.category === 'source-invalid') ? 1 : 2;
    }
    if (!emit) return 2;

    const source = await emit(result.component);
    if (options.out) await publishFile(path.resolve(cwd, options.out), source);
    else io.stdout.write(source);
    return 0;
  } catch (error) {
    if (error instanceof ComponentIRDiagnostic) {
      io.stderr.write(`[${error.code}] (${error.category}) ${error.message}\n`);
      return error.category === 'backend-missing' ? 2 : 1;
    }
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
