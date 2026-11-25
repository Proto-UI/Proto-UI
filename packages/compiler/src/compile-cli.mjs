import { randomUUID } from 'node:crypto';
import { open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { createProtoProgram, PROTO_TARGETS } from './frontend/index.ts';
import { ProtoProjectError } from './frontend/input-profile.ts';
import { produceComponentIR } from './producer/index.ts';
import { ComponentIRDiagnostic } from './targets/validation/diagnostic.ts';

const usage = `Usage: proto-compiler compile <file> --target TARGET [--project tsconfig.json] [--bindings bindings.json] [--export name] [--name PublicBinding] [--out file]

Generate one component from its selected source export. Output defaults to stdout.
By default, find the nearest tsconfig.json from the source file's directory upward.
An explicit --project path is resolved from the working directory.
The --bindings path is also relative to the working directory. Its JSON object
can contain react and gpui tables keyed by declared extern name.
React entries have string fields "module" and "export". GPUI entries have a string "path".
Only the selected target's table is used. React module specifiers are emitted as supplied.
Targets: ${PROTO_TARGETS.join(', ')}
Exit status: 0 for generated source, 1 for invalid source or a compilation error,
             2 for unavailable compilation, 64 for an invalid invocation.
`;

const flags = new Set(['--target', '--project', '--bindings', '--export', '--name', '--out']);
const emitters = {
  react: async (component, bindings) =>
    (await import('./targets/react.ts')).emitReact(component, { bindings }),
  gpui: async (component, bindings) =>
    (await import('./targets/gpui.ts')).emitGpui(component, { bindings }),
};
const bindingFields = { react: ['module', 'export'], gpui: ['path'] };

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readBindings(file, cwd, target) {
  let document;
  try {
    const bytes = await readFile(path.resolve(cwd, file));
    document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error(`Cannot read --bindings file ${JSON.stringify(file)}: ${error.message}`, {
      cause: error,
    });
  }
  if (!isRecord(document) || Object.keys(document).some((key) => !Object.hasOwn(bindingFields, key))) {
    throw new Error('--bindings requires a JSON object with optional react and gpui tables.');
  }
  if (!Object.hasOwn(document, target)) return undefined;
  const table = document[target];
  if (!isRecord(table)) {
    throw new Error(`The ${target} binding table must be an object keyed by extern name.`);
  }
  const fields = bindingFields[target];
  for (const [name, entry] of Object.entries(table)) {
    if (!name) throw new Error(`The ${target} binding table contains an empty extern name.`);
    if (
      !isRecord(entry) ||
      Object.keys(entry).length !== fields.length ||
      !fields.every((key) => Object.hasOwn(entry, key) && typeof entry[key] === 'string' && entry[key].length > 0)
    ) {
      throw new Error(
        `The ${target} binding for ${JSON.stringify(name)} requires exactly the nonempty string fields ${fields.join(', ')}.`
      );
    }
  }
  return table;
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
  let bindings;
  try {
    options = parseArguments(args);
    if (options.bindings !== undefined) {
      bindings = await readBindings(options.bindings, cwd, options.target);
    }
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage}`);
    return 64;
  }

  const emit = emitters[options.target];
  try {
    const program = createProtoProgram({
      rootNames: [options.file],
      currentDirectory: cwd,
      project: options.project,
    });
    if (!emit) {
      io.stderr.write(
        `[PUI_BACKEND_MISSING] (backend-missing) No source emitter for ${options.target}.\n`
      );
    }
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

    const source = await emit(result.component, bindings);
    if (options.out) await publishFile(path.resolve(cwd, options.out), source);
    else io.stdout.write(source);
    return 0;
  } catch (error) {
    if (error instanceof ProtoProjectError) {
      io.stderr.write(`${error.message}\n${usage}`);
      return 64;
    }
    if (error instanceof ComponentIRDiagnostic) {
      io.stderr.write(`[${error.code}] (${error.category}) ${error.message}\n`);
      if (error.category === 'extern-unbound') {
        if (error.bindings.length) {
          io.stderr.write(`  ${error.bindings.map((id) => JSON.stringify(id)).join(' -> ')}\n`);
        }
        return 2;
      }
      return error.category === 'backend-missing' ? 2 : 1;
    }
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}
