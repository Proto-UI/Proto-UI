import type { DemoSpec } from '../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-5 p-2 text-start',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: {
              size: '4xl',
              font: 'heading',
              weight: 'bold',
              leading: 'tight',
              tracking: 'tight',
            },
            children: ['Taxing Laughter: The Joke Tax Chronicles'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'xl', tone: 'muted', leading: 'relaxed' },
            children: [
              'Once upon a time, in a far-off land, a restless court looked for a fairer way to fund the royal treasury.',
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'border-b border-border pb-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: {
              size: '2xl',
              font: 'heading',
              weight: 'semibold',
              leading: 'tight',
              tracking: 'tight',
            },
            children: ['The King’s Plan'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-baseline gap-x-1 leading-relaxed',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'base', leading: 'relaxed' },
            children: ['The king thought long and hard, and finally proposed '],
          },
          {
            kind: 'box',
            tag: 'a',
            attrs: { href: '#examples' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'base', weight: 'medium', decoration: 'underline' },
                children: ['a brilliant plan'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'base', leading: 'relaxed' },
            children: [': taxing every pun and one-liner told in the kingdom.'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'border-s-2 border-border ps-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'base', emphasis: 'italic', leading: 'relaxed' },
            children: [
              '“After all, everyone enjoys a good joke, so it is only fair that they pay for the privilege.”',
            ],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2',
        children: [
          {
            kind: 'box',
            tag: 'span',
            className: 'rounded bg-muted px-2 py-0.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', font: 'mono', weight: 'semibold', leading: 'size' },
                children: ['@proto.ui/prototypes-shadcn/text'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'sm', tone: 'muted' },
            children: ['Shadcn Rhea · Geist & CJK fallback ready'],
          },
        ],
      },
    ],
  },
};

export default withShadcnRheaDemo(demo);
