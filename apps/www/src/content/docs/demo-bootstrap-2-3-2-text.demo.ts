import type { DemoSpec } from '../../components/PrototypePreviewer/demo-types';

// Preserves BOOTSTRAP_232_MANIFEST closure: strictly uses bootstrap-2-3-2-text-root.
const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-3 p-2 text-start',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: {
          size: '2xl',
          font: 'heading',
          weight: 'bold',
          leading: 'relaxed',
          tracking: 'tight',
        },
        children: ['Classic Bootstrap 2.3.2 Heading (24.5px / 40px)'],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: { size: 'xl', font: 'body', weight: 'normal', leading: 'relaxed' },
        children: [
          'A crisp lead paragraph introduces the page before settling into the classic 20/14 body line-height rhythm.',
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-text-root',
        rootTag: 'span',
        props: { size: 'base', font: 'body', leading: 'normal' },
        children: [
          'Body copy renders with Helvetica Neue, Helvetica, and Arial at the archived 1.4286 line-height ratio so dense forms and tables remain balanced.',
        ],
      },
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-3 pt-1',
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-text-root',
            rootTag: 'span',
            props: { size: 'sm', font: 'mono', tracking: 'tight', decoration: 'underline' },
            children: ['@proto.ui/prototypes-bootstrap-2-3-2/text'],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-text-root',
            rootTag: 'span',
            props: { size: 'sm', tone: 'muted', emphasis: 'italic' },
            children: ['Muted helper copy · #666666'],
          },
        ],
      },
    ],
  },
};

export default demo;
