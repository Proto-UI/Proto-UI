import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex min-w-0 flex-wrap items-center justify-center gap-4 p-4',
    attrs: { dir: 'rtl', lang: 'ar' },
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-alert-dialog-root',
        props: {
          a11yLabel: 'تأكيد حذف الحساب',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-trigger',
            props: { variant: 'outline' },
            children: ['إظهار الحوار'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-content',
            children: [
              {
                kind: 'box',
                className: 'grid gap-6',
                attrs: { dir: 'rtl', lang: 'ar' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-header',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-alert-dialog-title',
                        children: ['هل أنت متأكد تمامًا؟'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-alert-dialog-description',
                        children: [
                          'لا يمكن التراجع عن هذا الإجراء. سيؤدي هذا إلى حذف حسابك نهائيًا من خوادمنا.',
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-footer',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-alert-dialog-cancel',
                        children: ['إلغاء'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-alert-dialog-action',
                        children: ['متابعة'],
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
        prototypeId: 'shadcn-alert-dialog-root',
        props: {
          a11yLabel: 'السماح للملحق بالاتصال',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-trigger',
            props: { variant: 'outline' },
            children: ['إظهار الحوار (صغير)'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-mask',
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-alert-dialog-content',
            props: { size: 'sm' },
            children: [
              {
                kind: 'box',
                className: 'grid gap-6',
                attrs: { dir: 'rtl', lang: 'ar' },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-header',
                    props: { align: 'center' },
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-alert-dialog-title',
                        children: ['السماح للملحق بالاتصال؟'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-alert-dialog-description',
                        children: ['هل تريد السماح لملحق USB بالاتصال بهذا الجهاز؟'],
                      },
                    ],
                  },
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-alert-dialog-footer',
                    children: [
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-alert-dialog-cancel',
                        children: ['عدم السماح'],
                      },
                      {
                        kind: 'proto',
                        prototypeId: 'shadcn-alert-dialog-action',
                        children: ['السماح'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
