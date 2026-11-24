import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'w-full max-w-xs',
    attrs: {
      dir: 'rtl',
    },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-field-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-label',
            children: ['التعليقات'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-textarea',
            props: {
              placeholder: 'تعليقاتك تساعدنا على التحسين...',
              rows: 4,
            },
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-field-description',
            children: ['شاركنا أفكارك حول خدمتنا.'],
          },
        ],
      },
    ],
  },
});
