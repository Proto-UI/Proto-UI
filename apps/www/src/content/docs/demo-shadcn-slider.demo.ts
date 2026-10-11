import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
type Proto = Extract<DemoNode, { kind: 'proto' }>;
const part = (part: string, ref: string, children: Proto['children'] = [], props = {}): Proto => ({
  kind: 'proto',
  prototypeId: `shadcn-slider-${part}`,
  ref,
  props,
  children,
});
const row = (
  name: string,
  title: string,
  props: Record<string, unknown> = {},
  field = false
): DemoNode => {
  const control = part(
    'root',
    `${name}-root`,
    [
      part('track', `${name}-track`, [
        part('indicator', `${name}-indicator`),
        part(field ? 'field-thumb' : 'thumb', `${name}-thumb`),
      ]),
    ],
    { defaultValue: 25, min: 0, max: 100, step: 5, ariaLabel: title, ...props }
  );
  return {
    kind: 'box',
    attrs: { 'data-slider-case': name },
    className: 'grid gap-3',
    children: [
      { kind: 'box', className: 'text-sm font-medium', children: [title] },
      {
        kind: 'box',
        className: name === 'vertical' ? 'h-40 w-7' : 'w-full py-2',
        children: [
          field
            ? { kind: 'proto', prototypeId: 'shadcn-field-root', props: {}, children: [control] }
            : control,
        ],
      },
    ],
  };
};
export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 gap-6 p-4',
    children: [
      row('horizontal', 'Volume · 音量'),
      row('disabled', 'Disabled · 禁用', { disabled: true }),
      row('readonly', 'Read only · 只读', { readOnly: true }),
      row('rtl', 'RTL · 从右向左', { direction: 'rtl' }),
      row('field', 'FieldThumb · 字段滑块', {}, true),
      row('vertical', 'Vertical · 垂直', { orientation: 'vertical' }),
    ],
  },
} satisfies DemoSpec;
