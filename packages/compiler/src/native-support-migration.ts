import { constants, type Stats } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import {
  isLocalSourceSpecifier,
  localSourceBase,
  localSourceCandidates,
  sourceEdges,
} from './source-resolution';
import { nativeInteractionArtifact, nativeInteractionArtifacts } from './native-interaction';
import { nativeAdapterModulesArtifact } from './native-adapter-modules';
import {
  validateArtifacts,
  writeArtifactSet,
  type ExclusiveOutputFile,
  type OutputArtifact,
} from './artifact-output';
import { IR_VERSION, type CompileResult } from './ir';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const shaPattern = /^[0-9a-f]{64}$/;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const CONTEXT_SCOPE_SHA256 = '12c3e9b2a09ff8daaa7d913aec21300052b66378723495b93dc3fad323ec1794';
const LEGACY = new Map([
  [
    nativeInteractionArtifact.path,
    'fa24714e204980f4d8a1d4f4999f85f7722e6bcc84406bfc733029286ccc6585',
  ],
  [
    nativeAdapterModulesArtifact.path,
    'dcbc4d2e9f1c141d8961475f8b96598d7a8096e96a49fcf95c9db3dd9747e66a',
  ],
]);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function required(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function sameIdentity(a: Stats, b: Stats): boolean {
  return (
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.mode === b.mode &&
    a.nlink === b.nlink &&
    a.size === b.size &&
    a.mtimeMs === b.mtimeMs &&
    a.ctimeMs === b.ctimeMs
  );
}
async function readRegular(filename: string, expected?: Stats): Promise<string> {
  const before = expected ?? (await lstat(filename));
  required(
    before.isFile() && !before.isSymbolicLink() && before.nlink === 1,
    'Migration input must be an unlinked regular file: ' + filename
  );
  required(before.size <= MAX_FILE_BYTES, 'Migration input file exceeds its byte budget');
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    required(
      sameIdentity(await handle.stat(), before),
      'Migration input changed before read: ' + filename
    );
    const bytes = await handle.readFile();
    required(
      bytes.length <= MAX_FILE_BYTES &&
        sameIdentity(await handle.stat(), before) &&
        sameIdentity(await lstat(filename), before),
      'Migration input changed during read: ' + filename
    );
    const contents = bytes.toString('utf8');
    required(
      Buffer.from(contents, 'utf8').equals(bytes),
      'Migration accepts only complete UTF-8 artifacts'
    );
    return contents;
  } finally {
    await handle.close();
  }
}
interface Snapshot {
  directory: string;
  files: Map<string, string>;
  identities: Map<string, Stats>;
}
async function snapshotDirectory(directory: string): Promise<Snapshot> {
  required(
    (await realpath(directory)) === directory,
    'Migration input directory cannot contain a symbolic-link ancestor'
  );
  const files = new Map<string, string>();
  const identities = new Map<string, Stats>();
  let bytes = 0;
  async function visit(relative: string, depth: number): Promise<void> {
    required(depth <= 12, 'Migration input directory depth exceeded');
    const absolute = path.join(directory, relative);
    const identity = await lstat(absolute);
    identities.set(relative, identity);
    if (identity.isDirectory() && !identity.isSymbolicLink()) {
      const entries = (await readdir(absolute)).sort();
      for (const entry of entries)
        await visit(relative ? relative + '/' + entry : entry, depth + 1);
    } else {
      required(files.size < 512, 'Migration input file count exceeded');
      const contents = await readRegular(absolute, identity);
      bytes += Buffer.byteLength(contents);
      required(bytes <= MAX_TOTAL_BYTES, 'Migration input byte budget exceeded');
      files.set(relative, contents);
    }
  }
  await visit('', 0);
  const snapshot = { directory, files, identities };
  await verifySnapshot(snapshot);
  return snapshot;
}
async function verifySnapshot(snapshot: Snapshot): Promise<void> {
  for (const [relative, identity] of snapshot.identities)
    required(
      sameIdentity(await lstat(path.join(snapshot.directory, relative)), identity),
      'Migration input identity changed: ' + relative
    );
}
function artifactKind(value: unknown): value is OutputArtifact['kind'] {
  return (
    value === 'source' ||
    value === 'style' ||
    value === 'declaration' ||
    value === 'source-map' ||
    value === 'manifest'
  );
}
interface VerifiedInput {
  id: string;
  anchor: string;
  snapshot: Snapshot;
  manifest: Record<string, unknown>;
  artifacts: OutputArtifact[];
  dependencies: { name: string; version: string; role: string }[];
}
function verifyManifest(id: string, anchor: string, snapshot: Snapshot): VerifiedInput {
  const contents = snapshot.files.get('provenance.json');
  required(
    contents !== undefined && hash(contents) === anchor,
    'Trusted provenance SHA does not match input: ' + id
  );
  const value: unknown = JSON.parse(contents);
  required(
    record(value) &&
      value.profile === 'vue2-source-v1' &&
      value.backend === value.profile &&
      value.irVersion === IR_VERSION &&
      Array.isArray(value.artifacts),
    'Unknown migration provenance/profile/version'
  );
  required(
    Array.isArray(value.dependencies) &&
      Array.isArray(value.sourceFiles) &&
      typeof value.generatedSha256 === 'string' &&
      shaPattern.test(value.generatedSha256),
    'Incomplete original compiler provenance'
  );
  const dependencies = value.dependencies.map((item) => {
    required(
      record(item) &&
        typeof item.name === 'string' &&
        typeof item.version === 'string' &&
        item.role === 'target' &&
        ((item.name === 'vue' && item.version === '2.6.14') ||
          (item.name === '@floating-ui/dom' && item.version === '1.8.0')),
      'Unknown native support dependency ABI'
    );
    return { name: item.name, version: item.version, role: item.role };
  });
  required(
    dependencies.filter((item) => item.name === 'vue').length === 1 &&
      new Set(dependencies.map((item) => item.name)).size === dependencies.length,
    'Incomplete or duplicated target dependency record'
  );
  const artifacts: OutputArtifact[] = [];
  for (const item of value.artifacts) {
    required(
      record(item) &&
        typeof item.path === 'string' &&
        artifactKind(item.kind) &&
        typeof item.sha256 === 'string' &&
        shaPattern.test(item.sha256) &&
        item.path !== 'provenance.json',
      'Invalid original artifact manifest row'
    );
    const body = snapshot.files.get(item.path);
    required(
      body !== undefined && hash(body) === item.sha256,
      'Missing or modified original artifact: ' + item.path
    );
    artifacts.push({ path: item.path, kind: item.kind, contents: body });
  }
  const invalid = validateArtifacts(artifacts);
  required(!invalid, invalid ?? 'Invalid original artifacts');
  required(
    snapshot.files.size === artifacts.length + 1,
    'Additional unrecorded migration input files'
  );
  const directories = new Set(['']);
  for (const file of snapshot.files.keys()) {
    let parent = path.posix.dirname(file);
    while (parent !== '.') {
      directories.add(parent);
      parent = path.posix.dirname(parent);
    }
  }
  for (const [name, identity] of snapshot.identities)
    if (identity.isDirectory())
      required(directories.has(name), 'Additional unrecorded migration input directory: ' + name);
  const component = artifacts.find((item) => item.path === 'Component.js');
  required(
    component?.kind === 'source' && hash(component.contents) === value.generatedSha256,
    'Original Vue2 Component.js identity is not established'
  );
  return { id, anchor, snapshot, manifest: value, artifacts, dependencies };
}
function normalizeInteraction(artifacts: readonly OutputArtifact[]): OutputArtifact[] {
  const selected = artifacts.filter((file) => file.path.startsWith('.proto-ui/interaction/'));
  if (!selected.length) return [...artifacts];
  const legacy =
    selected.length === LEGACY.size &&
    selected.every(
      (file) => file.kind === 'source' && LEGACY.get(file.path) === hash(file.contents)
    );
  if (legacy) {
    // The historical ABI is recognized by its complete source hashes, not by a
    // claimed compiler version, component name, edited manifest or path alone.
    required(
      hash(nativeInteractionArtifact.contents) === LEGACY.get(nativeInteractionArtifact.path) &&
        hash(nativeAdapterModulesArtifact.contents) ===
          LEGACY.get(nativeAdapterModulesArtifact.path),
      'Legacy migration source anchor changed'
    );
    return [
      ...artifacts.filter((file) => !LEGACY.has(file.path)),
      ...nativeInteractionArtifacts('full'),
    ];
  }
  for (const selection of ['full', 'text-single', 'text-multiline'] as const) {
    const expected = nativeInteractionArtifacts(selection);
    if (
      selected.length === expected.length &&
      expected.every((target) =>
        selected.some(
          (file) =>
            file.path === target.path &&
            file.kind === target.kind &&
            file.contents === target.contents
        )
      )
    )
      return [...artifacts];
  }
  throw new Error('Unknown or modified native support ABI; migration refuses to guess');
}
/** Validate the existing Context ABI without evaluating any supplied source. */
function validateContext(artifacts: readonly OutputArtifact[]): void {
  const selected = artifacts.filter((file) => file.path.startsWith('.proto-ui/context/'));
  if (!selected.length) return;
  required(
    selected.some((file) => file.path === '.proto-ui/context/scope-v1.ts'),
    'Context keys lack their known scope module'
  );
  for (const file of selected) {
    required(file.kind === 'source', 'Unknown Context artifact kind');
    if (file.path === '.proto-ui/context/scope-v1.ts') {
      required(
        hash(file.contents) === CONTEXT_SCOPE_SHA256,
        'Unknown or modified Context scope ABI'
      );
      continue;
    }
    const lines = file.contents.split('\n');
    required(
      lines.length === 4 &&
        lines[3] === '' &&
        lines[0].startsWith('// Source declaration ') &&
        lines[1].startsWith('// Checked value schema ') &&
        lines[2].startsWith('export const key = Object.freeze({ debugName: ') &&
        lines[2].endsWith(' });'),
      'Unknown Context key artifact ABI'
    );
    const id: unknown = JSON.parse(lines[0].slice('// Source declaration '.length));
    const schema: unknown = JSON.parse(lines[1].slice('// Checked value schema '.length));
    const name: unknown = JSON.parse(
      lines[2].slice('export const key = Object.freeze({ debugName: '.length, -' });'.length)
    );
    required(
      typeof id === 'string' &&
        typeof name === 'string' &&
        file.path === '.proto-ui/context/key-' + hash(id) + '.ts' &&
        file.contents ===
          '// Source declaration ' +
            JSON.stringify(id) +
            '\n// Checked value schema ' +
            JSON.stringify(schema) +
            '\nexport const key = Object.freeze({ debugName: ' +
            JSON.stringify(name) +
            ' });\n',
      'Unknown or modified Context key source identity'
    );
  }
}
/** Reuse the compiler's source-edge resolver; this is artifact linkage, not DSL admission. */
function validateSharedImports(
  shared: ReadonlyMap<string, OutputArtifact>,
  dependencies: ReadonlySet<string>
): void {
  for (const file of shared.values()) {
    const source = ts.createSourceFile(
      file.path,
      file.contents,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    required(
      !source.statements.some(
        (statement) =>
          ts.isExportAssignment(statement) ||
          (ts.canHaveModifiers(statement) &&
            ts
              .getModifiers(statement)
              ?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword))
      ),
      'Shared support ABI unexpectedly exports a default'
    );
    for (const edge of sourceEdges(source)) {
      if (isLocalSourceSpecifier(edge.specifier)) {
        required(
          localSourceCandidates(localSourceBase(file.path, edge.specifier)).some((candidate) =>
            shared.has(candidate)
          ),
          'Shared support import escapes the complete shared closure: ' + edge.specifier
        );
      } else {
        const name = edge.specifier.startsWith('@')
          ? edge.specifier.split('/').slice(0, 2).join('/')
          : edge.specifier.split('/')[0];
        required(
          dependencies.has(name),
          'Shared support dependency is not declared: ' + edge.specifier
        );
      }
    }
  }
}
function sharedSource(file: OutputArtifact): boolean {
  return (
    file.kind === 'source' &&
    file.path.endsWith('.ts') &&
    (file.path.startsWith('.proto-ui/interaction/') || file.path.startsWith('.proto-ui/context/'))
  );
}
function sharedPath(original: string): string {
  return '.proto-ui/shared/' + original.slice('.proto-ui/'.length);
}
function facade(localPath: string, target: string): string {
  let relative = path.posix.relative(path.posix.dirname(localPath), target).replace(/\.ts$/, '');
  if (!relative.startsWith('.')) relative = './' + relative;
  return (
    '// Static support identity link; no capability selection or dispatch.\nexport * from ' +
    JSON.stringify(relative) +
    ';\n'
  );
}
function assemble(inputs: VerifiedInput[]): OutputArtifact[] {
  const shared = new Map<string, OutputArtifact>();
  const dependencies = new Map<string, { name: string; version: string; role: string }>();
  for (const input of inputs)
    for (const dependency of input.dependencies) {
      const existing = dependencies.get(dependency.name);
      required(
        !existing || (existing.version === dependency.version && existing.role === dependency.role),
        'Conflicting shared dependency versions: ' + dependency.name
      );
      dependencies.set(dependency.name, dependency);
    }
  const normalized = inputs.map((input) => {
    validateContext(input.artifacts);
    return { input, artifacts: normalizeInteraction(input.artifacts) };
  });
  for (const { artifacts } of normalized)
    for (const file of artifacts)
      if (sharedSource(file)) {
        const existing = shared.get(file.path);
        required(
          !existing || (existing.contents === file.contents && existing.kind === file.kind),
          'Conflicting shared support bytes: ' + file.path
        );
        shared.set(file.path, file);
      }
  validateSharedImports(shared, new Set(dependencies.keys()));
  const result: OutputArtifact[] = [...shared.values()].map((file) => ({
    ...file,
    path: sharedPath(file.path),
  }));
  const migrations: Record<string, unknown>[] = [];
  for (const { input, artifacts } of normalized) {
    const local = artifacts.map((file) => {
      const filename = input.id + '/' + file.path;
      return {
        ...file,
        path: filename,
        contents: sharedSource(file) ? facade(filename, sharedPath(file.path)) : file.contents,
      };
    });
    const originalManifest = input.snapshot.files.get('provenance.json');
    required(originalManifest !== undefined, 'Original provenance disappeared');
    const mapping = local.map((file) => ({
      path: file.path.slice(input.id.length + 1),
      kind: file.kind,
      originalSha256: input.snapshot.files.has(file.path.slice(input.id.length + 1))
        ? hash(input.snapshot.files.get(file.path.slice(input.id.length + 1))!)
        : null,
      sha256: hash(file.contents),
    }));
    const manifest = {
      ...input.manifest,
      artifacts: mapping.map(({ originalSha256: _, ...item }) => item),
      migration: {
        version: 1,
        sourceManifestSHA256: input.anchor,
        sharedRoot: '../.proto-ui/shared',
      },
    };
    result.push(
      ...local,
      {
        path: input.id + '/provenance.json',
        kind: 'manifest',
        contents: JSON.stringify(manifest, null, 2) + '\n',
      },
      {
        path: '.proto-ui/migration-inputs/' + input.id + '.json',
        kind: 'manifest',
        contents: originalManifest,
      }
    );
    migrations.push({ id: input.id, sourceManifestSHA256: input.anchor, artifacts: mapping });
  }
  const manifest = {
    kind: 'native-support-migration-v1',
    version: 1,
    inputs: migrations,
    dependencies: [...dependencies.values()],
    artifacts: result.map((file) => ({
      path: file.path,
      kind: file.kind,
      sha256: hash(file.contents),
    })),
  };
  result.push({
    path: 'provenance.json',
    kind: 'manifest',
    contents: JSON.stringify(manifest, null, 2) + '\n',
  });
  const invalid = validateArtifacts(result);
  required(!invalid, invalid ?? 'Conflicting migration output paths');
  required(
    result.reduce((sum, file) => sum + Buffer.byteLength(file.contents), 0) <= MAX_TOTAL_BYTES,
    'Migration output byte budget exceeded'
  );
  return result;
}
/**
 * Explicit compiler-only directory migration. Anchors must come from a trusted
 * prior output/capture. No generated module is imported or evaluated here.
 * All source directories remain untouched; the existing writer owns fresh-only
 * output and rollback. This does not make untouched old helpers interoperable.
 */
export async function migrateNativeSupport(
  planFile: string,
  outputDirectory: string,
  openExclusive?: (filename: string) => Promise<ExclusiveOutputFile>
): Promise<CompileResult<{ directory: string; files: string[] }>> {
  try {
    const filename = path.resolve(planFile);
    required(
      (await realpath(filename)) === filename,
      'Migration plan cannot contain a symbolic-link ancestor'
    );
    const planText = await readRegular(filename);
    const plan: unknown = JSON.parse(planText);
    required(
      record(plan) &&
        plan.version === 1 &&
        Array.isArray(plan.inputs) &&
        Object.keys(plan).every((key) => key === 'version' || key === 'inputs') &&
        plan.inputs.length > 0 &&
        plan.inputs.length <= 32,
      'Invalid explicit migration plan'
    );
    const ids = new Set<string>();
    const directories = new Set<string>();
    const inputs: VerifiedInput[] = [];
    const output = path.resolve(outputDirectory);
    required(
      (await realpath(path.dirname(output))) === path.dirname(output),
      'Migration output parent cannot contain a symbolic-link ancestor'
    );
    let total = 0;
    for (const entry of plan.inputs) {
      required(
        record(entry) &&
          typeof entry.id === 'string' &&
          /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(entry.id) &&
          typeof entry.directory === 'string' &&
          entry.directory.length > 0 &&
          typeof entry.provenanceSHA256 === 'string' &&
          shaPattern.test(entry.provenanceSHA256) &&
          Object.keys(entry).every((key) => ['id', 'directory', 'provenanceSHA256'].includes(key)),
        'Invalid migration input/anchor'
      );
      const directory = path.resolve(path.dirname(filename), entry.directory);
      required(
        !ids.has(entry.id.toLowerCase()) && !directories.has(directory),
        'Duplicate migration input id or directory'
      );
      ids.add(entry.id.toLowerCase());
      directories.add(directory);
      required(
        output !== directory &&
          !output.startsWith(directory + path.sep) &&
          !directory.startsWith(output + path.sep),
        'Migration output must be separate from every input directory'
      );
      const snapshot = await snapshotDirectory(directory);
      total += [...snapshot.files.values()].reduce((sum, text) => sum + Buffer.byteLength(text), 0);
      required(total <= MAX_TOTAL_BYTES, 'Combined migration input byte budget exceeded');
      inputs.push(verifyManifest(entry.id, entry.provenanceSHA256, snapshot));
    }
    const artifacts = assemble(inputs);
    // The input set stays unchanged throughout planning; do not reserve output
    // after any observed input race or only partially verified directory.
    for (const input of inputs) await verifySnapshot(input.snapshot);
    return await writeArtifactSet(artifacts, output, openExclusive);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'PUI5001',
          category: 'output-conflict',
          message:
            'Native support migration rejected: ' +
            (error instanceof Error ? error.message : String(error)),
          span: { file: planFile, start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 },
        },
      ],
    };
  }
}
