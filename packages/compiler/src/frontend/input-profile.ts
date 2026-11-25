import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { ProtoProgramOptions } from './types.ts';

const authoring = '@proto.ui/core/authoring';
export const AUTHORING_DECLARATIONS = fileURLToPath(
  new URL('../../prelude/authoring.d.ts', import.meta.url)
);

export class ProtoProjectError extends Error {}

function selectProject(
  roots: readonly string[],
  cwd: string,
  project?: string
): string | undefined {
  if (project !== undefined) return path.resolve(cwd, project);
  const directories = new Set(roots.map((file) => path.dirname(file)));
  const projects = new Set(
    [...directories].map((directory) => ts.findConfigFile(directory, ts.sys.fileExists))
  );
  if (projects.size > 1) {
    throw new ProtoProjectError(
      'Source entries have different nearest projects. Select a common configuration with --project.'
    );
  }
  return projects.values().next().value;
}

function readProject(config: string): ts.CompilerOptions {
  const read = ts.readConfigFile(config, ts.sys.readFile);
  if (read.error) {
    throw new ProtoProjectError(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  }
  // Callers supply the exact entries. Only configuration, including inherited
  // resolution settings, is needed from tsconfig's project-file selection.
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(config),
    {},
    config
  );
  const errors = parsed.errors.filter((error) => error.code !== 18003);
  if (errors.length) {
    throw new ProtoProjectError(
      errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n')
    );
  }
  return parsed.options;
}

function mapsAuthoring(pattern: string): boolean {
  if (pattern === authoring) return true;
  const star = pattern.indexOf('*');
  // TypeScript path keys can contain one wildcard. An existing mapping also
  // owns a failed resolution; adding a more specific fallback would hide it.
  return (
    star >= 0 &&
    star === pattern.lastIndexOf('*') &&
    authoring.length >= pattern.length - 1 &&
    authoring.startsWith(pattern.slice(0, star)) &&
    authoring.endsWith(pattern.slice(star + 1))
  );
}

export function prepareProtoOptions(
  input: ProtoProgramOptions,
  roots: readonly string[],
  cwd: string
): ts.CompilerOptions {
  const config = selectProject(roots, cwd, input.project);
  const options = { ...(config ? readProject(config) : {}), ...input.compilerOptions };
  if (input.compilerOptions?.paths && input.compilerOptions.pathsBasePath === undefined) {
    // Caller-supplied paths follow the caller's cwd in the absence of a baseUrl.
    // Inherited project paths retain TypeScript's own pathsBasePath.
    options.pathsBasePath = cwd;
  }
  if (!Object.keys(options.paths ?? {}).some(mapsAuthoring)) {
    options.paths = { ...options.paths, [authoring]: [AUTHORING_DECLARATIONS] };
  }
  return options;
}
