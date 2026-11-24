import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

// Showcases Apple Liquid Glass HIG hierarchy: crisp text over a single translucent
// glass control layer, prominent tinted ink, and opaque content canvas—never glass-on-glass.
const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'grid w-full max-w-xl grid-cols-1 gap-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6 sm:grid-cols-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-surface-root',
        props: { variant: 'outline', material: 'auto', radius: 'xl' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'semibold', tone: 'inherit' },
                children: ['Regular Glass'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-text-root',
                rootTag: 'span',
                props: { size: 'xs', tone: 'muted' },
                children: ['Single glass layer with crisp inherited ink.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-surface-root',
        props: { variant: 'solid', radius: 'xl', border: 'none' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'semibold', tone: 'inherit' },
                children: ['Prominent Tint'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-text-root',
                rootTag: 'span',
                props: { size: 'xs', tone: 'inherit' },
                children: ['tone="inherit" preserves white primary ink.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-surface-root',
        props: { variant: 'secondary', material: 'opaque', radius: 'xl' },
        children: [
          {
            kind: 'box',
            className: 'flex flex-col gap-1 p-4 text-start',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'semibold', tone: 'default' },
                children: ['Opaque Canvas'],
              },
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-text-root',
                rootTag: 'span',
                props: { size: 'xs', tone: 'muted' },
                children: ['High-contrast fallback & reading layer.'],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
