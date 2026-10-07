// Runtime discovery is read from the exact served preview, never inferred from
// the global list of official adapters or from a different family's route.
export function parseContrastRuntimeOptions(serialized, supported) {
  let values;
  try {
    values = JSON.parse(serialized);
  } catch {
    throw new Error('Audited preview has no valid serialized runtime availability.');
  }
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    new Set(values).size !== values.length ||
    values.some((value) => typeof value !== 'string' || !supported.includes(value))
  )
    throw new Error('Audited preview must declare distinct supported runtime identities.');
  return values;
}

// These are the current authored reference controls, not a new state model.
// Mixed and checked+indeterminate are separate authored Checkbox cases.
export function contrastHeldBinaryTargets(family) {
  if (family === 'switch')
    return [{ ref: 'releaseAlertsSwitch', state: 'checked', ariaChecked: 'true' }];
  if (family === 'checkbox')
    return [
      { ref: 'checkedCheckbox', state: 'checked', ariaChecked: 'true' },
      { ref: 'mixedCheckbox', state: 'mixed', ariaChecked: 'mixed' },
      { ref: 'checkedIndeterminateCheckbox', state: 'checked-indeterminate', ariaChecked: 'mixed' },
    ];
  return [];
}

export function assertContrastCaseCoverage(selectedFamilies, cases) {
  if (
    !selectedFamilies.length ||
    !cases.length ||
    selectedFamilies.some((family) => !cases.some((item) => item.family === family))
  )
    throw new Error(
      'Every requested family needs observed runtime cases or an explicit unresolved discovery case; empty evidence cannot succeed.'
    );
}

// Current P-BRUTALIST-TABS-TRIGGER is flat (0.3.0-alpha.1). Zero-offset
// focus rings are distinct from elevation; malformed or moving paint fails.
export function classifyFlatTabPaint({ shadow, transform, translate }) {
  const shadowLayers = shadow.split(/,(?![^()]*\))/).map((raw) => {
    const layer = raw.trim();
    return {
      raw: layer,
      inset: layer.includes('inset'),
      visible: layer !== 'none' && !/^rgba\([^)]*,\s*0(?:\.0*)?\)\s/.test(layer),
      lengths: [...layer.matchAll(/(-?(?:\d+\.?\d*|\.\d+))px/g)].map((match) => Number(match[1])),
    };
  });
  const supported = shadowLayers.every(
    (layer) => layer.raw === 'none' || layer.lengths.length === 4
  );
  const depthLayers = shadowLayers.filter(
    (layer) =>
      layer.visible &&
      (layer.inset || layer.lengths[0] !== 0 || layer.lengths[1] !== 0 || layer.lengths[2] !== 0)
  );
  const transformValues = /^matrix\(([^)]+)\)$/.exec(transform)?.[1].split(',').map(Number);
  const identityTransform =
    transform === 'none' ||
    (transformValues?.length === 6 &&
      transformValues.every((value, index) => value === [1, 0, 0, 1, 0, 0][index]));
  const translateValues = translate.trim().split(/\s+/);
  const noTranslation =
    translate === 'none' ||
    (translateValues.length <= 3 &&
      translateValues.every((value) => /^[-+]?0(?:\.0+)?(?:px|%)?$/.test(value)));
  return {
    shadowLayers,
    depthLayers,
    identityTransform,
    noTranslation,
    flatPaint: supported && depthLayers.length === 0 && identityTransform && noTranslation,
  };
}

// Popup visibility is not native focus/event readiness. Observe entry first,
// then request the opposite row with a real key and observe that exact focus.
// No delay, synthetic focus, or state mutation substitutes for these barriers.
export async function establishNativeItemPointerBaseline({
  waitForPaint,
  waitForEntry,
  pressEdge,
  waitForOther,
  readTarget,
  expectedSelection,
  identity,
}) {
  await waitForPaint();
  await waitForEntry();
  await pressEdge();
  await waitForOther();
  const before = await readTarget();
  if (
    !before.achieved ||
    before.focused ||
    before.hovered ||
    (expectedSelection !== null && before.ariaSelected !== expectedSelection)
  )
    throw new Error(`Invalid independent pointer baseline for ${identity}.`);
  return before;
}
