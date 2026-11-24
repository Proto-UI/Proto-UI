import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

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
        props: { size: 'xl', tone: 'muted', weight: 'medium', leading: 'relaxed' },
        children: [
          'Lead summary copy sets expectations before the reader dives into detailed specs.',
        ],
      },
      {
        kind: 'box',
        className: 'border-s-4 border-border ps-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'brutalist-text-root',
            rootTag: 'span',
            props: { size: 'base', weight: 'medium', emphasis: 'italic', leading: 'relaxed' },
            children: ['“Keep decorative borders on structural frames, never on passive text.”'],
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
                prototypeId: 'brutalist-text-root',
                rootTag: 'span',
                props: { size: 'sm', font: 'mono', weight: 'semibold', leading: 'size' },
                children: ['BRUTALIST_THEME'],
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
                prototypeId: 'brutalist-text-root',
                rootTag: 'span',
                props: { size: 'sm', weight: 'bold', decoration: 'underline' },
                children: ['Read API props'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'brutalist-text-root',
            rootTag: 'span',
            props: { size: 'sm', tone: 'muted', decoration: 'line-through' },
            children: ['Deprecated label'],
          },
        ],
      },
    ],
  },
};

export default demo;
