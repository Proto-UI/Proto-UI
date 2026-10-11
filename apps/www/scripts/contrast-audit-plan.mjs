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

// Mirror the existing demo-modules glob's unique basename contract, not a
// second family/path registry. Routes must contain that exact literal recipe in
// the current English Brutalist page. Unsupported dynamic MDX fails closed.
export async function discoverContrastSources({ contentRoot, manifest, families }) {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const files = [];
  let visited = 0;
  async function walk(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (++visited > 20_000) throw new Error('Contrast source discovery exceeded its file bound.');
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symlink in contrast source discovery: ${path}`);
      if (entry.isDirectory()) await walk(join(directory, entry.name), path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk(contentRoot);
  const recipes = new Map();
  for (const path of files.filter((path) => path.endsWith('.demo.ts'))) {
    const id = path.split('/').at(-1).slice(0, -'.demo.ts'.length);
    if (recipes.has(id)) throw new Error(`Duplicate demo ID ${id}: ${recipes.get(id)}, ${path}`);
    recipes.set(id, path);
  }
  const pages = [];
  for (const path of files.filter((path) =>
    /^docs\/en\/ui-libraries\/brutalist\/.+\.mdx$/.test(path)
  )) {
    const source = await readFile(join(contentRoot, path), 'utf8');
    // Code examples and comments cannot authorize an executable route binding.
    const live = source
      .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    const demos = [...live.matchAll(/<PrototypePreviewer\b([\s\S]*?)\/>/g)].map((match) => {
      const ids = [...match[1].matchAll(/\bdemoId\s*=\s*(["'])([^"']+)\1/g)];
      if (ids.length !== 1 || /\{\s*\.\.\./.test(match[1]))
        throw new Error(`Unresolved literal Previewer recipe binding: ${path}`);
      return ids[0][2];
    });
    pages.push({ path, source, demos });
  }
  return Object.fromEntries(
    families.map((family) => {
      const recipeId = manifest.families[family]?.recipeId;
      const recipe = recipes.get(recipeId);
      if (!recipe) throw new Error(`Missing unique authored recipe for ${family}: ${recipeId}`);
      const bound = pages.filter((page) => page.demos.includes(recipeId));
      if (bound.length !== 1 || bound[0].demos.filter((id) => id === recipeId).length !== 1)
        throw new Error(
          `Expected one source-bound route/Previewer for ${recipeId}; found ${bound.length}.`
        );
      const page = bound[0];
      const frontmatter = /^---\s*\n([\s\S]*?)\n---/.exec(page.source)?.[1] ?? '';
      if (/^\s*slug\s*:/m.test(frontmatter))
        throw new Error(`Unsupported custom route slug in ${page.path}`);
      return [
        family,
        {
          recipeId,
          recipePath: `apps/www/src/content/${recipe}`,
          pagePath: `apps/www/src/content/${page.path}`,
          route: `/${page.path.slice('docs/'.length, -'.mdx'.length)}/`,
        },
      ];
    })
  );
}
