export type ShaderVariant = 'copy' | 'tint' | 'both' | 'none';
/** Public source controls vary the pass closure, without changing any host helper. */
export function shaderVariantSource(kind: ShaderVariant) {
  const passes = [];
  if (kind === 'copy' || kind === 'both')
    passes.push({ id: 'copied', kernel: 'copy-rgba8-v1', input: '$source' });
  if (kind === 'tint' || kind === 'both')
    passes.push({
      id: 'tinted',
      kernel: 'tint-rgba8-v1',
      input: kind === 'both' ? 'copied' : '$source',
      tint: [0.5, 1, 0.25, 0.5],
    });
  const declaration = {
    version: 1,
    source: {
      kind: 'owned-pixels',
      width: 1,
      height: 1,
      pixels: [128, 64, 32, 128],
      colorSpace: 'linear-srgb',
      alpha: 'premultiplied',
      origin: 'top-left',
    },
    passes,
    output: passes.at(-1)?.id,
    fallback: [0.15, 0.2, 0.25, 1],
  };
  return `import {definePrototype} from '@proto.ui/core';export default definePrototype({name:'shader-${kind}-consumer',setup(def){${kind === 'none' ? '' : `def.feedback.material.shader(${JSON.stringify(declaration)});`}return r=>r.el('button','ordinary child');}});`;
}
