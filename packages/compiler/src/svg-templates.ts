import type { DataType } from './data-types';

/** Checked public SVG shapes from Core's RendererHandle, independent of a component. */
export const SVG_SCALAR_TYPE: DataType = { kind: 'union', members: ['string', 'number'] };
const shared = [
  'fill',
  'stroke',
  'strokeWidth',
  'strokeLinecap',
  'strokeLinejoin',
  'fillRule',
  'clipRule',
  'opacity',
].map((name) => ({ name, type: SVG_SCALAR_TYPE, optional: true }));

export const SVG_ROOT_PROPS_TYPE: DataType = {
  kind: 'record',
  fields: [
    { name: 'viewBox', type: 'string' },
    ...['width', 'height', 'aria-hidden'].map((name) => ({
      name,
      type: SVG_SCALAR_TYPE,
      optional: true,
    })),
    ...shared,
  ],
};
export const SVG_PATH_PROPS_TYPE: DataType = {
  kind: 'record',
  fields: [{ name: 'd', type: 'string' }, ...shared],
};

export const SVG_SOURCE_FACTORIES = {
  root: { tag: 'svg', props: SVG_ROOT_PROPS_TYPE },
  path: { tag: 'path', props: SVG_PATH_PROPS_TYPE },
} as const;

/** Only the reached, implemented constructors are materialized in native source. */
export function reactSvgFactories(prefix: string): string {
  const factories = Object.entries(SVG_SOURCE_FACTORIES).map(([name, { tag, props }]) => {
    if (typeof props === 'string' || props.kind !== 'record')
      throw new Error('Expected finite SVG props.');
    const allowed = props.fields.map((field) => field.name);
    const required = props.fields.filter((field) => !field.optional).map((field) => field.name);
    return `      ${name}(props: Record<string, unknown>${name === 'root' ? ', children: unknown = null' : ''}) {
        ensurePhase('render');
        if (!props || typeof props !== 'object' || Array.isArray(props)) throw new Error('[Template][SVG] ${tag} props must be an object.');
        if (Object.keys(props).some(key => !${JSON.stringify(allowed)}.includes(key))) throw new Error('[Template][SVG] ${tag} contains an unsupported prop.');
        for (const key of ${JSON.stringify(required)}) if (props[key] === undefined || props[key] === null || props[key] === '') throw new Error('[Template][SVG] ${tag} requires non-empty prop ' + key + '.');
        const normalized = normalize(${name === 'root' ? 'children' : 'null'});
        return ${prefix}React.createElement(${JSON.stringify(tag)}, { ...props, key: elementSequence++ }, ...(Array.isArray(normalized) ? normalized : [normalized]));
      },`;
  });
  return `    svg: Object.freeze({\n${factories.join('\n')}\n    }),\n`;
}
