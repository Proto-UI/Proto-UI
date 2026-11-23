// Independent receipt rules. This module imports neither the renderer nor the
// snapshot owner; full native readbacks are its input, never their assertions.
export const PROTOCOL = 'pui-liquid-owned-canvas-transport-1';
export const DPRS = Object.freeze([1, 1.5, 2]);
export const GEOMETRY = Object.freeze({ width: 143.25, height: 38, radius: 19, paintOutset: 13 });
export const SOURCE = Object.freeze({ width: 416, height: 172, left: 32, top: 32 });
export const PIXEL_CASES = Object.freeze(
  DPRS.flatMap((dpr) =>
    ['light', 'dark'].flatMap((theme) =>
      ['neutral-regular', 'neutral-clear', 'style-tint'].flatMap((profile) =>
        ['rest', 'contact'].flatMap((state) =>
          ['before', 'after'].map((order) =>
            Object.freeze({
              id: `pixels-dpr${String(dpr).replace('.', 'p')}-${theme}-${profile}-${state}-${order}`,
              dpr,
              theme,
              profile,
              state,
              order,
            })
          )
        )
      )
    )
  )
);
export const STAGE_CASES = Object.freeze(
  ['static', 'dynamic', 'dynamic', 'static', 'static', 'dynamic'].flatMap((workload, block) =>
    Array.from({ length: 20 }, (_, sample) =>
      Object.freeze({
        id: `stage-${workload}-b${block}-s${String(sample).padStart(2, '0')}`,
        workload,
        block,
        sample,
        order: sample % 2 === 0 ? 'before' : 'after',
        dpr: 1,
      })
    )
  )
);
export const LIFETIME_REQUIREMENTS = Object.freeze({
  'shared-producer-a-b-a': {
    aRetainedAfterB: true,
    bDifferent: true,
    aOldRetired: true,
    bRetainedAfterA: true,
  },
  'source-supersession': { readable: false, live: 0 },
  'geometry-supersession': { readable: false, live: 0 },
  'alternating-physical-sizes': {
    sizes: 3,
    exactDimensions: true,
    oldReadable: false,
    peakLive: 2,
  },
  'context-dpr-refusal-recovery': {
    actualDpr: 1,
    wrongRefused: true,
    correctAccepted: true,
    wrongAllocations: 0,
  },
  'stale-owner-before-copy': { refused: true, allocations: 0 },
  'invalidate-retire': { readable: false, live: 0 },
  'dispose-no-successor': { readable: false, successorRefused: true, live: 0 },
  'detach': { detachedReadable: false, reattachedReadable: false, live: 0 },
  'adopt': { differentDocument: true, readable: false, live: 0 },
  'same-revision-producer-reentry': {
    refused: true,
    sameSourceRevision: true,
    epochAdvanced: true,
    live: 0,
  },
  'failed-render-epoch': { refused: true, failedAttempt: true, epochAdvanced: true, live: 0 },
  'returned-buffer-isolation': { retainedUnchanged: true, otherConsumerUnchanged: true },
  'cancel-reference-decode': {
    readyCallbacks: 0,
    failureCallbacks: 0,
    cancellations: 1,
    pending: 0,
    decoded: 0,
  },
  'allocation-dispose': { refused: true, created: 1, retired: 1, live: 0, physicalRetired: true },
  'same-owner-capture-reentry': { refused: true, innerRefused: true, peakLive: 1, live: 0 },
  'invalid-source-no-copy': {
    rejected: true,
    encoderCalls: 0,
    copyCalls: 0,
    error: 'nonopaque-optical-source',
  },
  'unsafe-contrast-no-copy': {
    rejected: true,
    encoderCalls: 0,
    copyCalls: 0,
    error: 'rendered-contrast-unsafe',
  },
  'source-document-refusal': {
    refused: true,
    allocations: 0,
    error: 'snapshot-producer-document-mismatch',
  },
  'producer-context-loss-rejection': {
    contextLost: true,
    rejected: true,
    encoderCalls: 0,
    copyCalls: 0,
    readable: false,
  },
});
export const CONTROL_IDS = Object.freeze([
  'one-rgb-byte',
  'one-alpha-byte',
  'wrong-source',
  'wrong-dimensions',
  'opaque-substitute',
  'borrowed-producer',
]);
export const PLAN = Object.freeze({
  protocol: PROTOCOL,
  pixels: PIXEL_CASES,
  stages: STAGE_CASES,
  lifetime: Object.keys(LIFETIME_REQUIREMENTS),
  controls: CONTROL_IDS,
});

export function comparePlanes(a, b) {
  const valid = (value) =>
    Number.isSafeInteger(value?.width) &&
    Number.isSafeInteger(value?.height) &&
    value.width > 0 &&
    value.height > 0 &&
    value.width <= 2048 &&
    value.height <= 2048 &&
    value.width * value.height <= 1048576 &&
    ArrayBuffer.isView(value.pixels) &&
    value.pixels.BYTES_PER_ELEMENT === 1 &&
    value.pixels.length === value.width * value.height * 4;
  if (!valid(a) || !valid(b)) return { equal: false, reason: 'malformed-full-plane' };
  if (a.width !== b.width || a.height !== b.height)
    return { equal: false, reason: 'physical-dimensions' };
  let mismatchedBytes = 0,
    mismatchedPixels = 0;
  const maxChannelDifference = [0, 0, 0, 0],
    firstDifferences = [];
  for (let pixel = 0; pixel < a.pixels.length; pixel += 4) {
    let changed = false;
    for (let channel = 0; channel < 4; channel++) {
      const at = pixel + channel,
        difference = Math.abs(a.pixels[at] - b.pixels[at]);
      if (difference) {
        mismatchedBytes++;
        changed = true;
        maxChannelDifference[channel] = Math.max(maxChannelDifference[channel], difference);
        if (firstDifferences.length < 8)
          firstDifferences.push({ byte: at, a: a.pixels[at], b: b.pixels[at] });
      }
    }
    if (changed) mismatchedPixels++;
  }
  const alpha = { transparent: 0, partial: 0, opaque: 0 };
  for (let at = 3; at < a.pixels.length; at += 4) {
    if (a.pixels[at] === 0) alpha.transparent++;
    else if (a.pixels[at] === 255) alpha.opaque++;
    else alpha.partial++;
  }
  return {
    equal: mismatchedBytes === 0,
    reason: mismatchedBytes ? 'exact-rgba-mismatch' : null,
    pixels: a.width * a.height,
    mismatchedBytes,
    mismatchedPixels,
    maxChannelDifference,
    firstDifferences,
    alpha,
  };
}

export function auditInventory(actual, expected, label) {
  const problems = [],
    seen = new Set(),
    expectedIds = new Set(expected.map((row) => (typeof row === 'string' ? row : row.id)));
  for (const row of actual) {
    if (!row || typeof row.id !== 'string') {
      problems.push(`${label}: malformed row`);
      continue;
    }
    if (!expectedIds.has(row.id)) problems.push(`${label}: unknown ${row.id}`);
    if (seen.has(row.id)) problems.push(`${label}: duplicate ${row.id}`);
    seen.add(row.id);
    if (!['ok', 'failed', 'unattempted'].includes(row.status))
      problems.push(`${label}: invalid status ${row.id}`);
  }
  for (const id of expectedIds) if (!seen.has(id)) problems.push(`${label}: missing ${id}`);
  return {
    planned: expected.length,
    recorded: actual.length,
    attempted: actual.filter((row) => row.status === 'ok' || row.status === 'failed').length,
    completed: actual.filter((row) => row.status === 'ok').length,
    failed: actual.filter((row) => row.status === 'failed').length,
    unattempted:
      expected.length -
      actual.filter((row) => expectedIds.has(row.id) && row.status !== 'unattempted').length,
    problems,
  };
}

function distribution(values) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  const q = (p) => {
    if (!ordered.length) return null;
    const position = (ordered.length - 1) * p,
      lower = Math.floor(position),
      fraction = position - lower;
    return ordered[lower] + ((ordered[lower + 1] ?? ordered[lower]) - ordered[lower]) * fraction;
  };
  return {
    samples: ordered.length,
    p50: q(0.5),
    p95: q(0.95),
    max: ordered.at(-1) ?? null,
    over10: ordered.filter((value) => value > 10).length,
  };
}

export async function analyzeReceipt(report, readPlane) {
  const failures = [],
    checks = [];
  const check = (id, accepted, detail) => {
    checks.push({ id, accepted: accepted === true, ...(detail === undefined ? {} : { detail }) });
    if (accepted !== true) failures.push({ id, detail });
  };
  check('protocol', report.protocol === PROTOCOL);
  const fullGitId = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
  check(
    'source-bound-native',
    [
      report.source?.expectedSha,
      report.source?.start?.sha,
      report.source?.end?.sha,
      report.source?.start?.tree,
      report.source?.end?.tree,
    ].every(fullGitId) &&
      report.source?.expectedSha === report.source?.start?.sha &&
      report.source?.start?.sha === report.source?.end?.sha &&
      report.source?.start?.tree === report.source?.end?.tree &&
      report.source?.start?.status === '' &&
      report.source?.end?.status === '' &&
      report.source?.closureStable === true &&
      report.source?.headBound === true
  );
  check(
    'browser-observed',
    typeof report.environment?.browser === 'string' &&
      report.environment.browser.trim().length > 0 &&
      !!report.environment?.gpu
  );
  check(
    'collection-errors',
    Array.isArray(report.failures) && report.failures.length === 0,
    report.failures
  );
  const contexts = report.contexts ?? [];
  check(
    'context-inventory',
    contexts.length === DPRS.length &&
      DPRS.every((dpr) => contexts.filter((context) => context.dpr === dpr).length === 1)
  );
  for (const context of contexts) {
    check(
      `context-dpr-${context.dpr}`,
      context.environment?.devicePixelRatio === context.dpr &&
        context.environment?.secureContext === true
    );
    check(
      `context-errors-${context.dpr}`,
      Array.isArray(context.errors) && context.errors.length === 0,
      context.errors
    );
    check(
      `context-order-${context.dpr}`,
      JSON.stringify(context.pixels?.map((row) => row.id)) ===
        JSON.stringify(PIXEL_CASES.filter((row) => row.dpr === context.dpr).map((row) => row.id))
    );
    for (const boundary of ['immediate', 'afterTwoRaf']) {
      const cleanup = context.cleanup?.[boundary];
      check(
        `cleanup-${context.dpr}-${boundary}`,
        !!cleanup &&
          cleanup.ownersLive === 0 &&
          cleanup.ownersBytes === 0 &&
          cleanup.ownerCleanupFailures === 0 &&
          cleanup.ownedPhysicalCanvases === 0 &&
          cleanup.oracleCanvases === 0 &&
          cleanup.oracleImages === 0 &&
          cleanup.sourceCanvases === 0 &&
          cleanup.pendingImages === 0 &&
          cleanup.decodedImages === 0 &&
          cleanup.producerWidth === 0 &&
          cleanup.producerHeight === 0 &&
          cleanup.glLive === 0 &&
          cleanup.glDoubleDeletes === 0 &&
          cleanup.preparedEntries === 0 &&
          cleanup.preparedBytes === 0 &&
          cleanup.encoderRestored === true &&
          Array.isArray(cleanup.ownerCounters) &&
          cleanup.ownerCounters.every(
            (row) =>
              row.created === row.retired && row.peakLive <= 2 && row.peakBytes <= 8 * 1024 * 1024
          ),
        cleanup
      );
    }
    check(
      `cleanup-raf-${context.dpr}`,
      context.cleanup?.rafTimestamps?.length === 2 &&
        context.cleanup.rafTimestamps[1] > context.cleanup.rafTimestamps[0]
    );
  }
  const rows = Object.fromEntries(
    ['pixels', 'stages', 'lifetime', 'controls'].map((key) => [
      key,
      contexts.flatMap((context) => context[key] ?? []),
    ])
  );
  const inventory = {
    pixels: auditInventory(rows.pixels, PIXEL_CASES, 'pixels'),
    stages: auditInventory(rows.stages, STAGE_CASES, 'stages'),
    lifetime: auditInventory(rows.lifetime, Object.keys(LIFETIME_REQUIREMENTS), 'lifetime'),
    controls: auditInventory(rows.controls, CONTROL_IDS, 'controls'),
  };
  for (const [key, value] of Object.entries(inventory)) {
    check(
      `${key}-denominator`,
      value.problems.length === 0 && value.unattempted === 0 && value.failed === 0,
      value
    );
  }
  check(
    'stage-order',
    JSON.stringify(rows.stages.map((row) => row.id)) ===
      JSON.stringify(STAGE_CASES.map((row) => row.id))
  );
  const compare = async (row, a, b, tag) => {
    try {
      const result = comparePlanes(
        await readPlane(row.planes?.[a]),
        await readPlane(row.planes?.[b])
      );
      check(`${row.id}/${tag}`, result.equal, result);
      return result;
    } catch (error) {
      check(`${row.id}/${tag}`, false, String(error));
      return null;
    }
  };
  const pixelResults = [];
  for (const expected of PIXEL_CASES) {
    const row = rows.pixels.find((row) => row.id === expected.id);
    if (!row || row.status !== 'ok') continue;
    check(
      `${row.id}/facts`,
      Object.entries(expected).every(([key, value]) => row[key] === value)
    );
    const width = Math.ceil((GEOMETRY.width + 2 * GEOMETRY.paintOutset) * expected.dpr),
      height = Math.ceil((GEOMETRY.height + 2 * GEOMETRY.paintOutset) * expected.dpr);
    check(
      `${row.id}/dimensions`,
      row.width === width &&
        row.height === height &&
        row.geometry?.width === GEOMETRY.width &&
        row.geometry?.height === GEOMETRY.height &&
        row.geometry?.dpr === expected.dpr &&
        row.targetRect?.width === GEOMETRY.width &&
        row.targetRect?.height === GEOMETRY.height
    );
    check(
      `${row.id}/full-plane-dimensions`,
      [
        'candidateRaw',
        'referenceRaw',
        'candidateBlack',
        'referenceBlack',
        'candidateWhite',
        'referenceWhite',
      ].every(
        (name) => row.planes?.[name]?.width === width && row.planes?.[name]?.height === height
      )
    );
    check(
      `${row.id}/actual-encoder`,
      row.encoderCalls === 1 &&
        row.copyCalls === 1 &&
        row.encoderReturnMatchesProgram === true &&
        JSON.stringify(row.encoderArguments) === '["image/png"]'
    );
    check(
      `${row.id}/context-color`,
      row.copyContext?.alpha === true &&
        row.copyContext?.colorSpace === 'srgb' &&
        row.oracleContext?.alpha === true &&
        row.oracleContext?.colorSpace === 'srgb'
    );
    const raw = await compare(row, 'candidateRaw', 'referenceRaw', 'rgba');
    const black = await compare(row, 'candidateBlack', 'referenceBlack', 'over-black');
    const white = await compare(row, 'candidateWhite', 'referenceWhite', 'over-white');
    check(
      `${row.id}/nontrivial-alpha`,
      !!raw && raw.alpha?.transparent > 0 && raw.alpha?.partial > 0 && raw.alpha?.opaque > 0,
      raw?.alpha
    );
    pixelResults.push({ id: row.id, raw, black, white });
  }
  for (const row of rows.lifetime) {
    if (row.status !== 'ok') continue;
    const expected = LIFETIME_REQUIREMENTS[row.id];
    if (expected)
      for (const [key, value] of Object.entries(expected))
        check(`${row.id}/${key}`, row.actual?.[key] === value, row.actual?.[key]);
    if (['shared-producer-a-b-a', 'returned-buffer-isolation'].includes(row.id)) {
      await compare(row, 'aOriginal', 'aAfter', 'a-independent-retained-plane');
      await compare(row, 'bOriginal', 'bAfter', 'b-independent-retained-plane');
    }
  }
  for (const row of rows.controls) {
    if (row.status !== 'ok') continue;
    try {
      const result = comparePlanes(
        await readPlane(row.planes?.candidate),
        await readPlane(row.planes?.reference)
      );
      check(`${row.id}/independent-rejection`, result.equal === false, result);
    } catch (error) {
      check(`${row.id}/control-readable`, false, String(error));
    }
  }
  const stageResults = [];
  for (const expected of STAGE_CASES) {
    const row = rows.stages.find((row) => row.id === expected.id);
    if (!row || row.status !== 'ok') continue;
    check(
      `${row.id}/facts`,
      Object.entries(expected).every(([key, value]) => row[key] === value)
    );
    const t = row.timestamps ?? {};
    const points = [
      'renderStart',
      'renderEnd',
      'copyStart',
      'copySubmitted',
      'copyReadbackEnd',
      'encodeStart',
      'encodeEnd',
      'decodeStart',
      'decodeReady',
      'callbackStart',
      'callbackEnd',
    ];
    const timingValid =
      points.every((key) => Number.isFinite(t[key]) && t[key] >= 0) &&
      t.renderStart <= t.copyStart &&
      t.copyStart <= t.copySubmitted &&
      t.copySubmitted <= t.copyReadbackEnd &&
      t.encodeStart <= t.encodeEnd &&
      t.renderEnd <= t.decodeStart &&
      t.decodeStart <= t.decodeReady &&
      t.callbackStart === t.decodeReady &&
      t.callbackStart <= t.callbackEnd &&
      (expected.order === 'before'
        ? t.copyReadbackEnd <= t.encodeStart
        : t.encodeEnd <= t.copyStart) &&
      Math.max(t.copyReadbackEnd, t.encodeEnd) <= t.renderEnd;
    check(`${row.id}/timings`, timingValid, t);
    const c = row.imageCounters ?? {},
      p = row.programCounters ?? {};
    const width = Math.ceil(GEOMETRY.width + 2 * GEOMETRY.paintOutset),
      height = Math.ceil(GEOMETRY.height + 2 * GEOMETRY.paintOutset);
    check(
      `${row.id}/full-plane-dimensions`,
      row.width === width &&
        row.height === height &&
        ['candidateRaw', 'referenceRaw'].every(
          (name) => row.planes?.[name]?.width === width && row.planes?.[name]?.height === height
        )
    );
    check(
      `${row.id}/complete-work`,
      row.encoderCalls === 1 &&
        row.copyCalls === 1 &&
        row.encoderReturnMatchesProgram === true &&
        JSON.stringify(row.encoderArguments) === '["image/png"]' &&
        p.renders === 1 &&
        c.imagePreparations === 1 &&
        c.imageDecodes === 1 &&
        c.imageReadyCallbacks === 1 &&
        c.imageDecodeFailures === 0 &&
        c.imageDecodeCancellations === 0 &&
        c.imageReadyCallbackFailures === 0 &&
        c.imageReuseHits === 0
    );
    const raw = await compare(row, 'candidateRaw', 'referenceRaw', 'rgba');
    if (timingValid)
      stageResults.push({
        id: row.id,
        workload: row.workload,
        block: row.block,
        sample: row.sample,
        order: row.order,
        fidelity: raw?.equal === true,
        observedRenderMs: t.renderEnd - t.renderStart,
        ownedCaptureSubmitMs: t.copySubmitted - t.copyStart,
        copyReadyMs: t.copyReadbackEnd - t.copyStart,
        encodeMs: t.encodeEnd - t.encodeStart,
        decodeWallMs: t.decodeReady - t.decodeStart,
        encodePlusDecodeMs: t.encodeEnd - t.encodeStart + t.decodeReady - t.decodeStart,
        callbackMs: t.callbackEnd - t.callbackStart,
        pngSha256: row.pngSha256,
        sourceRevision: row.sourceRevision,
      });
  }
  const dynamic = stageResults.filter((row) => row.workload === 'dynamic'),
    statics = stageResults.filter((row) => row.workload === 'static');
  check(
    'dynamic-actual-output-progress',
    dynamic.length === 60 &&
      new Set(dynamic.map((row) => row.pngSha256)).size === 60 &&
      new Set(dynamic.map((row) => row.sourceRevision)).size === 60
  );
  check(
    'static-fixed-source-output',
    statics.length === 60 &&
      new Set(statics.map((row) => row.pngSha256)).size === 1 &&
      new Set(statics.map((row) => row.sourceRevision)).size === 1
  );
  const metrics = [
    'observedRenderMs',
    'ownedCaptureSubmitMs',
    'copyReadyMs',
    'encodeMs',
    'decodeWallMs',
    'encodePlusDecodeMs',
    'callbackMs',
  ];
  const groups = [];
  for (const workload of ['static', 'dynamic'])
    for (const order of ['both', 'before', 'after']) {
      const selected = stageResults.filter(
        (row) => row.workload === workload && (order === 'both' || row.order === order)
      );
      groups.push({
        workload,
        order,
        metrics: Object.fromEntries(
          metrics.map((metric) => [metric, distribution(selected.map((row) => row[metric]))])
        ),
      });
    }
  const blocks = Array.from({ length: 6 }, (_, block) => ({
    block,
    metrics: Object.fromEntries(
      metrics.map((metric) => [
        metric,
        distribution(stageResults.filter((row) => row.block === block).map((row) => row[metric])),
      ])
    ),
  }));
  return {
    protocol: PROTOCOL,
    accepted: failures.length === 0,
    productBudget: 'not-evaluated',
    inventory,
    checks,
    failures,
    pixelResults,
    stageResults,
    groups,
    blocks,
    allOver10: stageResults.filter((row) => metrics.some((metric) => row[metric] > 10)),
    interpretation:
      'Same-render serial observations on the recorded native renderer. Neither stage subtraction nor this primitive inventory establishes product latency, presentation, or a production carrier.',
  };
}
