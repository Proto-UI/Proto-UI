import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    attrs: { dir: 'rtl' },
    className: 'w-full max-w-md mx-auto min-w-0 p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-accordion-root',
        props: { defaultOpenItems: ['item-1'], direction: 'rtl' },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'item-1' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['كيف يمكنني إعادة تعيين كلمة المرور؟'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'انقر على «نسيت كلمة المرور» في صفحة تسجيل الدخول، أدخل عنوان بريدك الإلكتروني، وسنرسل لك رابطًا لإعادة تعيين كلمة المرور خلال دقائق.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'item-2' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['هل يمكنني تغيير خطة الاشتراك الخاصة بي؟'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'نعم، يمكنك ترقية أو تخفيض خطتك في أي وقت من إعدادات حسابك. ستظهر التغييرات في دورة الفوترة التالية.',
                ],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-accordion-item',
            props: { value: 'item-3' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-heading',
                props: { level: 3 },
                children: [
                  {
                    kind: 'proto',
                    prototypeId: 'shadcn-accordion-trigger',
                    children: ['ما هي طرق الدفع التي تقبلونها؟'],
                  },
                ],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-accordion-content',
                children: [
                  'نقبل جميع بطاقات الائتمان الرئيسية و PayPal والتحويلات المصرفية عبر شركاء الدفع المعتمدين لدينا.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export default withShadcnRheaDemo(demo);
