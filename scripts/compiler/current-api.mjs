import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// These retired identities retain their original semantic/consumer obligations.
// They cannot select an old emitter. Native replacements must earn new evidence;
// retaining an identity here does not propose restoring a runtime compiler.
export const UNIMPLEMENTED_PROFILE_OBLIGATIONS = Object.freeze([
  'react-dom-source-v1',
  'react-runtime-v1',
  'vue-source-v1',
  'vue2-source-v1',
  'web-component-source-v1',
  'gpui-source-v1',
  'qt-source-v1',
  'flutter-source-v1',
  'ssr-source-v1',
]);

export function currentComponentProfiles(api) {
  assert.equal(typeof api.createCompiler, 'function', 'Expected the current compiler API');
  assert.ok(Array.isArray(api.COMPONENT_TARGETS), 'Expected the compiler-owned target registry');
  return [
    ...api.COMPONENT_TARGETS.map((id) => ({ id, implemented: true, declarationDiagnostics: [] })),
    ...UNIMPLEMENTED_PROFILE_OBLIGATIONS.map((id) => ({
      id,
      implemented: false,
      disposition: 'retired-profile-identity',
      declarationDiagnostics: [
        {
          code: 'INVENTORY_TARGET_UNIMPLEMENTED',
          severity: 'error',
          category: 'input',
          message: `Historical profile ${id} is retired. Its semantic and consumer acceptance still needs evidence from a current native target; it is not an alias or an executable legacy entry.`,
        },
      ],
    })),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

export function componentArtifacts(output) {
  const artifacts = [];
  for (const item of output.prototypes) {
    artifacts.push({
      path: item.react.componentName + '.tsx',
      kind: 'source',
      contents: item.react.code,
    });
  }
  for (const item of output.gpuiPrototypes) {
    artifacts.push({
      path: item.gpui.componentName + '/src/lib.rs',
      kind: 'source',
      contents: item.gpui.code,
    });
    artifacts.push({
      path: item.gpui.componentName + '/Cargo.toml',
      kind: 'manifest',
      contents: item.gpui.cargoToml,
    });
  }
  return artifacts;
}

/** Hash every source actually loaded by the TS frontend, including its type inputs. */
export function programSourceBinding(program) {
  return program
    .getSourceFiles()
    .map((source) => ({
      file: path.resolve(source.fileName),
      sha256: createHash('sha256').update(source.text).digest('hex'),
      bytes: Buffer.byteLength(source.text),
      declaration: source.isDeclarationFile,
    }))
    .sort((left, right) => left.file.localeCompare(right.file));
}

export function verifyProgramSourceBinding(files) {
  for (const file of files) {
    assert.equal(
      createHash('sha256').update(readFileSync(file.file)).digest('hex'),
      file.sha256,
      'TypeScript input changed during compilation: ' + file.file
    );
  }
}

/** Browser-editable local imports are data; package aliases remain build-owned. */
export function localSourceSnapshot(compiler, entry) {
  const root = compiler.session.rootDir;
  const program = compiler.session.ensureFiles([entry]);
  const files = Object.create(null);
  const relative = (filename) => {
    const value = path.relative(root, path.resolve(filename)).split(path.sep).join('/');
    if (value === '..' || value.startsWith('../') || path.isAbsolute(value))
      throw new Error('Authored source escapes its declared root: ' + filename);
    return value;
  };
  const visit = (filename) => {
    const absolute = path.resolve(filename);
    const name = relative(absolute);
    if (Object.hasOwn(files, name)) return;
    const source = program.getSourceFile(absolute);
    if (!source) throw new Error('Source is absent from the TypeScript program: ' + absolute);
    files[name] = source.text;
    for (const imported of ts.preProcessFile(source.text, true, true).importedFiles) {
      if (!imported.fileName.startsWith('.')) continue;
      const resolved = ts.resolveModuleName(
        imported.fileName,
        absolute,
        compiler.session.compilerOptions,
        ts.sys
      ).resolvedModule;
      if (!resolved)
        throw new Error('Unresolved local import: ' + name + ' -> ' + imported.fileName);
      visit(resolved.resolvedFileName);
    }
  };
  let error = null;
  try {
    visit(entry);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  return { snapshot: { entry: relative(entry), files }, error };
}
