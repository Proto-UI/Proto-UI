import type { DemoSpec } from '../../components/PrototypePreviewer/demo-types';

// Preserves LIQUID_GLASS_MANIFEST closure: strictly uses liquid-glass-text-root.
const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4 p-2 text-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: {
          size: '3xl',
          font: 'heading',
          weight: 'semibold',
          leading: 'tight',
          tracking: 'tight',
        },
        children: ['Spatial Clarity on Content Canvas'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: { size: 'base', font: 'body', leading: 'relaxed' },
        children: [
          'In Liquid Glass interfaces, text stays crisp on the content layer or inherits high-contrast ink inside a single floating glass control—never stacking glass on glass.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: { size: 'sm', tone: 'muted', emphasis: 'italic' },
        children: ['Optical system typography · SF-first sans & monospace fallback'],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-text-root',
        rootTag: 'span',
        props: { size: 'sm', font: 'mono', tracking: 'tight', decoration: 'underline' },
        children: ['@proto.ui/prototypes-liquid-glass/text'],
      },
    ],
  },
};

export default demo;
