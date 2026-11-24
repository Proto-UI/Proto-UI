import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'flex w-full max-w-sm flex-col gap-4 text-sm',
    children: [
      {
        kind: 'box',
        className: 'flex flex-col gap-1.5',
        children: [
          { kind: 'box', className: 'leading-none font-medium', children: ['Proto UI'] },
          {
            kind: 'box',
            className: 'text-muted-foreground',
            children: ['الأساس لنظام التصميم الخاص بك'],
          },
        ],
      },
      { kind: 'proto', prototypeId: 'shadcn-separator-root' },
      {
        kind: 'box',
        children: ['مجموعة من المكونات القابلة للتخصيص والتوسيع والبناء عليها.'],
      },
    ],
  },
});
