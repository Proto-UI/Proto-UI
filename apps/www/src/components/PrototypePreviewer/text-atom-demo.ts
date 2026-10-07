import type { DemoSpec } from './demo-types';

/** Consumer layout only. Typography comes from each real package Text prototype. */
export function createTextAtomDemo(
  family: 'base' | 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass'
): DemoSpec {
  const prototypeId = `${family}-text-root`;
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'flex max-w-xl flex-col gap-4',
      children: [
        {
          kind: 'proto',
          prototypeId,
          rootTag: 'span',
          props: { size: '3xl', font: 'heading', weight: 'semibold', leading: 'tight' },
          children: ['A reusable Text atom'],
        },
        {
          kind: 'proto',
          prototypeId,
          rootTag: 'span',
          props: { size: 'base', leading: 'relaxed' },
          children: [
            'Authored content stays readable and selectable. Text adds no extra interaction.',
          ],
        },
        {
          kind: 'proto',
          prototypeId,
          rootTag: 'span',
          props: { size: 'sm', tone: 'muted', emphasis: 'italic' },
          children: ['Supporting text uses the same input vocabulary.'],
        },
        {
          kind: 'proto',
          prototypeId,
          rootTag: 'span',
          props: { font: 'mono', decoration: 'underline', tracking: 'tight' },
          children: ['font: mono · tracking: tight'],
        },
      ],
    },
  };
}
