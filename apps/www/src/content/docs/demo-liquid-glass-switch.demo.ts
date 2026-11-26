import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

type ProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function part(
  component: string,
  name: string,
  ref: string,
  props: Record<string, unknown> = {},
  children: DemoChild[] = []
): ProtoNode {
  return { kind: 'proto', prototypeId: `liquid-glass-${component}-${name}`, ref, props, children };
}

function row(ref: string, text: string, props: Record<string, unknown>): DemoNode {
  const key = `switch-${ref}`;
  return {
    kind: 'box',
    className: 'flex min-w-0 items-center gap-3',
    children: [
      {
        ...part('switch', 'root', ref, props, [part('switch', 'thumb', `${ref}Part`)]),
        associations: { controlLabel: key },
      },
      {
        ...part('label', 'root', `${ref}Label`, { naming: true, activation: true }, [text]),
        associations: { controlLabel: key },
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full max-w-md min-w-0 gap-4',
    children: [
      row('unchecked', 'Airplane Mode', { defaultChecked: false }),
      row('checked', 'Enable notifications', { defaultChecked: true }),
      row('disabled', 'Archived alerts (disabled)', { defaultChecked: true, disabled: true }),
      row('draggable', 'Draggable toggle', { defaultChecked: false, draggable: true }),
      row('opaque', 'Opaque surface fallback', { defaultChecked: true, material: 'opaque' }),
      row('controlled', 'Managed policy (controlled)', { checked: false }),
    ],
  },
} satisfies DemoSpec;
