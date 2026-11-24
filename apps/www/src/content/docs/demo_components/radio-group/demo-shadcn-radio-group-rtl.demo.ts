import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type {
  DemoNode,
  DemoSetupContext,
} from '../../../../components/PrototypePreviewer/demo-types';

function option(value: string, label: string, description: string): DemoNode {
  const key = `rtl-${value}`;
  return {
    kind: 'box',
    className: 'flex items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-item',
        ref: key,
        className: 'mt-0.5',
        props: { value },
        associations: { controlLabel: key },
        children: [{ kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' }],
      },
      {
        kind: 'box',
        className: 'grid gap-1 text-start',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-label-root',
            ref: `${key}-label`,
            associations: { controlLabel: key },
            className: 'text-sm font-medium leading-none',
            children: [label],
          },
          {
            kind: 'box',
            className: 'text-sm text-muted-foreground',
            children: [description],
          },
        ],
      },
    ],
  };
}

export default withShadcnRheaDemo({
  type: 'demo',
  setup({ refs }: DemoSetupContext) {
    if (refs.rtlContainer) {
      refs.rtlContainer.dir = 'rtl';
    }
  },
  root: {
    kind: 'box',
    ref: 'rtlContainer',
    className: 'flex justify-center p-2',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-radio-group-root',
        ref: 'rtlGroup',
        className: 'w-fit max-w-sm',
        props: { a11yLabel: 'كثافة العرض', defaultValue: 'comfortable' },
        children: [
          option('default', 'افتراضي', 'تباعد قياسي لمعظم حالات الاستخدام.'),
          option('comfortable', 'مريح', 'مساحة أكبر بين العناصر.'),
          option('compact', 'مضغوط', 'تباعد أدنى للتخطيطات الكثيفة.'),
        ],
      },
    ],
  },
});
