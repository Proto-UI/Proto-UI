import type { DemoChild, DemoNode, DemoSpec } from '../../components/PrototypePreviewer/demo-types';

type ProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function checkboxRow(
  ref: string,
  text: string,
  props: Record<string, unknown>,
  description?: string
): DemoNode {
  const key = `liquid-checkbox-hero-${ref}`;
  const labelNode: ProtoNode = {
    kind: 'proto',
    prototypeId: 'liquid-glass-label-root',
    ref: `${ref}Label`,
    props: { naming: true, activation: true },
    associations: { controlLabel: key },
    children: [text],
  };
  const labelChildren: DemoChild[] = description
    ? [
        labelNode,
        {
          kind: 'box',
          className: 'text-xs text-muted-foreground',
          children: [description],
        },
      ]
    : [labelNode];

  return {
    kind: 'box',
    className: 'flex min-w-0 items-start gap-3',
    children: [
      {
        kind: 'proto',
        prototypeId: 'liquid-glass-checkbox-root',
        ref,
        props,
        associations: { controlLabel: key },
        children: [
          {
            kind: 'proto',
            prototypeId: 'liquid-glass-checkbox-indicator',
            ref: `${ref}Indicator`,
          },
        ],
      },
      {
        kind: 'box',
        className: 'grid min-w-0 gap-0.5 leading-snug',
        children: labelChildren,
      },
    ],
  };
}

export default {
  type: 'demo',
  root: {
    kind: 'box',
    className:
      'w-full max-w-md rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
    children: [
      {
        kind: 'box',
        className: 'grid w-full min-w-0 gap-4 rounded-xl bg-background/70 p-4 shadow-sm',
        children: [
          checkboxRow('terms', 'Accept terms and conditions', { defaultChecked: false }),
          checkboxRow(
            'updates',
            'Subscribe to release notes',
            { defaultChecked: true },
            'Receive concise monthly updates when new primitives ship.'
          ),
          checkboxRow(
            'channels',
            'Select all notification channels',
            { defaultIndeterminate: true },
            'Email is enabled while mobile push alerts are paused.'
          ),
          checkboxRow('disabled', 'Enable archived alerts', {
            defaultChecked: true,
            disabled: true,
          }),
          checkboxRow('opaque', 'Use high-contrast opaque surface', {
            defaultChecked: true,
            material: 'opaque',
          }),
        ],
      },
    ],
  },
} satisfies DemoSpec;
