import { withShadcnRheaDemo } from '../../shadcn-demo-style';
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    attrs: { dir: 'rtl' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline' },
        children: ['زر'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'destructive' },
        children: ['حذف'],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'outline' },
        children: [
          'إرسال',
          {
            kind: 'proto',
            prototypeId: 'lucide-arrow-right-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none rtl:rotate-180',
            props: { size: 16 },
          },
        ],
      },
      {
        kind: 'proto',
        prototypeId: 'shadcn-button',
        props: { variant: 'secondary', disabled: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'lucide-loader-circle-icon',
            className: 'inline-flex size-4 shrink-0 pointer-events-none animate-spin',
            props: { size: 16 },
          },
          'جاري التحميل',
        ],
      },
    ],
  },
});
