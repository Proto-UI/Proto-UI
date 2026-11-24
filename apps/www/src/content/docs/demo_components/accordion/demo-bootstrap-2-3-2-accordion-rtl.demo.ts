import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'w-full max-w-md mx-auto min-w-0 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'bootstrap-2-3-2-accordion-root',
        props: { defaultOpenItems: ['item-1'], direction: 'rtl' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'item-1' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['كيف يمكنني إعادة تعيين كلمة المرور؟'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: [
                  'انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'bootstrap-2-3-2-accordion-item',
            props: { value: 'item-2' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'bootstrap-2-3-2-accordion-trigger',
                    children: ['هل يمكنني تغيير خطة الاشتراك الخاصة بي؟'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'bootstrap-2-3-2-accordion-content',
                children: ['نعم، يمكنك ترقية خطتك أو تخفيضها في أي وقت من إعدادات الحساب.'],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default demo;
