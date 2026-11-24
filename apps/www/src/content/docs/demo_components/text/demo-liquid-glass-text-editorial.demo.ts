import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

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
        props: { size: 'xl', tone: 'muted', leading: 'relaxed' },
        children: [
          'Content-layer prose stays unobstructed and selectable beneath floating Liquid Glass navigation.',
        ],
      },
      {
        kind: 'box',
        className: 'border-s-2 border-border ps-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-text-root',
            rootTag: 'span',
            props: { size: 'base', emphasis: 'italic', leading: 'relaxed' },
            children: ['“Reserve translucency for controls; keep reading surfaces calm.”'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-3',
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: 'rounded-md bg-muted px-2 py-0.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-text-root',
                rootTag: 'span',
                props: { size: 'sm', font: 'mono', weight: 'medium', leading: 'size' },
                children: ['LiquidGlassTextRoot'],
              },
            ],
          },
          {
            kind: 'box',
            tag: 'a',
            attrs: { href: '#api' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'liquid-glass-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'medium', decoration: 'underline' },
                children: ['Inspect API'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-text-root',
            rootTag: 'span',
            props: { size: 'sm', tone: 'muted', decoration: 'line-through' },
            children: ['Legacy blurred copy'],
          },
        ],
      },
    ],
  },
};

export default demo;
