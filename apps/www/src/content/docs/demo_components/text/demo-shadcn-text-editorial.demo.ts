import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4 p-2 text-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: { size: 'xl', tone: 'muted', leading: 'relaxed' },
        children: [
          'A modal dialog that interrupts the user with important content and expects a response.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-text-root',
        rootTag: 'span',
        props: { size: 'lg', weight: 'semibold', leading: 'snug' },
        children: ['Are you absolutely sure?'],
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
            children: ['“Clear typography turns complex workflows into calm reading.”'],
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
            className: 'rounded bg-muted px-2 py-0.5',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', font: 'mono', weight: 'semibold', leading: 'size' },
                children: ['npx @proto.ui/cli add react shadcn-text'],
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
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'medium', decoration: 'underline' },
                children: ['View API table'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'sm', tone: 'muted', decoration: 'line-through' },
            children: ['Legacy 13px copy'],
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-col gap-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'sm', weight: 'medium', leading: 'tight' },
            children: ['Email address'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'sm', tone: 'muted' },
            children: ['Enter your work email to receive release notifications.'],
          },
        ],
      },
    ],
  },
};

export default withShadcnRheaDemo(demo);
