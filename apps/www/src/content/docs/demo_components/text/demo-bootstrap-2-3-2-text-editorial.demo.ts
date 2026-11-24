import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-4 p-2 text-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: { size: 'xl', weight: 'normal', leading: 'relaxed' },
        children: [
          'Lead copy makes an introductory paragraph stand out with generous line spacing.',
        ],
      },
      {
        kind: 'box',
        className: 'border-s-4 border-border ps-4',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-text-root',
            rootTag: 'span',
            props: { size: 'base', emphasis: 'italic', leading: 'normal' },
            children: ['“Simplicity and predictable typography keep web applications timeless.”'],
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
                prototypeId: 'bootstrap-2-3-2-text-root',
                rootTag: 'span',
                props: { size: 'sm', font: 'mono', leading: 'size' },
                children: ['Bootstrap232TextRoot'],
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
                prototypeId: 'bootstrap-2-3-2-text-root',
                rootTag: 'span',
                props: { size: 'sm', decoration: 'underline' },
                children: ['Browse API reference'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-text-root',
            rootTag: 'span',
            props: { size: 'sm', tone: 'muted', decoration: 'line-through' },
            children: ['Deprecated .muted class'],
          },
        ],
      },
    ],
  },
};

export default demo;
