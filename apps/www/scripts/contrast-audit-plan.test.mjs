import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import {
  parseContrastRuntimeOptions,
  contrastHeldBinaryTargets,
  assertContrastCaseCoverage,
  classifyFlatTabPaint,
  establishNativeItemPointerBaseline,
  discoverContrastSources,
} from './contrast-audit-plan.mjs';

const official = ['wc', 'react', 'vue', 'vue2'];
test('page-specific runtime planning keeps three-runtime Tooltip separate from four-runtime pages', () => {
  const tooltip = parseContrastRuntimeOptions('["wc","react","vue"]', official);
  assert.deepEqual(tooltip, official.slice(0, 3));
  assert.equal(tooltip.includes('vue2'), false);
  assert.deepEqual(parseContrastRuntimeOptions(JSON.stringify(official), official), official);
});
test('missing, invalid, duplicate and unsupported runtime availability fail closed', () => {
  for (const value of [null, '', 'null', '[]', '{}', '["wc","wc"]', '["native"]', '[1]'])
    assert.throws(() => parseContrastRuntimeOptions(value, official), /runtime/);
});
test('non-default Switch and all authored checked/mixed Checkbox controls receive held journeys', () => {
  assert.deepEqual(contrastHeldBinaryTargets('switch'), [
    { ref: 'releaseAlertsSwitch', state: 'checked', ariaChecked: 'true' },
  ]);
  assert.deepEqual(contrastHeldBinaryTargets('checkbox'), [
    { ref: 'checkedCheckbox', state: 'checked', ariaChecked: 'true' },
    { ref: 'mixedCheckbox', state: 'mixed', ariaChecked: 'mixed' },
    { ref: 'checkedIndeterminateCheckbox', state: 'checked-indeterminate', ariaChecked: 'mixed' },
  ]);
  assert.deepEqual(contrastHeldBinaryTargets('button'), []);
});
test('native evidence workflow has no path exclusions for rendered inputs', async () => {
  const workflow = parse(
    await readFile(
      new URL('../../../.github/workflows/brutalist-contrast-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
  assert.equal(workflow.on.pull_request?.paths, undefined);
  assert.equal(workflow.on.pull_request?.['paths-ignore'], undefined);
  assert.equal(workflow.on.workflow_dispatch, undefined);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
});

test('held journey references cover the real authored enabled non-default binary states', async () => {
  for (const family of ['switch', 'checkbox']) {
    const { default: demo } = await import(
      `../src/content/docs/zh-cn/demo-brutalist-${family}.demo.ts`
    );
    const authored = [];
    const visit = (node) => {
      if (!node || typeof node === 'string') return;
      if (
        node.kind === 'proto' &&
        node.prototypeId === `brutalist-${family}-root` &&
        !node.props?.disabled &&
        (node.props?.defaultChecked || node.props?.defaultIndeterminate)
      )
        authored.push({
          ref: node.ref,
          ariaChecked: node.props.defaultIndeterminate ? 'mixed' : 'true',
        });
      for (const child of node.children ?? []) visit(child);
    };
    visit(demo.root);
    assert.deepEqual(
      contrastHeldBinaryTargets(family).map(({ ref, ariaChecked }) => ({ ref, ariaChecked })),
      authored
    );
  }
});

test('unsupported runtime availability cannot become zero-case success for a requested family', () => {
  assert.throws(() => parseContrastRuntimeOptions('["native"]', official), /runtime/);
  assert.throws(() => parseContrastRuntimeOptions('[]', official), /runtime/);
  assert.throws(() => assertContrastCaseCoverage(['tooltip'], []), /empty evidence/);
  assert.throws(
    () => assertContrastCaseCoverage(['tooltip', 'switch'], [{ family: 'switch' }]),
    /requested family/
  );
  assert.doesNotThrow(() =>
    assertContrastCaseCoverage(
      ['tooltip'],
      [{ family: 'tooltip', runtime: 'undiscovered', status: 'failed' }]
    )
  );
});

test('normal PR evidence shards cover every current manifest family exactly once', async () => {
  const { PROJECTION_FAMILY_MANIFESTS } =
    await import('../src/components/PrototypePreviewer/projection-families.ts');
  const workflow = parse(
    await readFile(
      new URL('../../../.github/workflows/brutalist-contrast-evidence.yml', import.meta.url),
      'utf8'
    )
  );
  const job = workflow.jobs['family-audit-evidence'];
  const rows = job.strategy.matrix.include;
  const families = rows.flatMap((row) => row.families.split(','));
  assert.equal(new Set(families).size, families.length);
  assert.deepEqual(
    [...families].sort(),
    Object.keys(PROJECTION_FAMILY_MANIFESTS.brutalist.families).sort()
  );
  assert.equal(job.strategy['fail-fast'], false);
  assert.equal(job.strategy['max-parallel'], 2);
  const observe = job.steps.find((step) => step.env?.PROTO_UI_CONTRAST_FAMILIES);
  assert.equal(observe.env.PROTO_UI_CONTRAST_FAMILIES, '${{ matrix.families }}');
  const upload = job.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
  assert.ok(upload.with.name.includes('${{ matrix.shard }}'));
  assert.equal(upload.if, 'always()');
});

test('current flat Tabs accept the recorded native focus rings and reject legacy elevation or motion', () => {
  // Captured f8894c3c / run37237502096 / tabs-react-light-keyboard-selection-overview.
  // This literal is replayed source evidence, not a new native observation.
  const recorded = {
    shadow:
      'rgb(220, 235, 254) 0px 0px 0px 2px, rgb(0, 0, 0) 0px 0px 0px 4px, rgba(0, 0, 0, 0) 0px 0px 0px 0px',
    transform: 'none',
    translate: 'none',
  };
  assert.equal(classifyFlatTabPaint(recorded).flatPaint, true);
  assert.equal(classifyFlatTabPaint({ ...recorded, shadow: 'none' }).flatPaint, true);
  for (const shadow of [
    'rgb(0, 0, 0) 3px 3px 0px 0px',
    'rgb(0, 0, 0) 0px 0px 3px 0px',
    'rgb(0, 0, 0) 0px 0px 0px 2px inset',
    'malformed',
  ])
    assert.equal(classifyFlatTabPaint({ ...recorded, shadow }).flatPaint, false, shadow);
  for (const transform of ['matrix(1, 0, 0, 1, 1, 0)', 'matrix(2, 0, 0, 2, 0, 0)', 'rotate(2deg)'])
    assert.equal(classifyFlatTabPaint({ ...recorded, transform }).flatPaint, false, transform);
  assert.equal(classifyFlatTabPaint({ ...recorded, translate: '1px 0px' }).flatPaint, false);
  assert.equal(
    classifyFlatTabPaint({
      ...recorded,
      transform: 'matrix(1, 0, 0, 1, 0, 0)',
      translate: '0px 0px',
    }).flatPaint,
    true
  );
});

test('Tabs held audit follows current flat prototype criteria while retaining native state and pair guards', async () => {
  const spec = parse(
    await readFile(
      new URL('../../../spec/prototypes/P-BRUTALIST-TABS-TRIGGER.yaml', import.meta.url),
      'utf8'
    )
  );
  assert.equal(spec.status, 'draft');
  assert.match(
    spec.criteria.find((criterion) => criterion.id.endsWith('SELECTED-PAIR-INVARIANT')).text.en,
    /Selection never adds elevation/
  );
  const runner = await readFile(new URL('./audit-brutalist-contrast.mts', import.meta.url), 'utf8');
  assert.ok(runner.includes('classifyFlatTabPaint(value)'));
  assert.ok(runner.includes('held.nativeActive === true'));
  assert.ok(runner.includes('sameSelectedPair(held)'));
  assert.ok(runner.includes('held.flatPaint === true'));
  assert.ok(!runner.includes('selectedElevation'));
});

test('native item baseline waits for deferred entry and exact other focus before reading the target', async () => {
  // Explicit injected readiness ordering; not a browser execution claim.
  const calls = [];
  let ready = false;
  let otherFocused = false;
  let releaseEntry;
  let releaseOther;
  const entry = new Promise((resolve) => {
    releaseEntry = () => {
      ready = true;
      resolve();
    };
  });
  const other = new Promise((resolve) => {
    releaseOther = () => {
      otherFocused = true;
      resolve();
    };
  });
  const before = { achieved: true, focused: false, hovered: false, ariaSelected: 'true' };
  const result = establishNativeItemPointerBaseline({
    waitForPaint: async () => {
      calls.push('paint-settled');
    },
    waitForEntry: async () => {
      calls.push('entry');
      await entry;
    },
    pressEdge: async () => {
      assert.equal(ready, true);
      calls.push('native-End');
    },
    waitForOther: async () => {
      calls.push('other');
      await other;
    },
    readTarget: async () => {
      assert.equal(otherFocused, true);
      calls.push('read');
      return before;
    },
    expectedSelection: 'true',
    identity: 'selected',
  });
  assert.deepEqual(calls, ['paint-settled']);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['paint-settled', 'entry']);
  releaseEntry();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['paint-settled', 'entry', 'native-End', 'other']);
  releaseOther();
  assert.equal(await result, before);
  assert.deepEqual(calls, ['paint-settled', 'entry', 'native-End', 'other', 'read']);
});

test('native item baseline preserves absent-focus and strict target-state failures', async () => {
  const valid = { achieved: true, focused: false, hovered: false, ariaSelected: 'true' };
  const common = {
    waitForPaint: async () => {},
    waitForEntry: async () => {},
    pressEdge: async () => {},
    waitForOther: async () => {},
    expectedSelection: 'true',
    identity: 'selected',
  };
  for (const mutation of [
    { achieved: false },
    { focused: true },
    { hovered: true },
    { ariaSelected: 'false' },
    { ariaSelected: null },
  ])
    await assert.rejects(
      establishNativeItemPointerBaseline({
        ...common,
        readTarget: async () => ({ ...valid, ...mutation }),
      }),
      /Invalid independent pointer baseline/
    );
  let pressed = false;
  await assert.rejects(
    establishNativeItemPointerBaseline({
      ...common,
      waitForEntry: async () => {
        throw new Error('entry missing');
      },
      pressEdge: async () => {
        pressed = true;
      },
      readTarget: async () => valid,
    }),
    /entry missing/
  );
  assert.equal(pressed, false);
  let read = false;
  await assert.rejects(
    establishNativeItemPointerBaseline({
      ...common,
      waitForOther: async () => {
        throw new Error('other focus missing');
      },
      readTarget: async () => {
        read = true;
        return valid;
      },
    }),
    /other focus missing/
  );
  assert.equal(read, false);
});

test('an unsettled authored entry fails before native focus or input is attempted', async () => {
  let touched = false;
  const forbidden = async () => {
    touched = true;
    throw new Error('unexpected later step');
  };
  await assert.rejects(
    establishNativeItemPointerBaseline({
      waitForPaint: async () => {
        throw new Error('authored animation did not settle');
      },
      waitForEntry: forbidden,
      pressEdge: forbidden,
      waitForOther: forbidden,
      readTarget: forbidden,
      expectedSelection: null,
      identity: 'default',
    }),
    /authored animation did not settle/
  );
  assert.equal(touched, false);
});

// Controlled receipt inputs exercise the exact narrow classification policy;
// native paint/geometry evidence remains the source-bound browser artifact.
const knownDomain = await import('./contrast-known-unsupported.mjs');
function roundedFrameFixture() {
  const visibility = {
    visible: true,
    classification: 'unsupported',
    limits: ['unsupported-rounded-overflow-clip'],
    roundedOverflowClips: [
      {
        prototype: 'brutalist-scroll-area-root',
        owner: 'owner',
        generation: '1',
        radii: ['5px', '5px', '5px', '5px'],
        overflowX: 'hidden',
        overflowY: 'hidden',
        fixedPx: true,
        safeInteriorOverlap: true,
        whollyInsideSafeRect: false,
        boxCount: 1,
        safeRect: { left: 15, top: 15, right: 105, bottom: 105 },
      },
    ],
  };
  const item = {
    family: 'scroll-area',
    runtime: 'react',
    theme: 'light',
    status: 'running',
    plannedStates: ['rest', 'hover', 'keyboard-focus', 'scroll-end', 'wheel-both-axes'],
    achievedTargets: [],
    errors: [],
  };
  const projection = { achieved: true, owner: 'owner', generation: '1' };
  const frame = {
    family: item.family,
    runtime: item.runtime,
    theme: item.theme,
    requestedState: 'rest',
    projectionBefore: { ...projection },
    projectionAfter: { ...projection },
    anatomyBefore: { ...projection },
    anatomyAfter: { ...projection },
    targetObservation: { achieved: true },
    sameProjectionLease: true,
    sameMeasurementLease: true,
    primaryPaint: { prototype: 'brutalist-scroll-area-viewport', achieved: false, visibility },
    beforeFingerprintDigest: 'sha256:fixture',
    afterFingerprintDigest: 'sha256:fixture',
    image: { path: 'rest.png', digest: 'sha256:image' },
    factsFile: { path: 'rest.facts.json', digest: 'sha256:facts' },
    facts: {
      owner: 'owner',
      generation: '1',
      stateFingerprintDigest: 'sha256:fixture',
      surfaces: [
        {
          prototype: 'brutalist-scroll-area-root',
          visible: true,
          visibility: { classification: 'source-model-visible', limits: [] },
        },
        {
          prototype: 'brutalist-scroll-area-viewport',
          visible: true,
          visibility: structuredClone(visibility),
        },
      ],
    },
  };
  return { item, frame };
}
test('declared rounded ScrollArea is retained as unmeasured, never achieved or hidden', () => {
  const { item, frame } = roundedFrameFixture();
  const result = knownDomain.classifyKnownUnsupportedContrastFrame(item, frame);
  assert.equal(result.achieved, false);
  assert.equal(result.numericAcceptance, 'not-evaluated');
  assert.equal(result.followup, 'https://github.com/Proto-UI/Proto-UI/issues/853');
  assert.deepEqual(result.unexecutedTargets, item.plannedStates);
  item.status = 'known-unsupported';
  item.knownUnsupported = result;
  assert.equal(knownDomain.isUnresolvedContrastCase(item), false);
  assert.deepEqual(item.achievedTargets, []);
  assert.equal(knownDomain.isKnownUnsupportedContrastCase(item), true);
});
for (const [name, damage] of [
  [
    'different family',
    ({ item }) => {
      item.family = 'tooltip';
    },
  ],
  [
    'later journey',
    ({ frame }) => {
      frame.requestedState = 'hover';
    },
  ],
  [
    'prior achieved target',
    ({ item }) => {
      item.achievedTargets.push('rest');
    },
  ],
  [
    'actual hidden primary',
    ({ frame }) => {
      frame.primaryPaint.visibility.visible = false;
    },
  ],
  [
    'hidden physical part',
    ({ frame }) => {
      frame.facts.surfaces[0].visible = false;
    },
  ],
  [
    'extra paint domain',
    ({ frame }) => {
      frame.primaryPaint.visibility.limits.push('unsupported-filter-or-backdrop-filter');
    },
  ],
  [
    'other part paint domain',
    ({ frame }) => {
      frame.facts.surfaces[0].visibility = {
        classification: 'unsupported',
        limits: ['unsupported-clip-path-or-mask'],
      };
    },
  ],
  [
    'unknown radius units',
    ({ frame }) => {
      frame.primaryPaint.visibility.roundedOverflowClips[0].fixedPx = false;
    },
  ],
  [
    'clipped corner only',
    ({ frame }) => {
      frame.primaryPaint.visibility.roundedOverflowClips[0].safeInteriorOverlap = false;
    },
  ],
  [
    'extra clipping ancestor',
    ({ frame }) => {
      frame.primaryPaint.visibility.roundedOverflowClips.push(
        frame.primaryPaint.visibility.roundedOverflowClips[0]
      );
    },
  ],
  [
    'foreign clip owner',
    ({ frame }) => {
      frame.primaryPaint.visibility.roundedOverflowClips[0].owner = 'other';
    },
  ],
  [
    'changed clip epoch',
    ({ frame }) => {
      frame.primaryPaint.visibility.roundedOverflowClips[0].generation = '2';
    },
  ],
  [
    'unexpected clip kind',
    ({ frame }) => {
      frame.primaryPaint.visibility.roundedOverflowClips[0].overflowX = 'scroll';
    },
  ],
  [
    'missing primary facts',
    ({ frame }) => {
      frame.facts.surfaces.pop();
    },
  ],
  [
    'wrong projection',
    ({ frame }) => {
      frame.projectionBefore.achieved = false;
    },
  ],
  [
    'missing anatomy',
    ({ frame }) => {
      frame.anatomyAfter.achieved = false;
    },
  ],
  [
    'failed state predicate',
    ({ frame }) => {
      frame.targetObservation.achieved = false;
    },
  ],
  [
    'changed lease',
    ({ frame }) => {
      frame.sameProjectionLease = false;
    },
  ],
  [
    'changed physical fingerprint',
    ({ frame }) => {
      frame.afterFingerprintDigest = 'sha256:replacement';
    },
  ],
  [
    'facts epoch mismatch',
    ({ frame }) => {
      frame.facts.generation = '2';
    },
  ],
  [
    'missing raw image',
    ({ frame }) => {
      frame.image = null;
    },
  ],
  [
    'missing facts receipt',
    ({ frame }) => {
      frame.factsFile = null;
    },
  ],
])
  test(`known-unsupported policy rejects ${name}`, () => {
    const fixture = roundedFrameFixture();
    damage(fixture);
    assert.equal(
      knownDomain.classifyKnownUnsupportedContrastFrame(fixture.item, fixture.frame),
      null
    );
    fixture.item.status = 'failed';
    assert.equal(knownDomain.isUnresolvedContrastCase(fixture.item), true);
  });

test('actual capture preserves paired raw evidence for known domain and still fails hidden/identity faults', async () => {
  const { transform } = await import('esbuild');
  const source = await readFile(new URL('./audit-brutalist-contrast.mts', import.meta.url), 'utf8');
  const start = source.indexOf('async function capture('),
    end = source.indexOf('\nfunction primary(', start);
  assert.ok(start > 0 && end > start);
  const compiled = (await transform(source.slice(start, end), { loader: 'ts', target: 'es2022' }))
    .code;
  for (const fault of ['none', 'hidden', 'identity', 'source-drift']) {
    const { item, frame: receipt } = roundedFrameFixture();
    const writes = [];
    let stored;
    const state = JSON.stringify({ owner: 'owner', generation: '1' });
    const digest = (value) => (value === state ? 'sha256:fixture' : 'sha256:artifact');
    const facts = { ...receipt.facts, stateFingerprint: state };
    const page = {
      screenshot: async () => Buffer.from('controlled PNG transport'),
      url: () => '/fixture',
      evaluate: async () => facts,
    };
    const captures = [];
    const deps = {
      journal: {
        beginFrame: async () => {},
        finishFrame: async (_name, frame) => {
          stored = structuredClone(frame);
        },
      },
      stableFingerprint: async () => state,
      projectionObservation: async () => receipt.projectionBefore,
      passiveFamilies: new Set(),
      anatomyObservation: async () => receipt.anatomyBefore,
      output: '/fixture',
      digest,
      writeFile: async (path) => {
        writes.push(path);
      },
      join: (a, b) => `${a}/${b}`,
      primary: () => ({}),
      casePreviewer: () => ({}),
      caseSubject: () => ({}),
      targetObservation: async () =>
        fault === 'hidden'
          ? {
              ...receipt.primaryPaint,
              visibility: {
                visible: false,
                classification: 'exempt-not-visible',
                limits: ['ancestor-or-target-hidden'],
              },
            }
          : receipt.primaryPaint,
      fingerprint: async () =>
        fault === 'identity' ? JSON.stringify({ owner: 'other', generation: '2' }) : state,
      measurementLeaseMatches: () => true,
      message: (error) => String(error),
      persist: async () => {},
      classifyKnownUnsupportedContrastFrame: knownDomain.classifyKnownUnsupportedContrastFrame,
      KnownUnsupportedContrastDomain: knownDomain.KnownUnsupportedContrastDomain,
      console: { log: (value) => captures.push(value) },
    };
    const capture = new Function(...Object.keys(deps), `let phase; ${compiled};return capture;`)(
      ...Object.values(deps)
    );
    let thrown;
    try {
      await capture(page, item, 'rest', async () => receipt.targetObservation);
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown instanceof Error);
    if (fault === 'none') assert.ok(thrown instanceof knownDomain.KnownUnsupportedContrastDomain);
    const catchMarker = '    } catch (error) {\n      let knownUnsupported';
    const catchStart = source.indexOf(catchMarker);
    const catchEnd = source.indexOf('    } finally {', catchStart);
    assert.ok(catchStart > 0 && catchEnd > catchStart);
    const catchBody = source.slice(catchStart + '    } catch (error) {'.length, catchEnd);
    const failures = [];
    const caught = new Function(
      'item',
      'error',
      'failures',
      'KnownUnsupportedContrastDomain',
      'persist',
      'message',
      'console',
      'verifyServedSource',
      (
        await transform(
          `return async () => { const {family,runtime,theme}=item; let phase='capture:rest'; ${catchBody} };`,
          { loader: 'ts' }
        )
      ).code
    )(
      item,
      thrown,
      failures,
      knownDomain.KnownUnsupportedContrastDomain,
      async () => {},
      String,
      {
        warn: () => {},
        error: () => {},
      },
      async () => {
        if (fault === 'source-drift') throw new Error('Served source drift');
      }
    );
    await caught();
    assert.equal(knownDomain.isUnresolvedContrastCase(item), fault !== 'none');
    assert.equal(failures.length, fault === 'none' ? 0 : 1);
    assert.deepEqual(item.plannedStates, [
      'rest',
      'hover',
      'keyboard-focus',
      'scroll-end',
      'wheel-both-axes',
    ]);
    if (fault === 'none') {
      assert.equal(item.status, 'known-unsupported');
      assert.deepEqual(item.knownUnsupported.unexecutedTargets, item.plannedStates);
    } else assert.equal(item.status, 'failed');
    assert.ok(writes.some((path) => path.endsWith('.png')));
    assert.ok(writes.some((path) => path.endsWith('.facts.json')));
    assert.deepEqual(item.achievedTargets, []);
    assert.equal(captures.length, 0);
    if (fault === 'none' || fault === 'source-drift') {
      assert.equal(stored.status, 'known-unsupported');
      assert.equal(stored.sameProjectionLease, true);
      assert.equal(stored.sameMeasurementLease, true);
      assert.equal(stored.knownUnsupported.achieved, false);
      assert.equal(stored.beforeFingerprintDigest, stored.afterFingerprintDigest);
    } else assert.equal(stored.status, 'failed');
    if (fault === 'source-drift') {
      assert.equal(item.errors[0].phase, 'source-provenance');
      assert.match(item.errors[0].error, /Served source drift/);
      assert.equal(item.knownUnsupported, undefined);
    }
  }
});

test('all manifest recipes resolve unique authored routes without assuming locale or components layout', async () => {
  const { PROJECTION_FAMILY_MANIFESTS } =
    await import('../src/components/PrototypePreviewer/projection-families.ts');
  const { fileURLToPath } = await import('node:url');
  const manifest = PROJECTION_FAMILY_MANIFESTS.brutalist;
  const sources = await discoverContrastSources({
    contentRoot: fileURLToPath(new URL('../src/content', import.meta.url)),
    manifest,
    families: Object.keys(manifest.families),
  });
  assert.equal(Object.keys(sources).length, Object.keys(manifest.families).length);
  assert.equal(
    sources.label.recipePath,
    'apps/www/src/content/docs/zh-cn/demo-brutalist-label.demo.ts'
  );
  assert.equal(
    sources.collapsible.recipePath,
    'apps/www/src/content/docs/demo-brutalist-collapsible.demo.ts'
  );
  assert.equal(
    sources.accordion.recipePath,
    'apps/www/src/content/docs/demo-brutalist-accordion.demo.ts'
  );
  assert.equal(sources.accordion.route, '/en/ui-libraries/brutalist/accordion/');
  assert.equal(sources.collapsible.route, '/en/ui-libraries/brutalist/components/collapsible/');
  assert.equal(sources.label.route, '/en/ui-libraries/brutalist/components/label/');
});

test('source discovery rejects missing, duplicate, stale, dynamic, overridden and commented bindings', async () => {
  const { mkdtemp, mkdir, writeFile, rm, symlink } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const root = await mkdtemp('/tmp/contrast-source-controls-');
  const page = 'docs/en/ui-libraries/brutalist/disclosure.mdx';
  const valid = '<PrototypePreviewer demoId="demo-brutalist-disclosure" />';
  const manifest = { families: { disclosure: { recipeId: 'demo-brutalist-disclosure' } } };
  async function sample(files) {
    await rm(root, { recursive: true, force: true });
    for (const [path, source] of Object.entries(files)) {
      await mkdir(join(root, path, '..'), { recursive: true });
      await writeFile(join(root, path), source);
    }
    return discoverContrastSources({ contentRoot: root, manifest, families: ['disclosure'] });
  }
  const base = { 'docs/demo-brutalist-disclosure.demo.ts': 'export default {};', [page]: valid };
  try {
    assert.equal((await sample(base)).disclosure.route, '/en/ui-libraries/brutalist/disclosure/');
    for (const files of [
      { [page]: valid },
      { ...base, 'docs/zh-cn/demo-brutalist-disclosure.demo.ts': 'duplicate' },
      { ...base, 'docs/en/ui-libraries/brutalist/duplicate.mdx': valid },
      { ...base, [page]: valid + valid },
      { ...base, [page]: valid.replace('disclosure"', 'wrong"') },
      { ...base, [page]: '<PrototypePreviewer demoId={recipe} />' },
      { ...base, [page]: valid.replace(' />', ' {...props} />') },
      { ...base, [page]: '---\nslug: elsewhere\n---\n' + valid },
      { ...base, [page]: '{/* ' + valid + ' */}' },
      { ...base, [page]: '\x60\x60\x60mdx\n' + valid + '\n\x60\x60\x60' },
    ])
      await assert.rejects(sample(files), /recipe|Duplicate|source-bound|binding|slug/);
    await sample(base);
    await symlink(join(root, 'docs'), join(root, 'alias'));
    await assert.rejects(
      discoverContrastSources({ contentRoot: root, manifest, families: ['disclosure'] }),
      /Symlink/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('new family primaries bind exact authored parts without first-match selection', async () => {
  const { transform } = await import('esbuild');
  const source = await readFile(new URL('./audit-brutalist-contrast.mts', import.meta.url), 'utf8');
  const start = source.indexOf('function primary('),
    end = source.indexOf('\nasync function passiveSurfaceObservation', start);
  const primary = new Function(
    (await transform(source.slice(start, end), { loader: 'ts' })).code + ';return primary;'
  )();
  const previewer = {
    locator: (selector) => ({
      selector,
      first() {
        throw new Error('Ambiguous first match');
      },
    }),
  };
  assert.match(primary(previewer, 'label').selector, /brutalist-label-root.*label-checkbox/);
  assert.match(
    primary(previewer, 'collapsible').selector,
    /uncontrolled.*brutalist-collapsible-trigger/
  );
  assert.match(
    primary(previewer, 'accordion').selector,
    /brutalist-accordion-trigger.*single-lifetime-trigger/
  );
});

// Execute the actual serialized reader in an isolated browser-like realm.
// Geometry/paint are controlled inputs; this is not native browser evidence.
async function readerFixture(name, next) {
  const { transform } = await import('esbuild');
  const { Window } = await import('happy-dom');
  const vm = await import('node:vm');
  const source = await readFile(new URL('./audit-brutalist-contrast.mts', import.meta.url), 'utf8');
  const start = source.indexOf(`async function ${name}(`),
    end = source.indexOf(`async function ${next}(`, start);
  assert.ok(start > 0 && end > start);
  const code = (await transform(source.slice(start, end), { loader: 'ts', keepNames: true })).code;
  const reader = new Function('caseSubject', code + `;return ${name};`)(() => ({ key: 'subject' }));
  const window = new Window();
  const scope = window.document.createElement('div');
  window.document.body.append(scope);
  const boundary = {
    observation: { achieved: true },
    owner: 'owner',
    generation: '1',
    retained: scope,
  };
  const paint = (element) => ({
    achieved: !element.hidden && element.dataset.unsupported !== 'true',
    focused: window.document.activeElement === element,
    focusVisible: true,
    hovered: true,
    nativeActive: true,
  });
  const sandbox = vm.createContext({
    document: window.document,
    puiContrastProbe: {
      readContrastAuditSubject: () => boundary,
      readContrastTargetObservation: paint,
      readContrastPaintedVisibility: (element) => ({
        visible: !element.hidden,
        classification: element.dataset.unsupported
          ? 'unsupported'
          : element.hidden
            ? 'exempt-not-visible'
            : 'source-model-visible',
      }),
    },
  });
  const node = (prototype, ref, parent = scope) => {
    const element = window.document.createElement('div');
    Object.assign(element.dataset, {
      puiRoot: '',
      projectionPrototype: prototype,
      demoRef: ref,
      projectionOwner: 'owner',
      projectionGeneration: '1',
    });
    parent.append(element);
    return element;
  };
  const locator = (element) => ({
    evaluate: async (callback, input) => {
      assert.doesNotMatch(
        callback.toString(),
        /__name/,
        'tsx helpers must not leak into a serialized browser callback'
      );
      return vm.runInContext(`(${callback.toString()})`, sandbox)(element, input);
    },
  });
  return { reader, window, scope, boundary, node, locator };
}

test('actual Label reader requires its named live target and never turns Label into a keyboard control', async () => {
  for (const damage of [
    'none',
    'naming',
    'duplicate-id',
    'wrong-target',
    'duplicate-target',
    'stale-target',
    'stale-label',
    'label-tab-stop',
    'label-button-role',
    'wrong-state',
    'unsupported-target',
    'unsupported-label',
    'stale-subject',
  ]) {
    const { reader, window, node, locator, boundary } = await readerFixture(
      'labelAssociationObservation',
      'labelJourney'
    );
    const label = node('brutalist-label-root', 'label-checkbox');
    const target = node('base-checkbox-root', 'checkbox');
    label.id = 'actual-label';
    target.setAttribute('aria-labelledby', label.id);
    target.setAttribute('role', 'checkbox');
    target.setAttribute('aria-checked', 'false');
    if (damage === 'naming') target.setAttribute('aria-labelledby', 'foreign');
    if (damage === 'duplicate-id') node('base-checkbox-root', 'other').id = label.id;
    if (damage === 'wrong-target') target.dataset.demoRef = 'passive';
    if (damage === 'duplicate-target') node('base-checkbox-root', 'checkbox');
    if (damage === 'stale-target') target.dataset.projectionGeneration = 'old';
    if (damage === 'stale-label') label.dataset.projectionOwner = 'foreign';
    if (damage === 'label-tab-stop') label.tabIndex = 0;
    if (damage === 'label-button-role') label.setAttribute('role', 'button');
    if (damage === 'wrong-state') target.setAttribute('aria-checked', 'true');
    if (damage === 'unsupported-target') target.dataset.unsupported = 'true';
    if (damage === 'unsupported-label') label.dataset.unsupported = 'true';
    if (damage === 'stale-subject') boundary.observation.achieved = false;
    const result = await reader({}, locator(label), false);
    assert.equal(result.achieved, damage === 'none', damage);
    await window.happyDOM.close();
  }
});

for (const family of ['collapsible', 'accordion']) {
  test(`actual ${family} reader requires exact live relation, region policy and immutable reservation`, async () => {
    for (const damage of [
      'none',
      'wrong-owner',
      'foreign-owner',
      'wrong-expanded',
      'wrong-role',
      'disabled',
      'wrong-content',
      'wrong-controls',
      'duplicate-content',
      'duplicate-id',
      'stale-content',
      'wrong-role-content',
      'focusable-content',
      'wrong-label',
      'hidden-content',
      'unsupported-content',
      'new-reservation',
      'stale-subject',
    ]) {
      const { reader, window, node, locator, boundary } = await readerFixture(
        'disclosureObservation',
        'disclosureJourney'
      );
      const accordion = family === 'accordion';
      const owner = node(
        `brutalist-${family}-${accordion ? 'item' : 'root'}`,
        accordion ? 'single-lifetime-item' : 'uncontrolled'
      );
      const trigger = node(
        `brutalist-${family}-trigger`,
        accordion ? 'single-lifetime-trigger' : '',
        owner
      );
      const content = node(
        `brutalist-${family}-content`,
        accordion ? 'single-lifetime-content' : '',
        owner
      );
      trigger.id = 'trigger';
      content.id = 'panel';
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-controls', content.id);
      if (accordion) {
        content.setAttribute('role', 'region');
        content.setAttribute('aria-labelledby', trigger.id);
      }
      if (damage === 'wrong-owner') owner.dataset.demoRef = 'controlled';
      if (damage === 'foreign-owner') owner.dataset.projectionOwner = 'foreign';
      if (damage === 'wrong-expanded') trigger.setAttribute('aria-expanded', 'false');
      if (damage === 'wrong-role') trigger.setAttribute('role', 'tab');
      if (damage === 'disabled') trigger.setAttribute('aria-disabled', 'true');
      if (damage === 'wrong-content') content.remove();
      if (damage === 'wrong-controls') trigger.setAttribute('aria-controls', 'foreign');
      if (damage === 'duplicate-content') node(`brutalist-${family}-content`, '', owner);
      if (damage === 'duplicate-id') node('unrelated', 'other').id = content.id;
      if (damage === 'stale-content') content.dataset.projectionGeneration = 'old';
      if (damage === 'wrong-role-content')
        content.setAttribute('role', accordion ? 'dialog' : 'region');
      if (damage === 'focusable-content') content.tabIndex = 0;
      if (damage === 'wrong-label') {
        if (accordion) content.setAttribute('aria-labelledby', 'other-trigger');
        else trigger.setAttribute('aria-controls', 'panel other');
      }
      if (damage === 'hidden-content') content.hidden = true;
      if (damage === 'unsupported-content') content.dataset.unsupported = 'true';
      if (damage === 'stale-subject') boundary.observation.achieved = false;
      const result = await reader(
        {},
        { family },
        locator(trigger),
        true,
        damage === 'new-reservation' ? 'old-panel' : 'panel'
      );
      assert.equal(result.achieved, damage === 'none', damage);
      await window.happyDOM.close();
    }
  });
  test(`actual ${family} closed default-L1 reader rejects stale or merely hidden live views`, async () => {
    for (const damage of [
      'absent',
      'hidden-shell',
      'visible-shell',
      'live-hidden-view',
      'retained-id',
      'dangling-controls',
      'foreign-shell',
      'duplicate-shell',
    ]) {
      const { reader, window, node, locator } = await readerFixture(
        'disclosureObservation',
        'disclosureJourney'
      );
      const accordion = family === 'accordion';
      const owner = node(
        `brutalist-${family}-${accordion ? 'item' : 'root'}`,
        accordion ? 'single-lifetime-item' : 'uncontrolled'
      );
      const trigger = node(
        `brutalist-${family}-trigger`,
        accordion ? 'single-lifetime-trigger' : '',
        owner
      );
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-expanded', 'false');
      if (damage !== 'absent') {
        const content = node(
          `brutalist-${family}-content`,
          accordion ? 'single-lifetime-content' : '',
          owner
        );
        content.hidden = damage !== 'visible-shell';
        if (damage !== 'live-hidden-view') content.setAttribute('data-pui-view-detached', '');
        if (damage === 'retained-id') content.id = 'old-panel';
        if (damage === 'dangling-controls') trigger.setAttribute('aria-controls', 'old-panel');
        if (damage === 'foreign-shell') content.dataset.projectionGeneration = 'old';
        if (damage === 'duplicate-shell') node(`brutalist-${family}-content`, '', owner);
      }
      const result = await reader({}, { family }, locator(trigger), false);
      assert.equal(result.achieved, ['absent', 'hidden-shell'].includes(damage), damage);
      await window.happyDOM.close();
    }
  });
}

async function auditFunction(name, next, dependencies) {
  const { transform } = await import('esbuild');
  const source = await readFile(new URL('./audit-brutalist-contrast.mts', import.meta.url), 'utf8');
  const start = source.indexOf(`async function ${name}(`),
    end = source.indexOf(`async function ${next}(`, start);
  assert.ok(start > 0 && end > start);
  const code = (await transform(source.slice(start, end), { loader: 'ts' })).code;
  return new Function(...Object.keys(dependencies), code + `;return ${name};`)(
    ...Object.values(dependencies)
  );
}

for (const family of ['label', 'collapsible', 'accordion']) {
  test(`actual ${family} native journey captures each finite target once and never claims a failed transition`, async () => {
    for (const fault of [
      'none',
      'no-pointer-change',
      'lost-keyboard-focus',
      'no-keyboard-change',
      'changed-reservation',
    ]) {
      if (family === 'label' && fault === 'changed-reservation') continue;
      let active = false,
        focus = false,
        value = false,
        id = 'panel',
        clicks = 0;
      const captures = [],
        actions = [];
      const target = {
        hover: async () => {
          actions.push('hover');
        },
        boundingBox: async () => ({ x: 10, y: 10, width: 20, height: 20 }),
        focus: async () => {
          focus = true;
          actions.push('focus-control');
        },
        click: async () => {
          value = !value;
          clicks++;
          if (fault === 'changed-reservation' && clicks === 2) id = 'replaced';
          actions.push('native-click');
        },
        and: () => ({
          waitFor: async () => {
            actions.push('observed-state');
          },
        }),
      };
      const label = {
        ...target,
        focus: async () => {
          throw new Error('Label must never receive focus input');
        },
      };
      const page = {
        locator: () => ({}),
        mouse: {
          move: async () => {},
          down: async () => {
            active = true;
            actions.push('native-down');
          },
          up: async () => {
            active = false;
            focus = true;
            if (fault !== 'no-pointer-change') value = !value;
            actions.push('native-up');
          },
        },
        keyboard: {
          press: async (key) => {
            actions.push(`native-${key}`);
            if (key === 'Tab') focus = false;
            if (key === 'Shift+Tab') focus = fault !== 'lost-keyboard-focus';
            if (['Space', 'Enter'].includes(key) && fault !== 'no-keyboard-change') value = !value;
          },
        },
      };
      const paint = () => ({
        hovered: true,
        nativeActive: active,
        focused: focus,
        focusVisible: true,
      });
      const dependencies = {
        capture: async (_page, _item, state, read) => {
          const observation = await read();
          assert.equal(observation.achieved, true, `unachieved ${state}`);
          captures.push(state);
        },
        casePreviewer: () => ({ locator: () => target }),
        labelAssociationObservation: async (_page, _label, expected) => ({
          achieved: value === expected,
          label: { ...paint(), focused: false },
          target: paint(),
        }),
        disclosureObservation: async (_page, _item, _target, expected, identity) => ({
          achieved: value === expected && (!identity || identity === id),
          identity: id,
          trigger: paint(),
        }),
      };
      const name = family === 'label' ? 'labelJourney' : 'disclosureJourney';
      const next = family === 'label' ? 'disclosureObservation' : 'pointerJourney';
      const journey = await auditFunction(name, next, dependencies);
      if (fault === 'none') {
        await journey(page, { family }, family === 'label' ? label : target);
        assert.deepEqual(
          captures,
          family === 'label'
            ? [
                'label-hover',
                'label-pointer-down',
                'label-activation-result',
                'target-keyboard-focus',
                'target-keyboard-activation',
              ]
            : [
                'hover',
                'pointer-down',
                'open',
                'closed',
                'reopened',
                'keyboard-focus',
                'keyboard-closed',
                'keyboard-open',
              ]
        );
        assert.equal(new Set(captures).size, captures.length);
        assert.ok(actions.indexOf('native-up') > actions.indexOf('native-down'));
        assert.ok(actions.includes('native-Tab') && actions.includes('native-Shift+Tab'));
      } else {
        await assert.rejects(
          journey(page, { family }, family === 'label' ? label : target),
          /unachieved/
        );
        assert.equal(
          active,
          false,
          'native mouse-up must occur even when held-frame capture fails'
        );
      }
    }
  });
}

test('new journeys match the actual recipe association and uncontrolled domain instead of a convenient first control', async () => {
  const { tsImport } = await import('tsx/esm/api');
  const { PROJECTION_FAMILY_MANIFESTS } =
    await import('../src/components/PrototypePreviewer/projection-families.ts');
  const { fileURLToPath } = await import('node:url');
  const sources = await discoverContrastSources({
    contentRoot: fileURLToPath(new URL('../src/content', import.meta.url)),
    manifest: PROJECTION_FAMILY_MANIFESTS.brutalist,
    families: ['label', 'collapsible', 'accordion'],
  });
  for (const family of ['label', 'collapsible', 'accordion']) {
    const { default: demo } = await tsImport(
      new URL(sources[family].recipePath, new URL('../../../', import.meta.url)).href,
      import.meta.url
    );
    const nodes = [];
    const visit = (node, parent = null) => {
      if (!node || typeof node === 'string') return;
      nodes.push({ node, parent });
      for (const child of node.children ?? []) visit(child, node);
    };
    visit(demo.root);
    const ref = (name) => nodes.filter(({ node }) => node.ref === name);
    if (family === 'label') {
      assert.equal(ref('label-checkbox').length, 1);
      assert.equal(ref('checkbox').length, 1);
      const label = ref('label-checkbox')[0].node,
        target = ref('checkbox')[0].node;
      assert.equal(label.prototypeId, 'brutalist-label-root');
      assert.equal(target.prototypeId, 'base-checkbox-root');
      assert.deepEqual(label.associations, target.associations);
      assert.equal(label.props.naming, true);
      assert.equal(label.props.activation, true);
      assert.equal(target.props.checked, undefined);
      assert.equal(target.props.defaultChecked, undefined);
    } else if (family === 'collapsible') {
      assert.equal(ref('uncontrolled').length, 1);
      const root = ref('uncontrolled')[0].node;
      assert.deepEqual(root.props, {});
      assert.equal(
        root.children.filter((node) => node.prototypeId === 'brutalist-collapsible-trigger').length,
        1
      );
      assert.equal(
        root.children.find((node) => node.prototypeId === 'brutalist-collapsible-content').props
          .keepMounted,
        false
      );
    } else {
      assert.equal(ref('single-lifetime-trigger').length, 1);
      const item = ref('single-lifetime-item')[0].node;
      assert.equal(item.props.value, 'lifetime');
      assert.equal(ref('single-lifetime-trigger')[0].parent.ref, 'single-lifetime-heading');
      assert.equal(ref('single-lifetime-content')[0].parent, item);
      assert.deepEqual(ref('single-lifetime-content')[0].node.props, {
        keepMounted: false,
        region: true,
      });
      assert.deepEqual(ref('single')[0].node.props.defaultOpenItems, ['overview']);
      assert.equal(ref('single')[0].node.props.openItems, undefined);
    }
  }
});

test('new source-bound plans keep naming and default-L1 observations separate from full family acceptance', async () => {
  const { transform } = await import('esbuild');
  const source = await readFile(new URL('./audit-brutalist-contrast.mts', import.meta.url), 'utf8');
  const start = source.indexOf('function plannedStates('),
    end = source.indexOf('// Populate this matrix', start);
  const plannedStates = new Function(
    'passiveFamilies',
    'contrastHeldBinaryTargets',
    (await transform(source.slice(start, end), { loader: 'ts' })).code + ';return plannedStates;'
  )(new Set(['badge', 'card', 'skeleton', 'separator', 'spinner']), contrastHeldBinaryTargets);
  assert.deepEqual(plannedStates('label'), [
    'rest',
    'label-hover',
    'label-pointer-down',
    'label-activation-result',
    'target-keyboard-focus',
    'target-keyboard-activation',
  ]);
  for (const family of ['collapsible', 'accordion'])
    assert.deepEqual(plannedStates(family), [
      'rest',
      'hover',
      'pointer-down',
      'open',
      'closed',
      'reopened',
      'keyboard-focus',
      'keyboard-closed',
      'keyboard-open',
    ]);
  assert.match(source, /Label itself adds no Tab stop or keyboard target/);
  assert.match(
    source,
    /Full controlled, disabled, retained, navigation, nested, terminal, material and GPUI acceptance remains separate/
  );
  assert.doesNotMatch(source, /content\/docs\/zh-cn\/\$\{manifest.recipeId\}/);
  assert.doesNotMatch(source, /\/brutalist\/components\/\$\{family\}/);
});
