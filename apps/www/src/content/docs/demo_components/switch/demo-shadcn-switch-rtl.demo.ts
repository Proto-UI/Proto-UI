import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'w-full max-w-sm',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        className: 'flex flex-row items-center justify-between gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex min-w-0 flex-1 flex-col gap-1',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-field-label',
                children: ['المشاركة عبر الأجهزة'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-field-description',
                children: ['يتم مشاركة التركيز عبر الأجهزة، ويتم إيقاف تشغيله عند مغادرة التطبيق.'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-switch',
            props: { direction: 'rtl', defaultChecked: true },
            children: [{ kind: 'proto', prototypeId: 'shadcn-switch-thumb' }],
          },
        ],
      },
    ],
  },
});
