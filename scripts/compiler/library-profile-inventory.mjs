/**
 * Complete authored *.proto.ts × public TARGET_PROFILES admission inventory.
 * A fresh bounded-heap worker owns one entry, one FileSourceGraph snapshot and
 * independent compileFile calls for every selected implemented profile.
 * No target build, runtime parity, native execution or public admission is inferred.
 *
 * node --import tsx scripts/compiler/library-profile-inventory.mjs --output /tmp/library-run
 * ... --output /tmp/library-run --resume --max-entries 10
 * ... --output /tmp/shard-0 --shard 0/4
 * ... --merge /tmp/library-report.json /tmp/shard-0 /tmp/shard-1 ...
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(import.meta.url);
const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const SCHEMA = 'proto-ui.library-profile-inventory.v1';
export const HISTORY = Object.freeze({
  revision: '35195a6e6f1ba6a7d800da0029f2683013abd18b',
  families: { base: 178, shadcn: 216 },
  profiles: ['react-dom-source-v1', 'react-runtime-v1', 'vue-source-v1', 'web-component-source-v1'],
  reportedPasses: [
    'packages/prototypes/base/src/button/button.proto.ts',
    'packages/prototypes/base/src/scroll-area/thumb.proto.ts',
    'packages/prototypes/base/src/table/caption.proto.ts',
    'packages/prototypes/base/src/table/root.proto.ts',
    'packages/prototypes/base/src/table/row.proto.ts',
  ],
});
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const key = (entry, profile) => `${entry}\0${profile}`;
const id = (value) => sha(value).slice(0, 32);
const ordered = (value) => {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((name) => [name, ordered(value[name])])
    );
  return value;
};
const digest = (value) => sha(JSON.stringify(ordered(value)));
function save(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  renameSync(temporary, file);
}
function git(...args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
  });
  assert.equal(result.status, 0, result.stderr || `git ${args[0]} failed`);
  return result.stdout;
}
function treeEntry(text) {
  const [metadata, entry] = text.split('\t');
  const [mode, type, blob] = metadata.split(' ');
  return { entry, mode, type, blob, family: entry.split('/')[2] };
}
function entryPaths(revision, families) {
  return git('ls-tree', '-r', '-z', revision, '--', 'packages/prototypes')
    .split('\0')
    .filter(Boolean)
    .map(treeEntry)
    .filter((item) => /^packages\/prototypes\/[^/]+\/src\/.+\.proto\.ts$/.test(item.entry))
    .filter((item) => !families || families.includes(item.family))
    .sort((left, right) => left.entry.localeCompare(right.entry));
}
function familyCounts(entries) {
  return Object.fromEntries(
    [...new Set(entries.map((row) => row.family))]
      .sort()
      .map((family) => [family, entries.filter((row) => row.family === family).length])
  );
}

/** Recover identities from real historical Git bytes; never synthesize old outcomes. */
export function recoverHistory() {
  const original = {
    ...HISTORY,
    entries: 394,
    profilePairs: 1576,
    scope: 'Original user-reported 5/394 for each named profile; not independently replayed here.',
    source: 'https://github.com/Proto-UI/Proto-UI/issues/732',
  };
  try {
    const entries = entryPaths(HISTORY.revision, Object.keys(HISTORY.families));
    assert.deepEqual(familyCounts(entries), HISTORY.families, 'Original denominator changed');
    const objects = spawnSync('git', ['cat-file', '--batch'], {
      cwd: root,
      input: entries.map((item) => item.blob).join('\n') + '\n',
      maxBuffer: 128 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    });
    assert.equal(objects.status, 0, String(objects.stderr));
    let offset = 0;
    for (const item of entries) {
      const end = objects.stdout.indexOf(10, offset);
      assert.ok(end >= 0, 'Truncated historical Git batch header');
      const header = objects.stdout.subarray(offset, end).toString().split(' ');
      assert.equal(header[0], item.blob);
      assert.equal(header[1], 'blob', `Historical blob unavailable: ${item.entry}`);
      const length = Number(header[2]);
      assert.ok(Number.isSafeInteger(length) && length >= 0);
      const bytes = objects.stdout.subarray(end + 1, end + 1 + length);
      assert.equal(bytes.length, length);
      item.sha256 = sha(bytes);
      item.bytes = length;
      offset = end + 2 + length;
      assert.equal(objects.stdout[offset - 1], 10);
    }
    assert.equal(offset, objects.stdout.length, 'Unexpected historical Git batch suffix');
    for (const entry of HISTORY.reportedPasses)
      assert.ok(
        entries.some((item) => item.entry === entry),
        `Reported historical entry absent: ${entry}`
      );
    return {
      original,
      recovered: true,
      tree: git('show', '--no-patch', '--format=%T', HISTORY.revision).trim(),
      membersSha256: digest(entries),
      members: entries,
      executionReplayed: false,
    };
  } catch (error) {
    return {
      original,
      recovered: false,
      executionReplayed: false,
      error: String(error.stack ?? error),
    };
  }
}

export function classifyResult(result) {
  if (result.ok)
    return { status: 'PASS', failureKind: null, firstDiagnostic: null, diagnostics: [] };
  const diagnostics = result.diagnostics ?? [];
  const categories = new Set(diagnostics.map((item) => item.category));
  if (categories.has('compiler-defect'))
    return {
      status: 'FAIL',
      failureKind: 'compiler-defect',
      firstDiagnostic: diagnostics[0] ?? null,
      diagnostics,
    };
  if (diagnostics.length && categories.size === 1 && categories.has('unsupported-input'))
    return {
      status: 'UNSUPPORTED',
      failureKind: 'unsupported-input',
      firstDiagnostic: diagnostics[0],
      diagnostics,
    };
  return {
    status: 'FAIL',
    failureKind: categories.has('invalid-input') ? 'invalid-input' : 'other-diagnostic',
    firstDiagnostic: diagnostics[0] ?? null,
    diagnostics,
  };
}

/** A source change is reported; it does not silently forgive a prior PASS regression. */
export function compareReports(previous, current) {
  assert.equal(previous.schema, SCHEMA);
  assert.equal(current.schema, SCHEMA);
  const now = new Map(current.rows.map((row) => [key(row.entry, row.profile), row]));
  const before = new Map(previous.rows.map((row) => [key(row.entry, row.profile), row]));
  assert.equal(now.size, current.rows.length, 'Duplicate current entry/profile');
  assert.equal(before.size, previous.rows.length, 'Duplicate baseline entry/profile');
  const regressions = [],
    missingBaselineRows = [],
    improvements = [],
    sourceChanges = [],
    newDefects = [];
  for (const old of previous.rows) {
    const next = now.get(key(old.entry, old.profile));
    if (!next)
      missingBaselineRows.push({ entry: old.entry, profile: old.profile, status: old.status });
    if (old.status === 'PASS' && next?.status !== 'PASS')
      regressions.push({
        entry: old.entry,
        profile: old.profile,
        before: old.status,
        after: next?.status ?? 'MISSING',
        diagnostic: next?.firstDiagnostic ?? null,
      });
    if (next && old.entrySha256 !== next.entrySha256)
      sourceChanges.push({
        entry: old.entry,
        profile: old.profile,
        before: old.entrySha256,
        after: next.entrySha256,
      });
    if (next?.status === 'PASS' && old.status !== 'PASS')
      improvements.push({ entry: old.entry, profile: old.profile, before: old.status });
  }
  for (const row of current.rows)
    if (
      row.failureKind === 'compiler-defect' &&
      before.get(key(row.entry, row.profile))?.failureKind !== 'compiler-defect'
    )
      newDefects.push({ entry: row.entry, profile: row.profile, diagnostic: row.firstDiagnostic });
  return {
    scope:
      'Admission-only ratchet: retain every baseline row and every previous PASS; unexecuted former PASS rows and new compiler defects fail. Source changes remain explicit.',
    baselineFingerprint: previous.universeFingerprint,
    regressions,
    missingBaselineRows,
    improvements,
    sourceChanges,
    newDefects,
    ok: regressions.length === 0 && newDefects.length === 0 && missingBaselineRows.length === 0,
  };
}

async function compilerModule(modulePath) {
  return import(
    modulePath
      ? pathToFileURL(modulePath).href
      : new URL('../../packages/compiler/src/index.ts', import.meta.url).href
  );
}
async function describe(modulePath) {
  const compiler = await compilerModule(modulePath);
  const profiles = Object.values(compiler.TARGET_PROFILES)
    .map((profile) => {
      const admission = profile.implemented ? null : compiler.resolveTargetProfile(profile.id);
      if (admission)
        assert.equal(admission.ok, false, 'Unimplemented public profile unexpectedly admitted');
      return { ...profile, declarationDiagnostics: admission?.diagnostics ?? [] };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  if (modulePath) {
    const identity = json(path.join(path.dirname(modulePath), 'compiler-build.json'));
    for (const input of identity.inputs)
      assert.equal(
        sha(readFileSync(path.join(root, input.path))),
        input.sha256,
        `Pinned implementation drift: ${input.path}`
      );
  }
  const packageIdentity = (owner, name) => {
    const require = createRequire(owner);
    const manifestPath = require.resolve(`${name}/package.json`);
    const entryPath = require.resolve(name);
    return {
      name,
      version: json(manifestPath).version,
      manifestPath,
      manifestSha256: sha(readFileSync(manifestPath)),
      entryPath,
      entrySha256: sha(readFileSync(entryPath)),
    };
  };
  return {
    profiles,
    compilerBuild: compiler.compilerBuildIdentity,
    compilerModule: modulePath ?? 'packages/compiler/src/index.ts',
    compilerModuleSha256: sha(
      readFileSync(modulePath ?? path.join(root, 'packages/compiler/src/index.ts'))
    ),
    sourceLoaderSha256: sha(
      readFileSync(path.join(root, 'packages/compiler/src/source-loader.ts'))
    ),
    node: process.version,
    compilerTypeScript: packageIdentity(modulePath ?? script, 'typescript'),
    sourceLoaderTypeScript: packageIdentity(script, 'typescript'),
    typescriptLoader: packageIdentity(script, 'tsx'),
  };
}
function workerCommand(extra, heapMb, timeoutMs = 180000) {
  return spawnSync(
    process.execPath,
    [`--max-old-space-size=${heapMb}`, '--import', 'tsx', script, ...extra],
    {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: timeoutMs,
    }
  );
}
function resourceSnapshot() {
  return { ...process.memoryUsage(), peakRssKiB: process.resourceUsage().maxRSS };
}
function closureBinding(snapshot, graph, failures, entry) {
  const files = Object.entries(snapshot?.files ?? {})
    .map(([file, content]) => ({
      file,
      sha256: sha(content),
      bytes: Buffer.byteLength(content),
    }))
    .sort((left, right) => left.file.localeCompare(right.file));
  return {
    entry,
    files,
    filesSha256: digest(files),
    sourceImports: snapshot?.sourceImports ?? {},
    sourceResolution: snapshot?.sourceResolution ?? null,
    dependencies: [...graph.dependencies].sort(),
    resolutionFiles: [...graph.resolutionFiles].sort(),
    failures: failures.map((error) => ({
      name: error?.name ?? null,
      message: String(error?.message ?? error),
    })),
    sharedSnapshot: !!snapshot && failures.length === 0,
  };
}

async function compileEntry(requestPath) {
  const request = json(requestPath),
    plan = json(path.join(request.output, 'plan.json'));
  assert.equal(request.universeFingerprint, plan.universeFingerprint);
  const compiler = await compilerModule(plan.binding.compilerModulePath);
  const { FileSourceGraph } = await import('../../packages/compiler/src/source-loader.ts');
  const entry = plan.entries.find((row) => row.entry === request.entry);
  assert.ok(entry, 'Worker entry must be in the frozen universe');
  assert.equal(
    sha(readFileSync(path.join(root, entry.entry))),
    entry.sha256,
    'Entry changed before worker read'
  );
  const graph = new FileSourceGraph(root),
    started = performance.now();
  let snapshot,
    failures = [];
  try {
    snapshot = await graph.load(await graph.entry(path.join(root, entry.entry)));
    failures = [...snapshot.failures];
  } catch (error) {
    failures = [error];
  }
  const closure = closureBinding(snapshot, graph, failures, entry.entry);
  const closureSha256 = digest(closure),
    closureFile = `closures/${id(entry.entry)}.json`;
  const closurePath = path.join(request.output, closureFile);
  if (existsSync(closurePath))
    assert.equal(digest(json(closurePath)), closureSha256, 'Closure changed during resume');
  else save(closurePath, closure);
  const closureReadMs = performance.now() - started;
  if (closure.sharedSnapshot) {
    Object.freeze(snapshot.files);
    if (snapshot.sourceImports) Object.freeze(snapshot.sourceImports);
  }
  for (const profile of request.profiles) {
    assert.ok(
      plan.profiles.find((row) => row.id === profile)?.implemented,
      'Only public implemented profiles execute'
    );
    const rowStart = performance.now(),
      before = resourceSnapshot();
    let result;
    try {
      // A failed load cannot be passed as sourceSnapshot: compileFile must perform
      // its own loader-error path. All successful loads share this exact snapshot.
      result = await compiler.compileFile(entry.entry, {
        root,
        profile,
        ...(closure.sharedSnapshot ? { sourceSnapshot: snapshot } : {}),
      });
    } catch (error) {
      result = {
        ok: false,
        diagnostics: [
          {
            code: 'INVENTORY_UNCAUGHT',
            category: 'compiler-defect',
            message: String(error.stack ?? error),
            span: {
              file: entry.entry,
              start: -1,
              end: -1,
              line: 0,
              column: 0,
              endLine: 0,
              endColumn: 0,
            },
          },
        ],
      };
    }
    const elapsedMs = performance.now() - rowStart;
    const row = {
      universeFingerprint: plan.universeFingerprint,
      entry: entry.entry,
      family: entry.family,
      entrySha256: entry.sha256,
      profile,
      profileSha256: digest(plan.profiles.find((item) => item.id === profile)),
      execution: 'compileFile-source-to-emitter',
      ...classifyResult(result),
      elapsedMs,
      closure: {
        file: closureFile,
        sha256: closureSha256,
        files: closure.files.length,
        sourceBytes: closure.files.reduce((sum, file) => sum + file.bytes, 0),
        sharedSnapshot: closure.sharedSnapshot,
        readMs: closureReadMs,
      },
      memory: {
        heapLimitMiB: request.heapMb,
        before,
        after: resourceSnapshot(),
        scope:
          'Per-entry worker process. RSS peak includes imports, snapshot reading and all profiles executed so far; not per-component allocation or runtime performance.',
      },
    };
    if (result.ok) {
      const output = result.value.output;
      const artifacts = compiler.compilationArtifacts(result.value).map((file) => ({
        path: file.path,
        kind: file.kind,
        bytes: Buffer.byteLength(file.contents),
        sha256: sha(file.contents),
      }));
      const emittedFiles = `emitted/${id(key(entry.entry, profile))}.json`;
      save(path.join(request.output, emittedFiles), { artifacts });
      row.output = {
        profile: output.profile,
        irSha256: digest(result.value.ir),
        sourceGraphSha256: result.value.ir.source.sha256,
        admittedSourceFilesSha256: digest(
          result.value.ir.sourceFiles.map(({ file, sha256 }) => ({ file, sha256 }))
        ),
        generatedSourceSha256: sha(output.code),
        generatedSourceBytes: Buffer.byteLength(output.code),
        supportingFiles: output.supportingFiles?.length ?? 0,
        supportingSourceBytes: (output.supportingFiles ?? [])
          .filter((file) => file.kind === 'source')
          .reduce((sum, file) => sum + Buffer.byteLength(file.contents), 0),
        dependencies: output.dependencies,
        artifacts: { file: emittedFiles, sha256: digest({ artifacts }), count: artifacts.length },
      };
    }
    row.memory.after = resourceSnapshot();
    save(path.join(request.output, 'rows', `${id(key(entry.entry, profile))}.json`), row);
    process.stdout.write(
      JSON.stringify({
        entry: entry.entry,
        profile,
        status: row.status,
        failureKind: row.failureKind,
        elapsedMs,
        peakRssKiB: row.memory.after.peakRssKiB,
      }) + '\n'
    );
  }
  assert.equal(
    digest(closureBinding(snapshot, graph, failures, entry.entry)),
    closureSha256,
    'Shared source snapshot changed during profile execution'
  );
  save(requestPath.replace(/\.request\.json$/, '.resources.json'), {
    heapLimitMiB: request.heapMb,
    final: resourceSnapshot(),
    profiles: request.profiles,
  });
}

function storedRows(directory, plan, selectedKeys) {
  const rows = new Map(),
    location = path.join(directory, 'rows');
  const files = selectedKeys
    ? selectedKeys
        .map((rowKey) => `${id(rowKey)}.json`)
        .filter((file) => existsSync(path.join(location, file)))
    : existsSync(location)
      ? readdirSync(location).filter((name) => name.endsWith('.json'))
      : [];
  for (const file of files) {
    const row = json(path.join(location, file));
    assert.equal(
      row.universeFingerprint,
      plan.universeFingerprint,
      'Foreign receipt in run directory'
    );
    assert.equal(file, `${id(key(row.entry, row.profile))}.json`);
    assert.equal(row.entrySha256, plan.entries.find((item) => item.entry === row.entry)?.sha256);
    assert.ok(plan.profiles.find((profile) => profile.id === row.profile)?.implemented);
    assert.ok(['PASS', 'FAIL', 'UNSUPPORTED'].includes(row.status));
    assert.equal(digest(json(path.join(directory, row.closure.file))), row.closure.sha256);
    if (row.output)
      assert.equal(
        digest(json(path.join(directory, row.output.artifacts.file))),
        row.output.artifacts.sha256
      );
    assert.ok(!rows.has(key(row.entry, row.profile)), 'Duplicate stored receipt');
    rows.set(key(row.entry, row.profile), row);
  }
  return rows;
}
function report(plan, completed, receipts) {
  const rows = [];
  for (const entry of plan.entries)
    for (const profile of plan.profiles) {
      const observed = completed.get(key(entry.entry, profile.id));
      rows.push(
        observed ?? {
          entry: entry.entry,
          family: entry.family,
          entrySha256: entry.sha256,
          profile: profile.id,
          status: profile.implemented ? 'UNTESTED' : 'UNIMPLEMENTED',
          failureKind: profile.implemented ? null : 'public-profile-unimplemented',
          execution: profile.implemented ? 'not-executed' : 'profile-declaration-only',
          firstDiagnostic: profile.declarationDiagnostics[0] ?? null,
          diagnostics: profile.declarationDiagnostics,
          closure: null,
          elapsedMs: null,
        }
      );
    }
  const statuses = Object.fromEntries(
    ['PASS', 'FAIL', 'UNSUPPORTED', 'UNIMPLEMENTED', 'UNTESTED'].map((status) => [
      status,
      rows.filter((row) => row.status === status).length,
    ])
  );
  const currentNames = new Set(plan.entries.map((row) => row.entry));
  const oldNames = new Set(plan.history.members?.map((row) => row.entry) ?? []);
  return {
    schema: SCHEMA,
    universeFingerprint: plan.universeFingerprint,
    binding: plan.binding,
    scope:
      'Complete tracked authored entry × public profile admission. PASS means compileFile reached an emitted output; it does not establish strict target build, runtime parity, physical/native platform execution, visual/AT acceptance or all Issue #732 conditions.',
    counts: {
      entries: plan.entries.length,
      families: familyCounts(plan.entries),
      profiles: plan.profiles.length,
      implementedProfiles: plan.profiles.filter((item) => item.implemented).length,
      rows: rows.length,
      statuses,
      compilerDefects: rows.filter((row) => row.failureKind === 'compiler-defect').length,
    },
    admissionCoverageComplete: statuses.UNTESTED === 0,
    allImplementedEntriesAdmitted:
      statuses.UNTESTED === 0 && statuses.FAIL === 0 && statuses.UNSUPPORTED === 0,
    profiles: plan.profiles,
    history: plan.history,
    historicalMembership: plan.history.recovered
      ? {
          retained: [...oldNames].filter((name) => currentNames.has(name)),
          removed: [...oldNames].filter((name) => !currentNames.has(name)),
          added: [...currentNames].filter((name) => !oldNames.has(name)),
          scope:
            'Membership delta only; old outcomes are reported historical facts, never rewritten from new results.',
        }
      : null,
    receipts,
    rows,
  };
}

function options(args) {
  const result = {
    entries: [],
    families: [],
    profiles: null,
    shard: [0, 1],
    heapMb: 3072,
    entryTimeoutMs: 180000,
    maxEntries: Infinity,
    resume: false,
    planOnly: false,
  };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--resume') result.resume = true;
    else if (flag === '--plan-only') result.planOnly = true;
    else {
      const value = args[++index];
      assert.ok(value && !value.startsWith('--'), `Missing value for ${flag}`);
      if (flag === '--output') result.output = path.resolve(value);
      else if (flag === '--entry') result.entries.push(value);
      else if (flag === '--family') result.families.push(value);
      else if (flag === '--profiles') result.profiles = value.split(',');
      else if (flag === '--compiler') result.compiler = path.resolve(value);
      else if (flag === '--baseline') result.baseline = path.resolve(value);
      else if (flag === '--shard') result.shard = value.split('/').map(Number);
      else if (flag === '--heap-mb') result.heapMb = Number(value);
      else if (flag === '--entry-timeout-ms') result.entryTimeoutMs = Number(value);
      else if (flag === '--max-entries') result.maxEntries = Number(value);
      else throw new Error(`Unknown flag ${flag}`);
    }
  }
  assert.ok(result.output, '--output is required');
  const relative = path.relative(root, result.output);
  assert.ok(
    relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative),
    'Evidence output must be outside the source checkout'
  );
  assert.ok(Number.isSafeInteger(result.heapMb) && result.heapMb >= 256 && result.heapMb <= 8192);
  assert.ok(Number.isSafeInteger(result.entryTimeoutMs) && result.entryTimeoutMs > 0);
  assert.ok(
    result.maxEntries === Infinity ||
      (Number.isSafeInteger(result.maxEntries) && result.maxEntries > 0)
  );
  assert.ok(
    result.shard.length === 2 &&
      result.shard.every(Number.isSafeInteger) &&
      result.shard[1] > 0 &&
      result.shard[0] >= 0 &&
      result.shard[0] < result.shard[1]
  );
  return result;
}
async function run(args) {
  const opt = options(args);
  assert.equal(
    git('status', '--porcelain', '--untracked-files=no'),
    '',
    'Tracked source must be clean'
  );
  const revision = git('rev-parse', 'HEAD').trim(),
    objectFormat = git('rev-parse', '--show-object-format').trim();
  const entries = entryPaths(revision).map((entry) => {
    assert.equal(entry.type, 'blob');
    assert.ok(
      ['100644', '100755'].includes(entry.mode),
      `Unsupported authored member mode: ${entry.entry}`
    );
    const bytes = readFileSync(path.join(root, entry.entry));
    assert.equal(
      createHash(objectFormat).update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
      entry.blob,
      `Working source differs from Git: ${entry.entry}`
    );
    return { ...entry, sha256: sha(bytes), bytes: bytes.length };
  });
  const described = workerCommand(['--describe', opt.compiler ?? ''], opt.heapMb);
  assert.equal(described.status, 0, described.stderr);
  const description = JSON.parse(described.stdout),
    profiles = description.profiles;
  const selectedProfiles = opt.profiles ?? profiles.map((profile) => profile.id);
  assert.equal(new Set(selectedProfiles).size, selectedProfiles.length);
  for (const profile of selectedProfiles)
    assert.ok(
      profiles.some((row) => row.id === profile),
      `Unknown profile ${profile}`
    );
  for (const entry of opt.entries)
    assert.ok(
      entries.some((row) => row.entry === entry),
      `Unknown entry ${entry}`
    );
  for (const family of opt.families)
    assert.ok(
      entries.some((row) => row.family === family),
      `Unknown family ${family}`
    );
  const selectedEntries = entries
    .filter((entry, index) => index % opt.shard[1] === opt.shard[0])
    .filter((entry) => !opt.entries.length || opt.entries.includes(entry.entry))
    .filter((entry) => !opt.families.length || opt.families.includes(entry.family))
    .map((row) => row.entry);
  assert.ok(selectedEntries.length, 'Selection contains no authored entries');
  // Historical objects may be fetched between batches. Preserve the original
  // history observation for this run instead of invalidating completed rows.
  const history =
    opt.resume && existsSync(path.join(opt.output, 'plan.json'))
      ? json(path.join(opt.output, 'plan.json')).history
      : recoverHistory();
  const binding = {
    sourceRoot: root,
    revision,
    tree: git('show', '--no-patch', '--format=%T', revision).trim(),
    scriptSha256: sha(readFileSync(script)),
    sourceEntriesSha256: digest(entries),
    profilesSha256: digest(profiles),
    historySha256: digest(history),
    compilerModulePath: opt.compiler ?? null,
    ...description,
    lockSha256: sha(readFileSync(path.join(root, 'pnpm-lock.yaml'))),
  };
  delete binding.profiles;
  const universeFingerprint = digest(binding),
    selection = { entries: selectedEntries, profiles: selectedProfiles, shard: opt.shard };
  const plan = {
    schema: SCHEMA,
    universeFingerprint,
    binding,
    entries,
    profiles,
    history,
    selection,
    createdAt: new Date().toISOString(),
  };
  if (existsSync(opt.output)) {
    assert.ok(opt.resume, 'Existing output requires --resume');
    const previous = json(path.join(opt.output, 'plan.json'));
    assert.equal(
      previous.universeFingerprint,
      universeFingerprint,
      'Resume source/compiler/profile/script identity changed'
    );
    assert.equal(digest(previous.selection), digest(selection), 'Resume selection changed');
    plan.createdAt = previous.createdAt;
  } else {
    assert.equal(opt.resume, false, '--resume needs an existing run');
    mkdirSync(opt.output, { recursive: true });
    save(path.join(opt.output, 'plan.json'), plan);
  }
  const lock = path.join(opt.output, 'writer-lock.json');
  writeFileSync(
    lock,
    JSON.stringify({
      pid: process.pid,
      sourceRoot: root,
      universeFingerprint,
      startedAt: new Date().toISOString(),
    }),
    { flag: 'wx' }
  );
  let stopped = false,
    attempts = 0;
  const stop = () => {
    stopped = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    const completed = storedRows(opt.output, plan);
    for (const entry of selectedEntries) {
      if (opt.planOnly || stopped || attempts >= opt.maxEntries) break;
      const pending = selectedProfiles.filter(
        (profile) =>
          profiles.find((row) => row.id === profile).implemented &&
          !completed.has(key(entry, profile))
      );
      if (!pending.length) continue;
      const requestPath = path.join(
        opt.output,
        'attempts',
        `${id(entry)}-${randomUUID()}.request.json`
      );
      save(requestPath, {
        output: opt.output,
        universeFingerprint,
        entry,
        profiles: pending,
        heapMb: opt.heapMb,
        timeoutMs: opt.entryTimeoutMs,
      });
      const started = performance.now(),
        child = workerCommand(['--worker', requestPath], opt.heapMb, opt.entryTimeoutMs);
      const prefix = requestPath.replace(/\.request\.json$/, '');
      writeFileSync(prefix + '.stdout.log', child.stdout ?? '');
      writeFileSync(prefix + '.stderr.log', child.stderr ?? '');
      save(prefix + '.process.json', {
        entry,
        profiles: pending,
        heapLimitMiB: opt.heapMb,
        timeoutMs: opt.entryTimeoutMs,
        status: child.status,
        signal: child.signal,
        error: child.error?.message ?? null,
        resources: existsSync(prefix + '.resources.json') ? json(prefix + '.resources.json') : null,
        elapsedMs: performance.now() - started,
        sourceRevision: revision,
        command: [
          process.execPath,
          `--max-old-space-size=${opt.heapMb}`,
          '--import',
          'tsx',
          script,
          '--worker',
          requestPath,
        ],
      });
      attempts++;
      for (const [rowKey, row] of storedRows(
        opt.output,
        plan,
        pending.map((profile) => key(entry, profile))
      ))
        completed.set(rowKey, row);
      save(path.join(opt.output, 'progress.json'), {
        universeFingerprint,
        completedRows: completed.size,
        attemptsThisInvocation: attempts,
        lastEntry: entry,
        updatedAt: new Date().toISOString(),
      });
      process.stdout.write(child.stdout ?? '');
      if (child.status !== 0 || child.error) {
        stopped = true;
        process.stderr.write(child.stderr ?? '');
      }
    }
    assert.equal(
      git('rev-parse', 'HEAD').trim(),
      revision,
      'Source revision changed during inventory'
    );
    assert.equal(
      git('status', '--porcelain', '--untracked-files=no'),
      '',
      'Tracked source changed during inventory'
    );
    const final = report(plan, completed, [{ directory: opt.output, selection }]);
    if (opt.baseline) final.ratchet = compareReports(json(opt.baseline), final);
    final.selectedComplete = selectedEntries.every((entry) =>
      selectedProfiles.every(
        (profile) =>
          !profiles.find((row) => row.id === profile).implemented ||
          completed.has(key(entry, profile))
      )
    );
    final.stopped = stopped;
    save(path.join(opt.output, 'report.json'), final);
    console.log(
      JSON.stringify({
        output: opt.output,
        selectedComplete: final.selectedComplete,
        ...final.counts,
        ratchet: final.ratchet?.ok ?? null,
      })
    );
    process.exitCode =
      stopped || (!opt.planOnly && !final.selectedComplete && opt.maxEntries === Infinity)
        ? 2
        : final.ratchet?.ok === false || final.counts.compilerDefects
          ? 1
          : 0;
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    rmSync(lock);
  }
}

function merge(args) {
  const output = path.resolve(args.shift()),
    baselineIndex = args.indexOf('--baseline');
  let baseline;
  if (baselineIndex !== -1) {
    assert.equal(baselineIndex, args.length - 2, '--baseline must be the final merge option');
    baseline = json(path.resolve(args[baselineIndex + 1]));
    args.splice(baselineIndex);
  }
  assert.ok(args.length, 'Provide run directories to merge');
  const plans = args.map((directory) => json(path.join(directory, 'plan.json'))),
    plan = plans[0];
  const completed = new Map();
  for (let index = 0; index < args.length; index++) {
    assert.equal(
      plans[index].universeFingerprint,
      plan.universeFingerprint,
      'Cannot merge different source/compiler/profile/script identities'
    );
    for (const [rowKey, row] of storedRows(args[index], plans[index])) {
      assert.ok(!completed.has(rowKey), `Overlapping shard receipt: ${row.entry} / ${row.profile}`);
      completed.set(rowKey, { ...row, receiptRoot: path.resolve(args[index]) });
    }
  }
  const result = report(
    plan,
    completed,
    args.map((directory, index) => ({
      directory: path.resolve(directory),
      selection: plans[index].selection,
    }))
  );
  if (baseline) result.ratchet = compareReports(baseline, result);
  save(output, result);
  console.log(
    JSON.stringify({
      output,
      complete: result.admissionCoverageComplete,
      ...result.counts,
      ratchet: result.ratchet?.ok ?? null,
    })
  );
  process.exitCode = !result.admissionCoverageComplete
    ? 2
    : result.ratchet?.ok === false || result.counts.compilerDefects
      ? 1
      : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === script) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--worker') await compileEntry(args[1]);
    else if (args[0] === '--describe')
      console.log(JSON.stringify(await describe(args[1] || undefined)));
    else if (args[0] === '--merge') merge(args.slice(1));
    else if (args[0] === '--recover-history') save(path.resolve(args[1]), recoverHistory());
    else await run(args);
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 2;
  }
}
