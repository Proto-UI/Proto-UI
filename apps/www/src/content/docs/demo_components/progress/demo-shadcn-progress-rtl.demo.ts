import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const LOCALES = {
  ar: { dir: 'rtl' as const, label: 'تقدم الرفع', valueText: '٥٦٪' },
  he: { dir: 'rtl' as const, label: 'התקדמות העלאה', valueText: '56%' },
  en: { dir: 'ltr' as const, label: 'Upload progress', valueText: '56%' },
};

export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full min-w-0 items-center justify-center p-6',
    children: [
      {
        kind: 'box',
        className: 'flex w-full max-w-sm min-w-0 flex-col gap-4',
        children: [
          {
            kind: 'box',
            className: 'flex flex-wrap items-center gap-2',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                ref: 'langAr',
                props: { variant: 'default', size: 'sm' },
                children: ['العربية (RTL)'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                ref: 'langHe',
                props: { variant: 'outline', size: 'sm' },
                children: ['עברית (RTL)'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-button',
                ref: 'langEn',
                props: { variant: 'outline', size: 'sm' },
                children: ['English (LTR)'],
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-progress-root',
            ref: 'progress',
            props: { dir: 'rtl', value: 56, min: 0, max: 100, valueText: '٥٦٪' },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-progress-label',
                children: [
                  { kind: 'box', tag: 'span', ref: 'labelText', children: ['تقدم الرفع'] },
                ],
              },
              { kind: 'proto', prototypeId: 'shadcn-progress-value' },
              {
                kind: 'proto',
                prototypeId: 'shadcn-progress-track',
                children: [{ kind: 'proto', prototypeId: 'shadcn-progress-indicator' }],
              },
            ],
          },
        ],
      },
    ],
  },
  setup({ api, refs }) {
    const select = (lang: keyof typeof LOCALES) => {
      const entry = LOCALES[lang];
      api.setProps('progress', {
        dir: entry.dir,
        value: 56,
        min: 0,
        max: 100,
        valueText: entry.valueText,
      });
      if (refs.labelText) refs.labelText.textContent = entry.label;
      api.setProps('langAr', { variant: lang === 'ar' ? 'default' : 'outline', size: 'sm' });
      api.setProps('langHe', { variant: lang === 'he' ? 'default' : 'outline', size: 'sm' });
      api.setProps('langEn', { variant: lang === 'en' ? 'default' : 'outline', size: 'sm' });
    };
    api.setProps('langAr', { onClick: () => select('ar') });
    api.setProps('langHe', { onClick: () => select('he') });
    api.setProps('langEn', { onClick: () => select('en') });
  },
} satisfies DemoSpec);
