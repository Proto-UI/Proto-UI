// Common, deliberately small A2UI subset. Both realizations receive the same
// projection; there is no path-specific schema, fallback, or semantic repair.
export const CATALOG = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/** @typedef {Record<string, unknown>} InputObject */
/** @typedef {{ title: string, child: string }} Tab */
/** @typedef {{ id: string, component: 'Tabs', tabs: Tab[], '@accessibility'?: { label?: string } }} TabsComponent */
/** @typedef {{ id: string, component: 'Text', text: string }} TextComponent */
/** @typedef {{ surfaceId: string, catalogId: string, components: (TabsComponent | TextComponent)[] }} Surface */
/** @typedef {{ id: string, label: string | undefined, tabs: { value: string, title: string, text: string }[] }} ProjectedSurface */

/** @param {unknown} value @param {string} subject @returns {InputObject} */
function requireObject(value, subject) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Expected an object for ${subject}`);
  return /** @type {InputObject} */ (value);
}

/** @param {InputObject} value @param {string[]} allowed @param {string} subject */
function requireKeys(value, allowed, subject) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`Unsupported ${subject} field: ${key}`);
  }
}

/** @param {unknown} value @returns {ProjectedSurface} */
export function projectSurface(value) {
  const surface = requireObject(value, 'surface');
  if (surface.catalogId !== CATALOG) throw new Error('Unsupported catalog');
  requireKeys(surface, ['surfaceId', 'catalogId', 'components'], 'surface');
  if (typeof surface.surfaceId !== 'string' || !Array.isArray(surface.components))
    throw new Error('Expected a surface ID and explicit components');
  /** @type {Map<string, InputObject>} */
  const components = new Map();
  for (const value of surface.components) {
    const item = requireObject(value, 'component');
    if (typeof item.id !== 'string' || components.has(item.id))
      throw new Error('Component IDs must be explicit and unique');
    components.set(item.id, item);
  }
  const root = components.get('root');
  if (root?.component !== 'Tabs' || !Array.isArray(root.tabs) || root.tabs.length === 0)
    throw new Error('The measured root must be nonempty Tabs');
  requireKeys(root, ['id', 'component', 'tabs', '@accessibility'], 'Tabs');
  const accessibility =
    root['@accessibility'] === undefined
      ? undefined
      : requireObject(root['@accessibility'], 'accessibility');
  if (accessibility) requireKeys(accessibility, ['label'], 'accessibility');
  const label = accessibility?.label;
  if (label !== undefined && typeof label !== 'string')
    throw new Error('Unsupported dynamic accessibility label');
  const used = new Set(['root']);
  const tabs = root.tabs.map((value) => {
    const tab = requireObject(value, 'tab');
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

/** @param {unknown} value @returns {asserts value is Surface} */
function assertSurface(value) {
  projectSurface(value);
}

/**
 * External messages enter as unknown; the common validator admits the same
 * literal subset before either renderer receives a typed surface.
 * @param {Surface | null} current
 * @param {unknown} value
 * @param {Set<string>} retiredIds
 * @returns {Surface | null}
 */
export function applyMessage(current, value, retiredIds = new Set()) {
  const message = requireObject(value, 'message');
  if (message.version !== '1.0') throw new Error('Unsupported protocol version');
  if (message.createSurface) {
    if (current) throw new Error('One surface only; delete the current owner first');
    const next = structuredClone(message.createSurface);
    assertSurface(next);
    if (retiredIds.has(next.surfaceId)) throw new Error('Use a fresh surface ID');
    return next;
  }
  if (message.deleteSurface) {
    const deletion = requireObject(message.deleteSurface, 'deleteSurface');
    if (!current || deletion.surfaceId !== current.surfaceId)
      throw new Error('Unknown surface deletion');
    retiredIds.add(current.surfaceId);
    return null;
  }
  if (message.updateComponents) {
    const update = requireObject(message.updateComponents, 'updateComponents');
    if (!current || update.surfaceId !== current.surfaceId)
      throw new Error('Unknown surface update');
    if (!Array.isArray(update.components)) throw new Error('Expected explicit update components');
    /** @type {Map<string, unknown>} */
    const components = new Map(current.components.map((item) => [item.id, item]));
    for (const value of update.components) {
      const item = requireObject(value, 'updated component');
      if (typeof item.id !== 'string') throw new Error('Component IDs must be explicit');
      components.set(item.id, structuredClone(item));
    }
    const next = { ...current, components: [...components.values()] };
    assertSurface(next);
    return next;
  }
  throw new Error('Unsupported message in this literal catalog study');
}
