import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { participantRequest } from './no-tools.mjs';

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
export const jsonBytes = (value) => Buffer.from(JSON.stringify(value));

const conditions = ['none', 'ordinary', 'proto'];
const requiredSources = [
  'scripts/benchmark/participant/nine-plan.mjs',
  'scripts/benchmark/participant/nine-plan.test.mjs',
  'scripts/benchmark/participant/nine-runner.mjs',
  'scripts/benchmark/participant/nine-runner.test.mjs',
];
const taskRoot = 'benchmarks/interaction/tasks/tabs-settings/';
const parentPath = 'parent-manifest.json';
const configPath = 'execution-config.json';
const budgetPath = 'budget-policy.json';
const sourceVisibility =
  'coordinator-only; selected task/starter/docs copied into request allowlist separately';

function hash(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a SHA256 hex string`);
  assert.match(value, /^[a-f0-9]{64}$/, `${label} must be a SHA256 hex string`);
}
function object(value, label) {
  assert.ok(
    value && Object.getPrototypeOf(value) === Object.prototype,
    `${label} must be an object`
  );
}
function relative(name) {
  assert.equal(typeof name, 'string', 'Relative path required');
  assert.ok(
    name.length > 0 &&
      !path.isAbsolute(name) &&
      !/[\\\0]/.test(name) &&
      name.split('/').every((part) => part && part !== '.' && part !== '..'),
    `Unsafe relative path: ${name}`
  );
  return name;
}
function absolute(name) {
  assert.ok(typeof name === 'string' && path.isAbsolute(name), 'Absolute directory required');
  assert.ok(
    !/[\\\0]/.test(name) && !name.split('/').some((p) => p === '.' || p === '..'),
    `Unsafe absolute path: ${name}`
  );
  return path.resolve(name);
}

// Coordination guards, not a hostile-host filesystem/TOCTOU sandbox. Check every
// component, including ancestors of roots, before any read or exclusive write.
async function safeDirectory(directory) {
  const root = absolute(directory);
  let current = path.parse(root).root;
  for (const part of root.slice(current.length).split('/').filter(Boolean)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    assert.ok(!stat.isSymbolicLink() && stat.isDirectory(), `Unsafe directory: ${current}`);
  }
  return root;
}
async function safeRead(root, name) {
  relative(name);
  const target = path.join(root, name);
  await safeDirectory(path.dirname(target));
  const stat = await lstat(target);
  assert.ok(!stat.isSymbolicLink() && stat.isFile(), `Unsafe file: ${target}`);
  return readFile(target);
}
async function safeWrite(root, name, bytes) {
  relative(name);
  const target = path.join(root, name);
  let current = root;
  for (const part of name.split('/').slice(0, -1)) {
    current = path.join(current, part);
    try {
      await mkdir(current);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    await safeDirectory(current);
  }
  await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
}
function entry(name, bytes, source) {
  return {
    path: relative(name),
    bytes: bytes.length,
    sha256: sha256(bytes),
    ...(source === undefined ? {} : { source: relative(source), visibility: sourceVisibility }),
  };
}
async function inventoryBytes(manifest, directory, sourceRoot) {
  assert.ok(Array.isArray(manifest.inventory), 'Missing inventory');
  const files = new Map();
  const sources = new Set();
  for (const item of manifest.inventory) {
    object(item, 'inventory entry');
    relative(item.path);
    assert.notEqual(item.path, 'manifest.json', 'Manifest cannot inventory itself');
    assert.ok(!files.has(item.path), `Duplicate inventory path: ${item.path}`);
    assert.ok(Number.isSafeInteger(item.bytes) && item.bytes >= 0, 'Invalid byte count');
    hash(item.sha256, 'Inventory digest');
    const bytes = await safeRead(directory, item.path);
    assert.equal(bytes.length, item.bytes, `Inventory size drift: ${item.path}`);
    assert.equal(sha256(bytes), item.sha256, `Inventory hash drift: ${item.path}`);
    if (item.source !== undefined) {
      relative(item.source);
      assert.equal(item.path, `sources/${item.source}`, 'Source capture path mismatch');
      assert.ok(!sources.has(item.source), `Duplicate source: ${item.source}`);
      sources.add(item.source);
      const current = await safeRead(sourceRoot, item.source);
      assert.equal(current.length, item.bytes, `Current source size drift: ${item.source}`);
      assert.equal(sha256(current), item.sha256, `Current source hash drift: ${item.source}`);
    }
    files.set(item.path, bytes);
  }
  return files;
}

// Configuration is JSON metadata, never an authentication container. This rejects
// credential fields, recognizable secret strings and URL auth/query credentials;
// it cannot recognize an arbitrary secret disguised as ordinary prose.
function credentialKey(key) {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return /^(?:authorization|proxyauthorization|bearer|cookie|setcookie|token|apikey|accesskey|accesskeyid|accesskeysecret|accesstoken|refreshtoken|idtoken|password|passwd|privatekey|clientsecret|secret|credentials?)(?:$|value|header)/.test(
    normalized
  );
}
function jsonMetadata(value, label) {
  object(value, label);
  const visit = (item) => {
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'number') {
      assert.ok(Number.isFinite(item), 'Non-finite config number');
      return;
    }
    if (typeof item === 'string') {
      assert.ok(
        !/(?:\b(?:Bearer|Basic)\s+\S+|\bsk-[a-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i.test(
          item
        ),
        'Credentials are not allowed in config'
      );
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(item)) {
        const url = new URL(item);
        assert.ok(!url.username && !url.password, 'URL credentials are not allowed');
        for (const key of url.searchParams.keys())
          assert.ok(!credentialKey(key), 'URL credential query is not allowed');
      }
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    object(item, label);
    for (const [key, child] of Object.entries(item)) {
      assert.ok(!credentialKey(key), `Credential field is not allowed: ${key}`);
      visit(child);
    }
  };
  visit(value);
  // Also rejects cycles, undefined properties, accessors' non-JSON products, etc.
  const bytes = jsonBytes(value);
  assert.deepEqual(JSON.parse(bytes), value, `${label} must be plain JSON`);
  return bytes;
}

// Known runner metadata keeps exact types without imposing a closed schema on
// future nonsecret route/disclosure fields. Reference estimates never become a
// hard monetary cap or measured bill by entering this offline amendment.
function executionBytes(value) {
  const bytes = jsonMetadata(value, 'executionConfig');
  for (const key of [
    'endpoint',
    'providerName',
    'upstreamBaseUrl',
    'routeFingerprint',
    'chromiumPath',
  ])
    if (Object.hasOwn(value, key))
      assert.ok(typeof value[key] === 'string' && value[key].length > 0, `Invalid config ${key}`);
  for (const key of ['endpoint', 'upstreamBaseUrl'])
    if (Object.hasOwn(value, key)) {
      const url = new URL(value[key]);
      assert.ok(['http:', 'https:'].includes(url.protocol), `Invalid config ${key} protocol`);
    }
  for (const key of ['allowLoopbackHttp', 'allowLocalHttp'])
    if (Object.hasOwn(value, key))
      assert.equal(typeof value[key], 'boolean', `Invalid config ${key}`);
  if (Object.hasOwn(value, 'proxyMaxRetries'))
    assert.ok(
      Number.isSafeInteger(value.proxyMaxRetries) && value.proxyMaxRetries >= 0,
      'Invalid config proxyMaxRetries'
    );
  return bytes;
}
function policyBytes(value) {
  const bytes = jsonMetadata(value, 'budgetPolicy');
  if (Object.hasOwn(value, 'admission'))
    assert.ok(
      typeof value.admission === 'string' && value.admission.length > 0,
      'Invalid budget admission'
    );
  if (Object.hasOwn(value, 'referenceEnvelopeUSD')) {
    assert.ok(
      typeof value.referenceEnvelopeUSD === 'number' && value.referenceEnvelopeUSD >= 0,
      'Invalid referenceEnvelopeUSD'
    );
    assert.equal(value.referenceEnvelopeIsNotHardCap, true, 'Reference envelope is not a hard cap');
  }
  if (Object.hasOwn(value, 'referenceEnvelopeIsNotHardCap'))
    assert.equal(value.referenceEnvelopeIsNotHardCap, true, 'Reference envelope is not a hard cap');
  if (Object.hasOwn(value, 'actualBillingUSD'))
    assert.equal(
      value.actualBillingUSD,
      null,
      'Offline preparation does not establish actual billing'
    );
  if (Object.hasOwn(value, 'feeRiskDisclosure'))
    object(value.feeRiskDisclosure, 'feeRiskDisclosure');
  return bytes;
}

function randomized(seed) {
  hash(seed, 'Seed');
  const permutations = [
    ['none', 'ordinary', 'proto'],
    ['none', 'proto', 'ordinary'],
    ['ordinary', 'none', 'proto'],
    ['ordinary', 'proto', 'none'],
    ['proto', 'none', 'ordinary'],
    ['proto', 'ordinary', 'none'],
  ];
  // Six first-row permutations, each followed by left rotation 1 or 2. The
  // remaining rotation is row 3: exactly the twelve order-3 Latin squares.
  const candidates = permutations.flatMap((row) =>
    [1, 2].map((shift) => [
      row,
      [...row.slice(shift), ...row.slice(0, shift)],
      [...row.slice(3 - shift), ...row.slice(0, 3 - shift)],
    ])
  );
  let counter = 0;
  let uint32;
  do {
    uint32 = createHash('sha256').update(`${seed}:${counter}`).digest().readUInt32BE(0);
    if (uint32 < 4294967292) break;
    counter++;
  } while (true);
  return {
    seed,
    algorithm:
      'SHA256(UTF8(lowercase-hex-seed:decimal-counter)), counter from 0; first big-endian uint32; reject >=4294967292 (floor(2^32/12)*12); selection = uint32 modulo 12; six lexicographic first-row permutations times second-row left rotations 1,2; third row is remaining rotation',
    candidates,
    counter,
    uint32,
    selection: uint32 % 12,
  };
}
function schedule(randomization, packets) {
  return randomization.candidates[randomization.selection].flatMap((row, block) =>
    row.map((condition, position) => ({
      id: `block-${block + 1}-${condition}`,
      block: block + 1,
      position: position + 1,
      condition,
      requestSha256: packets[condition].request.sha256,
    }))
  );
}
function checkSchedule(runs, packets, balanced) {
  assert.ok(Array.isArray(runs) && runs.length === 9, 'Exactly nine schedule slots required');
  const ids = new Set();
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    object(run, 'schedule slot');
    assert.deepEqual(Object.keys(run).sort(), [
      'block',
      'condition',
      'id',
      'position',
      'requestSha256',
    ]);
    assert.equal(run.block, Math.floor(i / 3) + 1, 'Block order mismatch');
    assert.equal(run.position, (i % 3) + 1, 'Position order mismatch');
    assert.ok(conditions.includes(run.condition), 'Unknown condition');
    assert.equal(run.id, `block-${run.block}-${run.condition}`, 'Schedule ID mismatch');
    assert.ok(!ids.has(run.id), 'Duplicate slot');
    ids.add(run.id);
    assert.equal(
      run.requestSha256,
      packets[run.condition].request.sha256,
      'Slot wire hash mismatch'
    );
  }
  const check = (row) =>
    assert.deepEqual(row.sort(), [...conditions].sort(), 'Unbalanced schedule');
  for (let block = 0; block < 3; block++)
    check(runs.slice(block * 3, block * 3 + 3).map((run) => run.condition));
  if (balanced)
    for (let position = 0; position < 3; position++)
      check([0, 1, 2].map((block) => runs[block * 3 + position].condition));
}

function validateParent(parent) {
  object(parent, 'parent manifest');
  assert.equal(parent.schemaVersion, 1);
  assert.equal(parent.kind, 'tabs-settings-three-condition-content-freeze');
  for (const key of ['parent', 'executionConfig', 'budgetPolicy'])
    assert.ok(!Object.hasOwn(parent, key), `Parent already contains amendment field: ${key}`);
  assert.equal(parent.newParticipantCalls, 0);
  assert.equal(parent.executionPermission, false, 'Preparation cannot grant execution permission');
  assert.equal(parent.budgets.participantDispatches, 9);
  assert.equal(parent.budgets.reservations, 9);
  assert.equal(parent.budgets.retries, 0);
  assert.equal(parent.budgets.discovery, 0);
  assert.ok(
    Array.isArray(parent.coreInventory) && parent.coreInventory.length === 15,
    'Core15 required'
  );
  const ids = parent.coreInventory.map((criterion) => criterion.id);
  assert.equal(new Set(ids).size, 15, 'Duplicate core criterion');
  assert.equal(parent.newFeatureCriteria.length, 6);
  assert.equal(parent.regressionCriteria.length, 9);
  assert.deepEqual(
    [...parent.newFeatureCriteria, ...parent.regressionCriteria].sort(),
    [...ids].sort(),
    'Core6+9 partition mismatch'
  );
  assert.deepEqual(Object.keys(parent.packets).sort(), [...conditions].sort());
  checkSchedule(parent.schedule, parent.packets, false);
}
function checkPackets(manifest, files) {
  const pin = (source) => {
    const item = manifest.inventory.find((e) => e.source === `${taskRoot}${source}`);
    assert.ok(item, `Missing parent source pin: ${source}`);
    return files.get(item.path).toString('utf8');
  };
  const prompt = pin('task.md');
  const starter = pin('starter.html');
  const material = (name, text) => ({ name, text, sha256: sha256(text) });
  const packets = {};
  for (const condition of conditions) {
    const descriptors = manifest.packets[condition];
    assert.deepEqual(Object.keys(descriptors).sort(), ['packet', 'request']);
    for (const kind of ['packet', 'request']) {
      const descriptor = descriptors[kind];
      const listed = manifest.inventory.find((e) => e.path === descriptor.path);
      assert.deepEqual(descriptor, listed, `Packet ${kind} not bound by inventory`);
      assert.equal(
        descriptor.path,
        `${kind === 'packet' ? 'packets' : 'requests'}/${condition}.json`
      );
    }
    const packet = JSON.parse(files.get(descriptors.packet.path));
    const expected = { prompt, materials: [material('starting-code', starter)] };
    if (condition !== 'none')
      expected.materials.push(material('documentation', pin(`${condition}.md`)));
    assert.deepEqual(packet, expected, `Parent source isolation mismatch: ${condition}`);
    const request = participantRequest({
      packet,
      model: manifest.model.requestedAlias,
      maxOutputTokens: manifest.wire.max_output_tokens,
      stream: manifest.wire.stream,
    });
    assert.deepEqual(
      manifest.wire,
      {
        stream: request.stream,
        max_output_tokens: request.max_output_tokens,
        store: false,
        tools: [],
        tool_choice: 'none',
        omitted: ['temperature', 'top_p', 'reasoning', 'service_tier', 'seed'],
      },
      'Unapproved wire controls'
    );
    const requestBytes = files.get(descriptors.request.path);
    assert.ok(requestBytes.equals(jsonBytes(request)), `Wire exact bytes mismatch: ${condition}`);
    packets[condition] = { packet, request, requestBytes };
  }
  return packets;
}

/** Offline execution amendment only. Retains frozen-v1 content/limitations and
 * gates; neither a paid-route admission nor a final freeze. Caller supplies a
 * trusted parent digest and credential-free configuration/policy. No network,
 * credentials lookup, participant dispatch, Git write or mutation of the parent.
 */
export async function prepareNineRevision({
  parentDirectory,
  parentSha256,
  directory,
  seed,
  executionConfig,
  budgetPolicy,
  sourceRoot,
  additionalSources = [],
}) {
  hash(parentSha256, 'Parent digest');
  const randomization = randomized(seed);
  const configBytes = executionBytes(executionConfig);
  const budgetBytes = policyBytes(budgetPolicy);
  const parentRoot = await safeDirectory(parentDirectory);
  const sourcesRoot = await safeDirectory(sourceRoot);
  const destination = absolute(directory);
  const relation = path.relative(parentRoot, destination);
  assert.ok(
    relation && (relation === '..' || relation.startsWith(`..${path.sep}`)),
    'Destination must be outside frozen parent'
  );
  await safeDirectory(path.dirname(destination));
  const parentBytes = await safeRead(parentRoot, 'manifest.json');
  assert.equal(sha256(parentBytes), parentSha256, 'Parent manifest digest mismatch');
  const parent = JSON.parse(parentBytes);
  validateParent(parent);
  const files = await inventoryBytes(parent, parentRoot, sourcesRoot);
  checkPackets(parent, files);
  assert.ok(Array.isArray(additionalSources), 'additionalSources must be an array');
  additionalSources.forEach(relative);
  const sources = [...new Set([...requiredSources, ...additionalSources])].sort();
  const additions = [
    [entry(parentPath, parentBytes), parentBytes],
    [entry(configPath, configBytes), configBytes],
    [entry(budgetPath, budgetBytes), budgetBytes],
  ];
  for (const source of sources) {
    assert.ok(!parent.inventory.some((e) => e.source === source), 'Cannot rebind parent source');
    const bytes = await safeRead(sourcesRoot, source);
    additions.push([entry(`sources/${source}`, bytes, source), bytes]);
  }
  const manifest = {
    ...parent,
    randomization,
    schedule: schedule(randomization, parent.packets),
    parent: entry(parentPath, parentBytes),
    executionConfig: JSON.parse(configBytes),
    budgetPolicy: JSON.parse(budgetBytes),
    inventory: [...parent.inventory, ...additions.map(([item]) => item)],
  };
  // Reject collisions before claiming the destination; mkdir is exclusive, and
  // all files use wx. A failed write leaves diagnostic partial state, never an
  // overwritten prior revision or a success result.
  const paths = manifest.inventory.map((item) => item.path);
  assert.equal(new Set(paths).size, paths.length, 'Amendment inventory collision');
  checkSchedule(manifest.schedule, manifest.packets, true);
  await mkdir(destination, { mode: 0o700 });
  for (const [name, bytes] of files) await safeWrite(destination, name, bytes);
  for (const [item, bytes] of additions) await safeWrite(destination, item.path, bytes);
  const bytes = jsonBytes(manifest);
  await safeWrite(destination, 'manifest.json', bytes);
  const manifestSha256 = sha256(bytes);
  await inspectNineRevision({ directory: destination, manifestSha256, sourceRoot: sourcesRoot });
  return { directory: destination, manifestSha256, manifest };
}

/** Read-only integrity/replay check against caller's trusted amendment digest,
 * all retained parent artifacts and every current source binding. Hashes bind
 * bytes, not authorship, execution authorization, provider controls or billing.
 */
export async function inspectNineRevision({ directory, manifestSha256, sourceRoot }) {
  hash(manifestSha256, 'Manifest digest');
  const root = await safeDirectory(directory);
  const sourcesRoot = await safeDirectory(sourceRoot);
  const bytes = await safeRead(root, 'manifest.json');
  assert.equal(sha256(bytes), manifestSha256, 'Amendment manifest digest mismatch');
  const manifest = JSON.parse(bytes);
  const files = await inventoryBytes(manifest, root, sourcesRoot);
  const parentBytes = files.get(parentPath);
  assert.ok(parentBytes, 'Missing parent manifest bytes');
  assert.deepEqual(
    manifest.parent,
    entry(parentPath, parentBytes),
    'Parent digest binding mismatch'
  );
  const parent = JSON.parse(parentBytes);
  validateParent(parent);
  assert.deepEqual(
    Object.keys(manifest).sort(),
    [...Object.keys(parent), 'parent', 'executionConfig', 'budgetPolicy'].sort(),
    'Unknown amendment fields'
  );
  for (const key of Object.keys(parent))
    if (!['randomization', 'schedule', 'inventory'].includes(key))
      assert.deepEqual(manifest[key], parent[key], `Unchanged parent invariant drift: ${key}`);
  assert.deepEqual(
    manifest.inventory.slice(0, parent.inventory.length),
    parent.inventory,
    'Parent inventory must be retained unchanged'
  );
  const additions = manifest.inventory.slice(parent.inventory.length);
  const configBytes = executionBytes(manifest.executionConfig);
  const budgetBytes = policyBytes(manifest.budgetPolicy);
  assert.deepEqual(
    additions.slice(0, 3),
    [
      entry(parentPath, parentBytes),
      entry(configPath, configBytes),
      entry(budgetPath, budgetBytes),
    ],
    'Missing or modified amendment config/budget/parent inventory'
  );
  assert.ok(files.get(configPath)?.equals(configBytes), 'Execution config exact bytes mismatch');
  assert.ok(files.get(budgetPath)?.equals(budgetBytes), 'Budget policy exact bytes mismatch');
  const sources = additions.slice(3).map((item) => {
    relative(item.source);
    assert.deepEqual(
      item,
      entry(`sources/${item.source}`, files.get(item.path), item.source),
      'Unapproved amendment inventory'
    );
    return item.source;
  });
  assert.deepEqual(sources, [...sources].sort(), 'Amendment sources must be sorted');
  for (const source of requiredSources)
    assert.ok(sources.includes(source), `Missing source: ${source}`);
  const replay = randomized(manifest.randomization.seed);
  assert.deepEqual(manifest.randomization, replay, 'Randomization seed replay mismatch');
  checkSchedule(manifest.schedule, manifest.packets, true);
  assert.deepEqual(
    manifest.schedule,
    schedule(replay, parent.packets),
    'Schedule seed replay mismatch'
  );
  const packets = checkPackets(parent, files);
  return { manifest, packets };
}
