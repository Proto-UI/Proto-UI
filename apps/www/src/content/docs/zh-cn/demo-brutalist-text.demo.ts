import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4 p-2 text-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'brutalist-text-root',
        rootTag: 'span',
        props: {
          size: '4xl',
          font: 'heading',
          weight: 'bold',
          leading: 'tight',
          tracking: 'tight',
        },
        children: ['Bold Print. Zero Ambiguity.'],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-text-root',
        rootTag: 'span',
        props: { size: 'base', font: 'body', weight: 'medium', leading: 'relaxed' },
        children: [
          'Brutalist typography pairs DM Sans 700 headings with DM Sans 500 body copy while keeping text passive, shadowless, and effortlessly selectable.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'brutalist-text-root',
        rootTag: 'span',
        props: { size: 'sm', tone: 'muted', weight: 'medium', emphasis: 'italic' },
        children: ['“Strong hierarchy comes from weight and scale, not decorative clutter.”'],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-3',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-text-root',
            rootTag: 'span',
            props: {
              size: 'sm',
              font: 'mono',
              weight: 'semibold',
              tracking: 'tight',
              decoration: 'underline',
            },
            children: ['npx @proto.ui/cli add wc brutalist-text'],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-text-root',
            rootTag: 'span',
            props: { size: 'xs', tone: 'muted', weight: 'medium' },
            children: ['DM Sans 500 / 700'],
          },
        ],
      },
    ],
  },
};

export default demo;
