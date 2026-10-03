import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

// Consumer layout only: preserve the default 2.5rem target height and family
// paint while allowing long labels to grow vertically on narrow/enlarged text.
const textButtonLayout = {
  minWidth: '0',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  height: 'auto',
  minHeight: '2.5rem',
};

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 max-w-full flex-wrap items-center gap-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        surfaceStyle: textButtonLayout,
        ref: 'solidMain',
        children: ['Solid main'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        surfaceStyle: textButtonLayout,
        props: { variant: 'solid', color: 'mint' },
        children: ['Mint'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        surfaceStyle: textButtonLayout,
        props: { variant: 'solid', color: 'lavender' },
        children: ['Lavender'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        surfaceStyle: textButtonLayout,
        props: { variant: 'solid', color: 'coral' },
        children: ['Coral'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        surfaceStyle: textButtonLayout,
        props: { variant: 'solid', color: 'sky' },
        children: ['Sky'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        surfaceStyle: textButtonLayout,
        ref: 'surface',
        props: { variant: 'surface' },
        children: ['Surface'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        surfaceStyle: textButtonLayout,
        ref: 'destructive',
        props: { variant: 'destructive' },
        children: ['Destructive'],
      },
      { kind: 'proto', prototypeId: 'brutalist-button', props: { size: 'icon' }, children: ['!'] },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        surfaceStyle: textButtonLayout,
        ref: 'disabledSolid',
        props: { disabled: true },
        children: ['Disabled'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-button',
        surfaceStyle: textButtonLayout,
        ref: 'disabledSurface',
        props: { variant: 'surface', disabled: true },
        children: ['Disabled surface'],
      },
    ],
  },
} satisfies DemoSpec;
