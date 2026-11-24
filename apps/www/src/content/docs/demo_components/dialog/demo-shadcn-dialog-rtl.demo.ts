import { withShadcnRheaDemo } from '../../shadcn-demo-style';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-dialog-root',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-trigger',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                props: { variant: 'outline' },
                children: ['فتح الحوار'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-dialog-content',
            children: [
              {
                kind: 'box',
                attrs: { dir: 'rtl' },
                className: 'grid gap-4 text-start',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dialog-header',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-dialog-title',
                        children: ['تعديل الملف الشخصي'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-dialog-description',
                        children: ['قم بإجراء تغييرات على ملفك الشخصي هنا. انقر فوق حفظ عند الانتهاء.'],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'grid gap-3',
                    children: [
                      {
                        kind: 'box',
                        className: 'grid gap-1.5',
                        children: [
                          {
                            kind: 'box',
                            tag: 'span',
                            className: 'text-sm font-medium text-foreground',
                            children: ['الاسم'],
                          },
                          {
                            kind: 'box',
                            className:
                              'rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
                            children: ['Pedro Duarte'],
                          },
                        ],
                      },
                      {
                        kind: 'box',
                        className: 'grid gap-1.5',
                        children: [
                          {
                            kind: 'box',
                            tag: 'span',
                            className: 'text-sm font-medium text-foreground',
                            children: ['اسم المستخدم'],
                          },
                          {
                            kind: 'box',
                            className:
                              'rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
                            children: ['@peduarte'],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-dialog-footer',
                    children: [
                      {
                        kind: 'box',
                        className: 'min-w-0 max-w-full',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-dialog-close',
                            children: [
                              {
                                kind: 'proto',
                                prototypeId: 'shadcn-button',
                                props: { variant: 'outline', wrap: true },
                                children: ['إلغاء'],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        kind: 'box',
                        className: 'min-w-0 max-w-full',
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: 'shadcn-dialog-close',
                            children: [
                              {
                                kind: 'proto',
                                prototypeId: 'shadcn-button',
                                props: { wrap: true },
                                children: ['حفظ التغييرات'],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-dialog-close-icon',
              },
            ],
          },
        ],
      },
    ],
  },
});
