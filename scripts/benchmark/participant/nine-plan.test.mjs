import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { participantRequest } from './no-tools.mjs';
import { inspectNineRevision, jsonBytes, prepareNineRevision, sha256 } from './nine-plan.mjs';

const conditions = ['none', 'ordinary', 'proto'];
const requiredSources = [
  'scripts/benchmark/participant/nine-plan.mjs',
  'scripts/benchmark/participant/nine-plan.test.mjs',
  'scripts/benchmark/participant/nine-runner.mjs',
  'scripts/benchmark/participant/nine-runner.test.mjs',
];
const taskRoot = 'benchmarks/interaction/tasks/tabs-settings/';
const seed = sha256('synthetic offline test seed; no participant');
const executionConfig = {
  endpoint: 'http://127.0.0.1:9876/v1/responses',
  allowLocalHttp: true,
  participantWallMs: 180000,
  rawResponseBytes: 4000000,
  routeQualification: 'offline synthetic fixture, no network calls',
};
const budgetPolicy = { status: 'not-admitted', referenceFeeUSD: 1, retries: 0 };
const material = (name, text) => ({ name, text, sha256: sha256(text) });
const descriptor = (name, bytes, source) => ({
  path: name,
  bytes: bytes.length,
  sha256: sha256(bytes),
  ...(source === undefined
    ? {}
    : {
        source,
        visibility:
          'coordinator-only; selected task/starter/docs copied into request allowlist separately',
      }),
});
async function put(root, name, bytes) {
  const file = path.join(root, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}
async function fixture(t) {
  // realpath avoids macOS's /var -> /private/var symlink in the temporary root.
  const root = await mkdtemp(path.join(await realpath(os.tmpdir()), 'nine-plan-offline-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const parentDirectory = path.join(root, 'frozen-parent');
  const sourceRoot = path.join(root, 'sources-root');
  const directory = path.join(root, 'revision');
  await mkdir(parentDirectory);
  await mkdir(sourceRoot);
  const texts = {
    'task.md': 'Synthetic task: modify only the supplied standalone example.\n',
    'starter.html': '<!doctype html><html><body>synthetic starter</body></html>\n',
    'ordinary.md': 'Ordinary matched-information synthetic documentation.\n',
    'proto.md': 'Proto matched-information synthetic documentation.\n',
    'claims.json': '{"synthetic":true,"notModelEvidence":true}\n',
  };
  const inventory = [];
  for (const [name, text] of Object.entries(texts)) {
    const source = `${taskRoot}${name}`;
    const bytes = Buffer.from(text);
    await put(sourceRoot, source, bytes);
    await put(parentDirectory, `sources/${source}`, bytes);
    inventory.push(descriptor(`sources/${source}`, bytes, source));
  }
  for (const source of [
    'scripts/benchmark/semantic/tabs-settings-oracle.mjs',
    'scripts/benchmark/participant/no-tools.mjs',
  ]) {
    const bytes = Buffer.from(`// Retained synthetic source pin for ${source}\n`);
    await put(sourceRoot, source, bytes);
    await put(parentDirectory, `sources/${source}`, bytes);
    inventory.push(descriptor(`sources/${source}`, bytes, source));
  }
  // Only the plan module is exercised: these runner pins are inert fixture bytes,
  // not an executor, a participant, a transport or real experiment evidence.
  for (const source of requiredSources)
    await put(sourceRoot, source, Buffer.from(`// Synthetic source binding ${source}\n`));
  const packets = {};
  for (const condition of conditions) {
    const packet = {
      prompt: texts['task.md'],
      materials: [material('starting-code', texts['starter.html'])],
    };
    if (condition !== 'none')
      packet.materials.push(material('documentation', texts[`${condition}.md`]));
    const request = participantRequest({
      packet,
      model: 'synthetic-model',
      maxOutputTokens: 8192,
      stream: true,
    });
    packets[condition] = {};
    for (const [kind, value] of Object.entries({ packet, request })) {
      const name = `${kind === 'packet' ? 'packets' : 'requests'}/${condition}.json`;
      const bytes = jsonBytes(value);
      const item = descriptor(name, bytes);
      packets[condition][kind] = item;
      inventory.push(item);
      await put(parentDirectory, name, bytes);
    }
  }
  const ids = Array.from({ length: 15 }, (_, index) => `synthetic-core-${index + 1}`);
  const manifest = {
    schemaVersion: 1,
    kind: 'tabs-settings-three-condition-content-freeze',
    status: 'frozen-non-executable-unapproved',
    createdAt: '2026-10-05T00:00:00.000Z',
    head: 'synthetic-not-a-git-head',
    newParticipantCalls: 0,
    executionPermission: false,
    preparationEnvironment: { node: 'synthetic', ciNodeBaseline: '22' },
    task: 'standalone-tabs-settings-modification-regression',
    model: { requestedAlias: 'synthetic-model', immutableSnapshot: null },
    wire: {
      stream: true,
      max_output_tokens: 8192,
      store: false,
      tools: [],
      tool_choice: 'none',
      omitted: ['temperature', 'top_p', 'reasoning', 'service_tier', 'seed'],
    },
    randomization: { seed: sha256('old seed'), algorithm: 'synthetic unbalanced parent schedule' },
    schedule: [1, 2, 3].flatMap((block) =>
      conditions.map((condition, index) => ({
        id: `block-${block}-${condition}`,
        block,
        position: index + 1,
        condition,
        requestSha256: packets[condition].request.sha256,
      }))
    ),
    packets,
    coreInventory: ids.map((id, i) => ({ id, claimIds: [`C${i + 1}`], layer: 'core' })),
    newFeatureCriteria: ids.slice(0, 6),
    regressionCriteria: ids.slice(6),
    metricQualification: 'Synthetic grouped checks; no statistical/model evidence',
    budgets: {
      participantDispatches: 9,
      reservations: 9,
      retries: 0,
      discovery: 0,
      participantWallMs: 180000,
      serialDispatchWindowMs: 1800000,
      rawResponseBytes: 4000000,
      deliverableBytes: 1000000,
      browserWallMs: 60000,
      referenceFeeUSD: 1,
      feeStatus: 'unconfirmed; not financial authorization',
    },
    closedGates: ['Paid execution not authorized by this fixture'],
    inventory,
  };
  // Intentionally noncompact parent bytes: these must survive byte-for-byte.
  const parentBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  await put(parentDirectory, 'manifest.json', parentBytes);
  return {
    root,
    parentDirectory,
    parentSha256: sha256(parentBytes),
    directory,
    seed,
    executionConfig,
    budgetPolicy,
    sourceRoot,
    parent: manifest,
    parentBytes,
  };
}
const inspect = (f, result) =>
  inspectNineRevision({
    directory: result.directory,
    manifestSha256: result.manifestSha256,
    sourceRoot: f.sourceRoot,
  });
async function rewriteManifest(result, change) {
  const manifest = JSON.parse(await readFile(path.join(result.directory, 'manifest.json')));
  await change(manifest);
  const bytes = jsonBytes(manifest);
  await writeFile(path.join(result.directory, 'manifest.json'), bytes);
  return { ...result, manifestSha256: sha256(bytes) };
}
async function rewriteParent(f, change) {
  await change(f.parent);
  const bytes = jsonBytes(f.parent);
  await writeFile(path.join(f.parentDirectory, 'manifest.json'), bytes);
  return { ...f, parentSha256: sha256(bytes) };
}

test('compact JSON bytes and SHA256 primitives', () => {
  assert.ok(Buffer.isBuffer(jsonBytes({ a: 1 })));
  assert.equal(jsonBytes({ a: 1 }).toString(), '{"a":1}');
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256(Buffer.from('abc')), sha256('abc'));
});

test('balanced amendment retains all parent bytes, invariants, gates and exact participant wire', async (t) => {
  const f = await fixture(t);
  const result = await prepareNineRevision(f);
  const observed = await inspect(f, result);
  assert.deepEqual(Object.keys(result).sort(), ['directory', 'manifest', 'manifestSha256']);
  assert.deepEqual(observed.manifest, result.manifest);
  assert.deepEqual(Object.keys(observed.packets).sort(), [...conditions].sort());
  assert.deepEqual(result.manifest.parent, descriptor('parent-manifest.json', f.parentBytes));
  assert.ok(
    (await readFile(path.join(result.directory, 'parent-manifest.json'))).equals(f.parentBytes)
  );
  assert.ok((await readFile(path.join(f.parentDirectory, 'manifest.json'))).equals(f.parentBytes));
  assert.deepEqual(
    result.manifest.inventory.slice(0, f.parent.inventory.length),
    f.parent.inventory
  );
  for (const item of f.parent.inventory) {
    const original = await readFile(path.join(f.parentDirectory, item.path));
    const retained = await readFile(path.join(result.directory, item.path));
    assert.ok(retained.equals(original), item.path);
  }
  for (const key of Object.keys(f.parent))
    if (!['schedule', 'randomization', 'inventory'].includes(key))
      assert.deepEqual(result.manifest[key], f.parent[key], key);
  assert.deepEqual(result.manifest.executionConfig, executionConfig);
  assert.deepEqual(result.manifest.budgetPolicy, budgetPolicy);
  assert.ok(
    (await readFile(path.join(result.directory, 'execution-config.json'))).equals(
      jsonBytes(executionConfig)
    )
  );
  assert.ok(
    (await readFile(path.join(result.directory, 'budget-policy.json'))).equals(
      jsonBytes(budgetPolicy)
    )
  );
  for (const source of requiredSources)
    assert.ok(result.manifest.inventory.some((item) => item.source === source));
  for (const condition of conditions) {
    const { packet, request, requestBytes } = observed.packets[condition];
    assert.ok(Buffer.isBuffer(requestBytes));
    assert.ok(requestBytes.equals(jsonBytes(request)));
    assert.deepEqual(
      request,
      participantRequest({ packet, model: 'synthetic-model', maxOutputTokens: 8192, stream: true })
    );
  }
  const schedule = result.manifest.schedule;
  assert.equal(schedule.length, 9);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(
      schedule
        .slice(i * 3, i * 3 + 3)
        .map((run) => run.condition)
        .sort(),
      [...conditions].sort()
    );
    assert.deepEqual(
      [0, 1, 2].map((row) => schedule[row * 3 + i].condition).sort(),
      [...conditions].sort()
    );
  }
  assert.deepEqual(
    observed.packets.none.packet.materials.map((m) => m.name),
    ['starting-code']
  );
  assert.notEqual(
    observed.packets.ordinary.packet.materials[1].sha256,
    observed.packets.proto.packet.materials[1].sha256
  );
});

test('seed replay is deterministic and candidates enumerate exactly twelve Latin squares', async (t) => {
  const f = await fixture(t);
  const first = await prepareNineRevision(f);
  const second = await prepareNineRevision({ ...f, directory: path.join(f.root, 'second') });
  assert.equal(first.manifestSha256, second.manifestSha256);
  const { randomization: r, schedule } = first.manifest;
  assert.equal(r.candidates.length, 12);
  assert.equal(new Set(r.candidates.map((square) => JSON.stringify(square))).size, 12);
  for (const square of r.candidates)
    for (let index = 0; index < 3; index++) {
      assert.deepEqual([...square[index]].sort(), [...conditions].sort());
      assert.deepEqual(square.map((row) => row[index]).sort(), [...conditions].sort());
    }
  const uint32 = createHash('sha256').update(`${seed}:${r.counter}`).digest().readUInt32BE(0);
  assert.equal(uint32, r.uint32);
  assert.ok(uint32 < 4294967292);
  assert.equal(r.selection, uint32 % 12);
  assert.deepEqual(
    schedule.slice(0, 3).map((slot) => slot.condition),
    r.candidates[r.selection][0]
  );
  assert.match(r.algorithm, /reject >=4294967292/);
});

test('invalid seeds and wrong trusted parent digests reject before destination creation', async (t) => {
  const f = await fixture(t);
  for (const invalid of ['random', seed.toUpperCase(), '0'.repeat(63), null])
    await assert.rejects(prepareNineRevision({ ...f, seed: invalid }), /Seed/);
  await assert.rejects(
    prepareNineRevision({ ...f, parentSha256: '0'.repeat(64) }),
    /Parent manifest digest mismatch/
  );
  await assert.rejects(access(f.directory), { code: 'ENOENT' });
});

test('exclusive destination refuses overwrite and rejects writes inside frozen parent', async (t) => {
  const f = await fixture(t);
  const result = await prepareNineRevision(f);
  const before = await readFile(path.join(result.directory, 'manifest.json'));
  await assert.rejects(prepareNineRevision(f), { code: 'EEXIST' });
  assert.ok((await readFile(path.join(result.directory, 'manifest.json'))).equals(before));
  await assert.rejects(
    prepareNineRevision({ ...f, directory: f.parentDirectory }),
    /outside frozen parent/
  );
  await assert.rejects(
    prepareNineRevision({ ...f, directory: path.join(f.parentDirectory, 'new') }),
    /outside frozen parent/
  );
});

test('inventory tamper, missing capture and manifest tamper fail against trusted digest', async (t) => {
  const f = await fixture(t);
  const result = await prepareNineRevision(f);
  const target = path.join(result.directory, f.parent.inventory[0].path);
  const bytes = await readFile(target);
  await writeFile(target, Buffer.alloc(bytes.length, 88));
  await assert.rejects(inspect(f, result), /Inventory hash drift/);
  await writeFile(target, bytes);
  await rm(target);
  await assert.rejects(inspect(f, result), { code: 'ENOENT' });
  await put(result.directory, f.parent.inventory[0].path, bytes);
  await writeFile(
    path.join(result.directory, 'manifest.json'),
    jsonBytes({ ...result.manifest, status: 'changed' })
  );
  await assert.rejects(inspect(f, result), /Amendment manifest digest mismatch/);
});

test('stored parent manifest bytes and parent hash binding are verified', async (t) => {
  const f = await fixture(t);
  const result = await prepareNineRevision(f);
  const changed = await rewriteManifest(result, (m) => {
    m.parent.sha256 = '0'.repeat(64);
  });
  await assert.rejects(inspect(f, changed), /Parent digest binding mismatch/);
  await writeFile(
    path.join(result.directory, 'parent-manifest.json'),
    Buffer.concat([f.parentBytes, Buffer.from(' ')])
  );
  await assert.rejects(inspect(f, result), /Amendment manifest digest mismatch/);
  // Restore trusted top-level bytes so the failure below measures parent inventory.
  await writeFile(path.join(result.directory, 'manifest.json'), jsonBytes(result.manifest));
  await assert.rejects(inspect(f, result), /Inventory size drift: parent-manifest/);
});

test('inspector rejects changed parent invariants even with a newly computed amendment digest', async (t) => {
  const f = await fixture(t);
  const result = await prepareNineRevision(f);
  const edits = [
    (m) => {
      m.budgets.participantDispatches = 10;
    },
    (m) => {
      m.coreInventory[0].claimIds = ['changed'];
    },
    (m) => {
      m.newFeatureCriteria.reverse();
    },
    (m) => {
      m.wire.max_output_tokens = 1;
    },
    (m) => {
      m.executionPermission = true;
    },
    (m) => {
      m.closedGates = [];
    },
    (m) => {
      m.extraUnbound = true;
    },
    (m) => {
      m.inventory.reverse();
    },
  ];
  for (const change of edits) {
    await writeFile(path.join(result.directory, 'manifest.json'), jsonBytes(result.manifest));
    const changed = await rewriteManifest(result, change);
    await assert.rejects(
      inspect(f, changed),
      /parent invariant drift|Unknown amendment fields|Parent inventory/
    );
  }
});

test('schedule cardinality, row/column balance, IDs, request hash and seed selection reject', async (t) => {
  const f = await fixture(t);
  const result = await prepareNineRevision(f);
  const edits = [
    [
      (m) => {
        m.schedule.pop();
      },
      /Exactly nine/,
    ],
    [
      (m) => {
        m.schedule[0].id = 'replacement';
      },
      /Schedule ID/,
    ],
    [
      (m) => {
        m.schedule[0].requestSha256 = '0'.repeat(64);
      },
      /Slot wire/,
    ],
    [
      (m) => {
        m.schedule = f.parent.schedule;
      },
      /Unbalanced schedule/,
    ],
    [
      (m) => {
        m.randomization.selection = (m.randomization.selection + 1) % 12;
      },
      /seed replay/,
    ],
    [
      (m) => {
        m.randomization.counter++;
      },
      /seed replay/,
    ],
    [
      (m) => {
        m.randomization.candidates.reverse();
      },
      /seed replay/,
    ],
  ];
  for (const [change, pattern] of edits) {
    await writeFile(path.join(result.directory, 'manifest.json'), jsonBytes(result.manifest));
    await assert.rejects(inspect(f, await rewriteManifest(result, change)), pattern);
  }
});

test('all parent and amendment source pins reject current source drift', async (t) => {
  const f = await fixture(t);
  const result = await prepareNineRevision(f);
  for (const source of [`${taskRoot}ordinary.md`, ...requiredSources]) {
    const target = path.join(f.sourceRoot, source);
    const bytes = await readFile(target);
    await writeFile(target, Buffer.alloc(bytes.length, 88));
    await assert.rejects(inspect(f, result), /Current source hash drift/);
    if (source === `${taskRoot}ordinary.md`)
      await assert.rejects(
        prepareNineRevision({ ...f, directory: path.join(f.root, 'inherited-drift') }),
        /Current source hash drift/
      );
    // A separate new revision may intentionally bind changed additional source
    // bytes; only inherited pins must also prevent preparation.
    await writeFile(target, bytes);
  }
});

test('additional sources bind bytes and hashes and reject traversal, absolutes and rebinding', async (t) => {
  const f = await fixture(t);
  const extra = 'scripts/benchmark/participant/synthetic-extra.mjs';
  await put(f.sourceRoot, extra, Buffer.from('// inert extra source\n'));
  const result = await prepareNineRevision({
    ...f,
    additionalSources: [...requiredSources, extra],
  });
  const item = result.manifest.inventory.find((e) => e.source === extra);
  assert.equal(item.sha256, sha256(await readFile(path.join(f.sourceRoot, extra))));
  await inspect(f, result);
  for (const source of [
    '../escape',
    '/absolute',
    'scripts/../escape',
    'scripts\\escape',
    'scripts//escape',
  ])
    await assert.rejects(
      prepareNineRevision({
        ...f,
        additionalSources: [source],
        directory: path.join(f.root, 'unsafe'),
      }),
      /Unsafe relative path/
    );
  await assert.rejects(
    prepareNineRevision({
      ...f,
      additionalSources: [`${taskRoot}task.md`],
      directory: path.join(f.root, 'rebind'),
    }),
    /Cannot rebind parent source/
  );
});

test('credential fields, secret strings, URL credentials and non-JSON config reject', async (t) => {
  const f = await fixture(t);
  const invalid = [
    { headers: { Authorization: 'Bearer test-secret' } },
    { api_key: 'hidden' },
    { nested: [{ password: 'hidden' }] },
    { value: 'Bearer arbitrary-secret' },
    { value: 'sk-testsecret123456' },
    { endpoint: 'https://user:password@example.test/v1' },
    { endpoint: 'https://example.test/v1?api_key=hidden' },
    { value: undefined },
    { value: Infinity },
    { value: new Date() },
  ];
  for (const config of invalid)
    for (const key of ['executionConfig', 'budgetPolicy'])
      await assert.rejects(
        prepareNineRevision({ ...f, [key]: config }),
        /Credential|credential|plain JSON|Non-finite|must be an object/
      );
  await assert.rejects(access(f.directory), { code: 'ENOENT' });
  const result = await prepareNineRevision(f);
  const changed = await rewriteManifest(result, (m) => {
    m.executionConfig.api_key = 'secret';
  });
  await assert.rejects(inspect(f, changed), /Credential field/);
});

test('config/budget contents and inventory cannot be omitted or modified independently', async (t) => {
  const f = await fixture(t);
  const result = await prepareNineRevision(f);
  for (const name of ['execution-config.json', 'budget-policy.json']) {
    const target = path.join(result.directory, name);
    const bytes = await readFile(target);
    await writeFile(target, Buffer.alloc(bytes.length, 88));
    await assert.rejects(inspect(f, result), /Inventory hash drift/);
    await writeFile(target, bytes);
  }
  const changed = await rewriteManifest(result, (m) => {
    m.budgetPolicy.status = 'changed';
  });
  await assert.rejects(inspect(f, changed), /config\/budget\/parent inventory/);
});

test('symlink roots, ancestors, inventory files and additional sources reject', async (t) => {
  const f = await fixture(t);
  const result = await prepareNineRevision(f);
  const alias = path.join(f.root, 'source-alias');
  await symlink(f.sourceRoot, alias);
  await assert.rejects(inspectNineRevision({ ...result, sourceRoot: alias }), /Unsafe directory/);
  const file = path.join(result.directory, f.parent.inventory[0].path);
  await rm(file);
  await symlink(path.join(f.sourceRoot, f.parent.inventory[0].source), file);
  await assert.rejects(inspect(f, result), /Unsafe file/);
  const extra = 'scripts/benchmark/participant/symlink-extra.mjs';
  await symlink(path.join(f.sourceRoot, requiredSources[0]), path.join(f.sourceRoot, extra));
  await assert.rejects(
    prepareNineRevision({
      ...f,
      directory: path.join(f.root, 'linked-extra'),
      additionalSources: [extra],
    }),
    /Unsafe file/
  );
  const parentAlias = path.join(f.root, 'parent-alias');
  await symlink(f.parentDirectory, parentAlias);
  await assert.rejects(
    prepareNineRevision({ ...f, parentDirectory: parentAlias }),
    /Unsafe directory/
  );
  const ancestor = path.join(f.root, 'ancestor-alias');
  await symlink(f.root, ancestor);
  await assert.rejects(
    prepareNineRevision({ ...f, directory: path.join(ancestor, 'nested') }),
    /Unsafe directory/
  );
});

test('parent inventory traversal and duplicate descriptors reject before copying', async (t) => {
  const f = await fixture(t);
  const escaped = await rewriteParent(f, (m) => {
    m.inventory[0].path = '../escape';
  });
  await assert.rejects(prepareNineRevision(escaped), /Unsafe relative path/);
  const f2 = await fixture(t);
  const duplicate = await rewriteParent(f2, (m) => {
    m.inventory.push(m.inventory[0]);
  });
  await assert.rejects(prepareNineRevision(duplicate), /Duplicate inventory path/);
});

test('parent no-doc and ordinary isolation is verified against source pins, not packet names', async (t) => {
  for (const condition of ['none', 'ordinary']) {
    const f = await fixture(t);
    const packet = JSON.parse(
      await readFile(path.join(f.parentDirectory, `packets/${condition}.json`))
    );
    const protoText = await readFile(path.join(f.sourceRoot, `${taskRoot}proto.md`), 'utf8');
    if (condition === 'none') packet.materials.push(material('documentation', protoText));
    else packet.materials[1] = material('documentation', protoText);
    const request = participantRequest({
      packet,
      model: 'synthetic-model',
      maxOutputTokens: 8192,
      stream: true,
    });
    const changed = await rewriteParent(f, async (m) => {
      for (const [kind, value] of Object.entries({ packet, request })) {
        const name = `${kind === 'packet' ? 'packets' : 'requests'}/${condition}.json`;
        const bytes = jsonBytes(value);
        const item = descriptor(name, bytes);
        await put(f.parentDirectory, name, bytes);
        m.inventory[m.inventory.findIndex((e) => e.path === name)] = item;
        m.packets[condition][kind] = item;
      }
      for (const slot of m.schedule)
        if (slot.condition === condition) slot.requestSha256 = m.packets[condition].request.sha256;
    });
    await assert.rejects(prepareNineRevision(changed), /Parent source isolation mismatch/);
  }
});

test('wire JSON must match reconstructed participantRequest exact bytes, not just parsed values', async (t) => {
  const f = await fixture(t);
  const changed = await rewriteParent(f, async (m) => {
    const name = m.packets.none.request.path;
    const request = JSON.parse(await readFile(path.join(f.parentDirectory, name)));
    const bytes = Buffer.from(JSON.stringify(request, null, 2));
    const item = descriptor(name, bytes);
    await put(f.parentDirectory, name, bytes);
    m.inventory[m.inventory.findIndex((e) => e.path === name)] = item;
    m.packets.none.request = item;
    for (const slot of m.schedule) if (slot.condition === 'none') slot.requestSha256 = item.sha256;
  });
  await assert.rejects(prepareNineRevision(changed), /Wire exact bytes mismatch/);
});

test('missing required runner source and malformed core15/6+9 prevent preparation', async (t) => {
  const f = await fixture(t);
  await rm(path.join(f.sourceRoot, requiredSources[2]));
  await assert.rejects(prepareNineRevision(f), { code: 'ENOENT' });
  await assert.rejects(access(f.directory), { code: 'ENOENT' });
  const f2 = await fixture(t);
  await assert.rejects(
    prepareNineRevision(
      await rewriteParent(f2, (m) => {
        m.newFeatureCriteria.pop();
      })
    )
  );
});

test('parent runner config and fee-risk policy remain flexible, typed, nonsecret and non-admitting', async (t) => {
  const f = await fixture(t);
  const config = {
    endpoint: 'http://127.0.0.1:9876/v1/responses',
    providerName: 'synthetic-proxy',
    upstreamBaseUrl: 'https://synthetic-upstream.example.test/v1',
    routeFingerprint: sha256('synthetic route'),
    chromiumPath: '/synthetic/chrome',
    allowLoopbackHttp: true,
    proxyMaxRetries: 3,
    futureNonsecretMetadata: { status: 'unknown' },
  };
  const budget = {
    admission: 'awaiting-user-fee-decision',
    referenceEnvelopeUSD: 1,
    referenceEnvelopeIsNotHardCap: true,
    actualBillingUSD: null,
    feeRiskDisclosure: {
      localModelPrice: null,
      dailyCap: null,
      monthlyCap: null,
      proxyMaxRetries: 3,
      disclaimer: 'Reference estimate only; no enforceable financial cap',
    },
  };
  const result = await prepareNineRevision({ ...f, executionConfig: config, budgetPolicy: budget });
  const observed = await inspect(f, result);
  assert.deepEqual(observed.manifest.executionConfig, config);
  assert.deepEqual(observed.manifest.budgetPolicy, budget);
  assert.deepEqual(observed.manifest.budgets, f.parent.budgets);
  assert.equal(observed.manifest.executionPermission, false);
  assert.equal(observed.manifest.newParticipantCalls, 0);
  const minimal = await prepareNineRevision({
    ...f,
    directory: path.join(f.root, 'minimal-config'),
    executionConfig: {
      endpoint: config.endpoint,
      routeFingerprint: config.routeFingerprint,
      chromiumPath: config.chromiumPath,
    },
    budgetPolicy: {
      admission: 'blocked-until-user-fee-decision',
      referenceEnvelopeUSD: 1,
      referenceEnvelopeIsNotHardCap: true,
      actualBillingUSD: null,
    },
  });
  await inspect(f, minimal);
  for (const change of [
    { endpoint: 1 },
    { providerName: false },
    { routeFingerprint: null },
    { chromiumPath: [] },
    { allowLoopbackHttp: 'true' },
    { proxyMaxRetries: -1 },
    { proxyMaxRetries: 1.5 },
    { upstreamBaseUrl: 'file:///path' },
  ])
    await assert.rejects(
      prepareNineRevision({ ...f, executionConfig: { ...config, ...change } }),
      /Invalid config/
    );
  for (const change of [
    { admission: false },
    { referenceEnvelopeUSD: '1' },
    { referenceEnvelopeUSD: -1 },
    { referenceEnvelopeIsNotHardCap: false },
    { actualBillingUSD: 0 },
    { feeRiskDisclosure: [] },
  ])
    await assert.rejects(
      prepareNineRevision({ ...f, budgetPolicy: { ...budget, ...change } }),
      /Invalid|not a hard cap|does not establish actual billing|must be an object/
    );
});
