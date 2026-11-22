// Common, deliberately small A2UI subset. Both realizations receive the same
// projection; there is no path-specific schema, fallback, or semantic repair.
export const CATALOG = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

function requireKeys(value, allowed, subject) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`Unsupported ${subject} field: ${key}`);
  }
}

export function projectSurface(surface) {
  if (surface.catalogId !== CATALOG) throw new Error('Unsupported catalog');
  requireKeys(surface, ['surfaceId', 'catalogId', 'components'], 'surface');
  if (typeof surface.surfaceId !== 'string' || !Array.isArray(surface.components))
    throw new Error('Expected a surface ID and explicit components');
  const components = new Map();
  for (const item of surface.components) {
    if (!item || typeof item.id !== 'string' || components.has(item.id))
      throw new Error('Component IDs must be explicit and unique');
    components.set(item.id, item);
  }
  const root = components.get('root');
  if (root?.component !== 'Tabs' || !Array.isArray(root.tabs) || root.tabs.length === 0)
    throw new Error('The measured root must be nonempty Tabs');
  requireKeys(root, ['id', 'component', 'tabs', '@accessibility'], 'Tabs');
  const accessibility = root['@accessibility'];
  if (accessibility) requireKeys(accessibility, ['label'], 'accessibility');
  const label = accessibility?.label;
  if (label !== undefined && typeof label !== 'string')
    throw new Error('Unsupported dynamic accessibility label');
  const used = new Set(['root']);
  const tabs = root.tabs.map((tab) => {
    requireKeys(tab, ['title', 'child'], 'tab');
    if (typeof tab.title !== 'string') throw new Error('Unsupported dynamic tab title');
    if (typeof tab.child !== 'string' || used.has(tab.child))
      throw new Error('Tab children must have distinct explicit IDs');
    const content = components.get(tab.child);
    if (content?.component !== 'Text' || typeof content.text !== 'string')
      throw new Error('Unsupported child: this study admits literal Text only');
    requireKeys(content, ['id', 'component', 'text'], 'Text');
    used.add(tab.child);
    return { value: tab.child, title: tab.title, text: content.text };
  });
  if (used.size !== components.size) throw new Error('Unconsumed components are unsupported');
  return { id: surface.surfaceId, label, tabs };
}

export function applyMessage(current, message, retiredIds = new Set()) {
  if (message.version !== '1.0') throw new Error('Unsupported protocol version');
  if (message.createSurface) {
    if (current) throw new Error('One surface only; delete the current owner first');
    if (retiredIds.has(message.createSurface.surfaceId)) throw new Error('Use a fresh surface ID');
    const next = structuredClone(message.createSurface);
    projectSurface(next);
    return next;
  }
  if (message.deleteSurface) {
    if (!current || message.deleteSurface.surfaceId !== current.surfaceId)
      throw new Error('Unknown surface deletion');
    retiredIds.add(current.surfaceId);
    return null;
  }
  if (message.updateComponents) {
    const update = message.updateComponents;
    if (!current || update.surfaceId !== current.surfaceId) throw new Error('Unknown surface update');
    const components = new Map(current.components.map((item) => [item.id, item]));
    for (const item of update.components) components.set(item.id, structuredClone(item));
    const next = { ...current, components: [...components.values()] };
    projectSurface(next);
    return next;
  }
  throw new Error('Unsupported message in this literal catalog study');
}
