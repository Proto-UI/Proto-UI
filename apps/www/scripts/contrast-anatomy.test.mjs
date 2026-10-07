import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PROJECTION_FAMILY_MANIFESTS } from '../src/components/PrototypePreviewer/projection-families.ts';
import { compileContrastAnatomy, compareContrastAnatomy } from './contrast-anatomy.mjs';

const load = async (family) => {
  const { default: demo } = await import(
    `../src/content/docs/zh-cn/demo-brutalist-${family}.demo.ts`
  );
  return compileContrastAnatomy(demo, PROJECTION_FAMILY_MANIFESTS.brutalist.families[family]);
};
// Deliberately synthetic structure/paint observations. Real recipe identities,
// multiplicities, refs and state props are used; this is not browser evidence.
const model = (plan, family) => ({
  currentLease: true,
  primary: plan.instances.find((node) => node.part === 'trigger')?.path ?? null,
  surfaces: plan.instances.map((node) => ({
    uid: node.path,
    parent: node.parent,
    prototypeId: node.prototypeId,
    ref: node.ref,
    id: node.path,
    role: node.part === 'root' ? family : null,
    controls: [],
    descriptions: [],
    ariaExpanded: 'false',
    ariaSelected: 'false',
    ariaChecked: node.props.defaultIndeterminate
      ? 'mixed'
      : node.props.defaultChecked
        ? 'true'
        : 'false',
    hovered: false,
    focused: false,
    withinContent: true,
    painted: true,
  })),
});
const oldRootIdentityPredicate = (plan, sample) =>
  sample.surfaces.some((surface) => surface.prototypeId === plan.rootPrototypeId) &&
  sample.surfaces.every((surface) =>
    plan.instances.some((node) => node.prototypeId === surface.prototypeId)
  );

for (const [family, rootRef, part] of [
  ['switch', 'releaseAlertsSwitch', 'thumb'],
  ['checkbox', 'checkedCheckbox', 'indicator'],
  ['checkbox', 'mixedCheckbox', 'indicator'],
])
  test(`rejects missing ${family} ${rootRef} ${part} that the old identity guard accepts`, async () => {
    const plan = await load(family);
    const sample = model(plan, family);
    assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
    const root = plan.instances.find((node) => node.ref === rootRef);
    const missing = plan.instances.find((node) => node.parent === root.path && node.part === part);
    sample.surfaces = sample.surfaces.filter((surface) => surface.uid !== missing.path);
    assert.equal(oldRootIdentityPredicate(plan, sample), true);
    const result = compareContrastAnatomy(plan, sample);
    assert.equal(result.achieved, false);
    assert.ok(
      result.failures.some(
        (failure) => failure.path === missing.path && /Missing/.test(failure.reason)
      )
    );
  });

test('global equal counts cannot move an Indicator from one authored Root to another', async () => {
  const plan = await load('checkbox');
  const sample = model(plan, 'checkbox');
  const checked = plan.instances.find((node) => node.ref === 'checkedCheckbox');
  const mixed = plan.instances.find((node) => node.ref === 'mixedCheckbox');
  const part = sample.surfaces.find((surface) => surface.parent === checked.path);
  part.parent = mixed.path;
  assert.equal(sample.surfaces.length, plan.instances.length);
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
});

test('unchecked Indicator may be unpainted but checked/mixed Indicator and Switch Thumb may not', async () => {
  const plan = await load('checkbox');
  const sample = model(plan, 'checkbox');
  const root = (ref) => plan.instances.find((node) => node.ref === ref);
  sample.surfaces.find((surface) => surface.parent === root('uncheckedCheckbox').path).painted =
    false;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
  for (const ref of ['checkedCheckbox', 'mixedCheckbox']) {
    const part = sample.surfaces.find((surface) => surface.parent === root(ref).path);
    part.painted = false;
    assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
    part.painted = true;
  }
  const switchPlan = await load('switch');
  const switches = model(switchPlan, 'switch');
  switches.surfaces.find((surface) => surface.prototypeId.endsWith('-thumb')).painted = false;
  assert.equal(compareContrastAnatomy(switchPlan, switches).achieved, false);
});

for (const family of ['select', 'dropdown-menu', 'dialog'])
  test(`${family} derives portal subtree counts from the recipe and current trigger relation`, async () => {
    const plan = await load(family);
    const sample = model(plan, family);
    const content = plan.instances.find((node) => node.part === 'content');
    const trigger = sample.surfaces.find(
      (surface) =>
        surface.prototypeId === plan.instances.find((node) => node.part === 'trigger').prototypeId
    );
    trigger.controls = [content.path];
    const closed = {
      ...sample,
      surfaces: sample.surfaces.filter((surface) => {
        const node = plan.instances.find((node) => node.path === surface.uid);
        return !node.policy && !node.boundary;
      }),
    };
    assert.equal(compareContrastAnatomy(plan, closed).achieved, true);
    trigger.ariaExpanded = 'true';
    assert.equal(compareContrastAnatomy(plan, closed).achieved, false);
    const inlineContent = sample.surfaces.find((surface) => surface.uid === content.path);
    assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
    inlineContent.parent = trigger.uid;
    assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
    inlineContent.parent = content.parent;
    for (const surface of sample.surfaces) {
      const node = plan.instances.find((node) => node.path === surface.uid);
      if (node.policy) surface.parent = null;
      if (node.policy || node.boundary) surface.withinContent = false;
    }
    assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
    const child = sample.surfaces.find((surface) => surface.parent === content.path);
    sample.surfaces = sample.surfaces.filter((surface) => surface !== child);
    assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
  });

test('selected Tabs panel follows authored value and current controls, inactive detached panel is optional', async () => {
  const plan = await load('tabs');
  const sample = model(plan, 'tabs');
  const panels = plan.instances.filter((node) => node.part === 'content');
  for (const node of plan.instances.filter((node) => node.part === 'trigger')) {
    const target = sample.surfaces.find((surface) => surface.uid === node.path);
    target.controls = [panels.find((panel) => panel.props.value === node.props.value).path];
    target.ariaSelected = String(node.props.value === 'overview');
  }
  const hidden = panels.find((node) => node.props.value === 'details');
  sample.surfaces = sample.surfaces.filter((surface) => surface.uid !== hidden.path);
  assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
  const selected = sample.surfaces.find((surface) => surface.uid === panels[0].path);
  selected.parent = plan.instances.find((node) => node.part === 'list').path;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
  selected.parent = null;
  selected.withinContent = false;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
  selected.parent = panels[0].parent;
  selected.withinContent = true;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
  sample.surfaces = sample.surfaces.filter((surface) => surface.uid !== panels[0].path);
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
});

test('Tooltip sibling portals remain bound to their own description, not borrowed by another Root', async () => {
  const plan = await load('tooltip');
  const sample = model(plan, 'tooltip');
  const contents = plan.instances.filter((node) => node.part === 'content');
  const first = contents[0];
  const triggerNode = plan.instances.find(
    (node) => node.part === 'trigger' && node.parent === first.parent
  );
  const trigger = sample.surfaces.find((surface) => surface.uid === triggerNode.path);
  trigger.hovered = true;
  trigger.descriptions = [first.path, 'unrelated-accessible-description'];
  sample.surfaces = sample.surfaces.filter((surface) => surface.uid !== contents[1].path);
  const popup = sample.surfaces.find((surface) => surface.uid === first.path);
  popup.parent = null;
  popup.withinContent = false;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
  popup.id = contents[1].path;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
  popup.id = first.path;
  trigger.descriptions = [];
  assert.equal(compareContrastAnatomy(plan, sample, { requirePrimaryOpen: true }).achieved, false);
});

test('Hover Card intent requires its one authored owned portal, and closed detached content is allowed', async () => {
  const plan = await load('hover-card');
  const sample = model(plan, 'hover-card');
  const content = plan.instances.find((node) => node.part === 'content');
  const trigger = sample.surfaces.find(
    (surface) => surface.uid === plan.instances.find((node) => node.part === 'trigger').path
  );
  const closed = {
    ...sample,
    surfaces: sample.surfaces.filter((surface) => surface.uid !== content.path),
  };
  assert.equal(compareContrastAnatomy(plan, closed).achieved, true);
  trigger.focused = true;
  assert.equal(compareContrastAnatomy(plan, closed).achieved, true);
  assert.equal(compareContrastAnatomy(plan, closed, { requirePrimaryOpen: true }).achieved, false);
  const popup = sample.surfaces.find((surface) => surface.uid === content.path);
  popup.parent = null;
  popup.withinContent = false;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
  sample.currentLease = false;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
});

test('delayed or dismissed Tooltip intent alone does not invent materialization', async () => {
  const plan = await load('tooltip');
  const sample = model(plan, 'tooltip');
  sample.surfaces = sample.surfaces.filter(
    (surface) => !plan.instances.find((node) => node.path === surface.uid).policy
  );
  const trigger = sample.surfaces.find((surface) => surface.uid === sample.primary);
  trigger.hovered = true;
  trigger.focused = true;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
  assert.equal(compareContrastAnatomy(plan, sample, { requirePrimaryOpen: true }).achieved, false);
});

test('keepMounted Tabs require an inactive physical subtree without claiming its paint', async () => {
  const plan = await load('tabs');
  const panel = plan.instances.find(
    (node) => node.part === 'content' && node.props.value === 'details'
  );
  panel.props = { ...panel.props, keepMounted: true };
  const sample = model(plan, 'tabs');
  for (const node of plan.instances.filter((node) => node.part === 'trigger')) {
    const target = sample.surfaces.find((surface) => surface.uid === node.path);
    target.controls = [
      plan.instances.find(
        (panel) => panel.part === 'content' && panel.props.value === node.props.value
      ).path,
    ];
    target.ariaSelected = String(node.props.value === 'overview');
  }
  sample.surfaces.find((surface) => surface.uid === panel.path).painted = false;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, true);
  sample.surfaces = sample.surfaces.filter((surface) => surface.uid !== panel.path);
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
});

test('extra materialized copies cannot satisfy authored multiplicities', async () => {
  const plan = await load('switch');
  const sample = model(plan, 'switch');
  const thumb = sample.surfaces.find((surface) => surface.prototypeId.endsWith('-thumb'));
  sample.surfaces.push({ ...thumb, uid: 'unrelated-extra-copy' });
  const result = compareContrastAnatomy(plan, sample);
  assert.equal(result.achieved, false);
  assert.equal(result.extras.length, 1);
});

// Raw source-bound native observations from the failing f8894c3c PR run. This
// reruns only the structural model, not Chromium, paint, or interaction input.
const native = JSON.parse(
  readFileSync(new URL('./fixtures/contrast-anatomy-f889-native.json', import.meta.url), 'utf8')
);
for (const frame of native.frames)
  test(`replays recorded native anatomy: ${frame.name}`, async () => {
    const plan = await load(frame.family);
    const observed = { ...frame.observed, surfaces: native.surfaceSets[frame.surfaceSet] };
    const result = compareContrastAnatomy(plan, observed, {
      requirePrimaryOpen: frame.requirePrimaryOpen,
    });
    assert.equal(result.achieved, true, JSON.stringify(result));
  });

const replay = (frame) =>
  structuredClone({ ...frame.observed, surfaces: native.surfaceSets[frame.surfaceSet] });
const retainedFrame = (family) =>
  native.frames.find(
    (frame) => frame.family === family && frame.runtime === 'wc' && frame.theme === 'light'
  );
const retainedContent = (sample) =>
  sample.surfaces.find((surface) => surface.prototypeId.endsWith('-content') && surface.id === '');
// These are explicit negative mutations of recorded observations. They are
// structural-model controls, not claims that a browser produced these states.
for (const family of ['dropdown-menu', 'select', 'dialog', 'tooltip', 'tabs']) {
  test(`${family} retained shell cannot borrow identity, paint, lease, parent or portal ownership`, async () => {
    const plan = await load(family);
    const frame = retainedFrame(family);
    const mutations = {
      'wrong active ID': (shell) => (shell.id = 'unrelated-active-target'),
      'painted shell': (shell) => {
        shell.painted = true;
        shell.visibility = { visible: true, classification: 'source-model-visible', limits: [] };
      },
      'unsupported hidden claim': (shell) => (shell.visibility.classification = 'unsupported'),
      'stale shell lease': (shell) => (shell.currentLease = false),
      'wrong authored parent': (shell, sample) => (shell.parent = sample.primary),
      'unbound detached portal': (shell) => {
        shell.withinContent = false;
        shell.parent = null;
      },
      'duplicate shell': (shell, sample) =>
        sample.surfaces.push({ ...shell, uid: 'duplicate-shell' }),
      'duplicate owner': (_shell, sample) =>
        sample.surfaces.push({
          ...sample.surfaces.find((surface) => surface.prototypeId === plan.rootPrototypeId),
          uid: 'duplicate-owner',
        }),
    };
    for (const [name, mutate] of Object.entries(mutations)) {
      const sample = replay(frame);
      mutate(retainedContent(sample), sample);
      assert.equal(compareContrastAnatomy(plan, sample).achieved, false, name);
    }
    const stale = replay(frame);
    stale.currentLease = false;
    assert.equal(compareContrastAnatomy(plan, stale).achieved, false);
  });
}

for (const family of ['dropdown-menu', 'select', 'dialog']) {
  test(`${family} retained shell requires all authored hidden children and cannot replace an open target`, async () => {
    const plan = await load(family);
    const frame = retainedFrame(family);
    const missing = replay(frame);
    const shell = retainedContent(missing);
    const child = missing.surfaces.find((surface) => surface.parent === shell.uid);
    missing.surfaces = missing.surfaces.filter((surface) => surface !== child);
    assert.equal(compareContrastAnatomy(plan, missing).achieved, false);
    const exposed = replay(frame);
    const exposedChild = exposed.surfaces.find((surface) => surface.uid === child.uid);
    exposedChild.painted = true;
    exposedChild.visibility = { visible: true, classification: 'source-model-visible', limits: [] };
    assert.equal(compareContrastAnatomy(plan, exposed).achieved, false);
    const opened = replay(frame);
    const trigger = opened.surfaces.find((surface) => surface.uid === opened.primary);
    trigger.ariaExpanded = 'true';
    assert.equal(compareContrastAnatomy(plan, opened).achieved, false, 'empty ID is not open');
    retainedContent(opened).id = trigger.controls[0];
    assert.equal(compareContrastAnatomy(plan, opened).achieved, false, 'hidden is not open paint');
    const duplicatePortal = replay(frame);
    const portal = { ...retainedContent(duplicatePortal), uid: 'extra-portal', parent: null };
    portal.withinContent = false;
    portal.id = trigger.controls[0];
    duplicatePortal.surfaces.push(portal);
    assert.equal(compareContrastAnatomy(plan, duplicatePortal).achieved, false);
  });
}

test('retained Tooltip shells stay within their exact Root and never satisfy required open capture', async () => {
  const plan = await load('tooltip');
  const sample = replay(retainedFrame('tooltip'));
  const shells = sample.surfaces.filter((surface) => surface.prototypeId.endsWith('-content'));
  shells[0].parent = shells[1].parent;
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
  const closed = replay(retainedFrame('tooltip'));
  assert.equal(compareContrastAnatomy(plan, closed, { requirePrimaryOpen: true }).achieved, false);
  const trigger = closed.surfaces.find((surface) => surface.uid === closed.primary);
  trigger.descriptions = ['active-tooltip'];
  retainedContent(closed).id = 'active-tooltip';
  assert.equal(compareContrastAnatomy(plan, closed, { requirePrimaryOpen: true }).achieved, false);
});

test('retained inactive Tabs shell cannot satisfy selected or keepMounted view requirements', async () => {
  const plan = await load('tabs');
  const sample = replay(retainedFrame('tabs'));
  const inactive = sample.surfaces.find((surface) => surface.ariaSelected === 'false');
  inactive.ariaSelected = 'true';
  inactive.controls = ['active-panel'];
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
  retainedContent(sample).id = 'active-panel';
  assert.equal(compareContrastAnatomy(plan, sample).achieved, false);
  const kept = structuredClone(plan);
  kept.instances.find(
    (node) => node.part === 'content' && node.props.value === 'details'
  ).props.keepMounted = true;
  assert.equal(compareContrastAnatomy(kept, replay(retainedFrame('tabs'))).achieved, false);
});

test('anonymous in-content Mask cannot bypass closed-shell guards but a portaled leave remains allowed', async () => {
  const plan = await load('dialog');
  const frame = retainedFrame('dialog');
  for (const kind of ['painted', 'unsupported', 'stale']) {
    const sample = replay(frame);
    const mask = sample.surfaces.find((surface) => surface.prototypeId === 'brutalist-dialog-mask');
    if (kind === 'painted') {
      mask.painted = true;
      mask.visibility = { visible: true, classification: 'source-model-visible', limits: [] };
    }
    if (kind === 'unsupported') mask.visibility.classification = 'unsupported';
    if (kind === 'stale') mask.currentLease = false;
    assert.equal(compareContrastAnatomy(plan, sample).achieved, false, kind);
  }
  // A relation-free Mask can legitimately remain in its body portal while
  // logical open is false and leave is unfinished. This is a model control.
  const leaving = replay(frame);
  const portal = leaving.surfaces.find(
    (surface) => surface.prototypeId === 'brutalist-dialog-mask'
  );
  portal.parent = null;
  portal.withinContent = false;
  portal.painted = true;
  portal.visibility = { visible: true, classification: 'source-model-visible', limits: [] };
  assert.equal(compareContrastAnatomy(plan, leaving).achieved, true);
});

// Actual 30e605a4 failed frames: first Tooltip is focused/open; native Tab briefly
// visited its sibling, whose correctly hidden in-content view retains stable ID
// and role after the accepted WC slot-preservation change. No pixels are replayed.
const retainedTooltipNative = JSON.parse(
  readFileSync(
    new URL('./fixtures/contrast-anatomy-30e-tooltip-native.json', import.meta.url),
    'utf8'
  )
);
for (const frame of retainedTooltipNative.frames)
  test(`replays recorded 30e Tooltip retained identity: ${frame.name}`, async () => {
    const plan = await load('tooltip');
    assert.equal(frame.beforeFingerprintDigest, frame.afterFingerprintDigest);
    const result = compareContrastAnatomy(plan, frame.observed, {
      requirePrimaryOpen: frame.requirePrimaryOpen,
    });
    assert.equal(result.achieved, true, JSON.stringify(result));
  });

for (const [name, mutate] of Object.entries({
  'painted inactive view': (part) => {
    part.painted = true;
    part.visibility = { visible: true, classification: 'source-model-visible', limits: [] };
  },
  'unsupported hidden classification': (part) => (part.visibility.classification = 'unsupported'),
  'stale retained lease': (part) => (part.currentLease = false),
  'wrong authored parent': (part, sample) => (part.parent = sample.primary),
  'unbound hidden portal': (part) => {
    part.withinContent = false;
    part.parent = null;
  },
  'wrong retained role': (part) => (part.role = 'dialog'),
  'missing retained role': (part) => (part.role = null),
  'duplicate retained view': (part, sample) =>
    sample.surfaces.push({ ...structuredClone(part), uid: 'duplicate' }),
  'duplicate identity on another part': (part, sample) =>
    (sample.surfaces.find((surface) => surface.uid === sample.primary).id = part.id),
  'foreign description relation': (part, sample) =>
    sample.surfaces.find((surface) => surface.uid === sample.primary).descriptions.push(part.id),
  'foreign control relation': (part, sample) =>
    sample.surfaces.find((surface) => surface.uid === sample.primary).controls.push(part.id),
  'hidden primary content': (_part, sample) => {
    const trigger = sample.surfaces.find((surface) => surface.uid === sample.primary);
    const content = sample.surfaces.find((surface) => trigger.descriptions.includes(surface.id));
    content.painted = false;
    content.visibility = { visible: false, classification: 'exempt-not-visible', limits: [] };
  },
  'stale observation lease': (_part, sample) => (sample.currentLease = false),
}))
  test(`retained stable Tooltip identity rejects ${name}`, async () => {
    const frame = retainedTooltipNative.frames[0];
    const sample = structuredClone(frame.observed);
    const part = sample.surfaces.find(
      (surface) => surface.prototypeId === 'brutalist-tooltip-content' && !surface.painted
    );
    assert.equal(part.role, 'tooltip');
    mutate(part, sample);
    assert.equal(
      compareContrastAnatomy(await load('tooltip'), sample, { requirePrimaryOpen: true }).achieved,
      false,
      name
    );
  });
