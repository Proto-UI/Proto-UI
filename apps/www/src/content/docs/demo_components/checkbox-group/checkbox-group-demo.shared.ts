import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

export type CheckboxGroupFamily = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';
export type CheckboxGroupExampleKind =
  | 'hero'
  | 'basic'
  | 'horizontal'
  | 'disabled'
  | 'controlled'
  | 'form';

type DemoProtoNode = Extract<DemoNode, { kind: 'proto' }>;

function atom(
  family: CheckboxGroupFamily,
  name: string,
  part: string,
  props: Record<string, unknown> = {},
  children: DemoChild[] = [],
  ref?: string
): DemoProtoNode {
  return {
    kind: 'proto',
    prototypeId: `${family}-${name}-${part}`,
    props,
    children,
    ...(ref ? { ref } : {}),
  };
}

function wrapFamilyFrame(family: CheckboxGroupFamily, children: DemoChild[]): DemoNode {
  if (family === 'liquid-glass') {
    return {
      kind: 'box',
      className: 'w-full min-w-0',
      children: [
        {
          kind: 'box',
          className: 'grid w-full min-w-0 gap-4 rounded-xl bg-background/90 p-4 shadow-sm',
          children,
        },
      ],
    };
  }
  return {
    kind: 'box',
    className: 'grid w-full min-w-0 gap-4 p-4',
    children,
  };
}

export function createCheckboxGroupExampleDemo(
  family: CheckboxGroupFamily,
  example: CheckboxGroupExampleKind
): DemoSpec {
  if (example === 'hero') {
    return {
      type: 'demo',
      root: wrapFamilyFrame(family, [
        atom(
          family,
          'checkbox-group',
          'root',
          { defaultValue: ['email'], ariaLabel: 'Notification channels' },
          [
            atom(family, 'checkbox-group', 'all', {}, ['All notifications']),
            atom(family, 'checkbox-group', 'item', { value: 'email' }, ['Email updates']),
            atom(family, 'checkbox-group', 'item', { value: 'sms' }, ['SMS alerts']),
            atom(family, 'checkbox-group', 'item', { value: 'push', disabled: true }, [
              'Push notifications (unavailable)',
            ]),
          ]
        ),
      ]),
    };
  }

  if (example === 'basic') {
    return {
      type: 'demo',
      root: wrapFamilyFrame(family, [
        atom(
          family,
          'checkbox-group',
          'root',
          { defaultValue: ['recents', 'home'], ariaLabel: 'Sidebar items' },
          [
            atom(family, 'checkbox-group', 'item', { value: 'recents' }, ['Recents']),
            atom(family, 'checkbox-group', 'item', { value: 'home' }, ['Home']),
            atom(family, 'checkbox-group', 'item', { value: 'applications' }, ['Applications']),
            atom(family, 'checkbox-group', 'item', { value: 'desktop' }, ['Desktop']),
          ]
        ),
      ]),
    };
  }

  if (example === 'horizontal') {
    return {
      type: 'demo',
      root: wrapFamilyFrame(family, [
        atom(
          family,
          'checkbox-group',
          'root',
          {
            defaultValue: ['email', 'in-app'],
            orientation: 'horizontal',
            ariaLabel: 'Delivery channels',
          },
          [
            atom(family, 'checkbox-group', 'item', { value: 'email' }, ['Email']),
            atom(family, 'checkbox-group', 'item', { value: 'sms' }, ['SMS']),
            atom(family, 'checkbox-group', 'item', { value: 'in-app' }, ['In-app']),
            atom(family, 'checkbox-group', 'item', { value: 'digest' }, ['Weekly digest']),
          ]
        ),
      ]),
    };
  }

  if (example === 'disabled') {
    return {
      type: 'demo',
      root: wrapFamilyFrame(family, [
        {
          kind: 'box',
          className: 'grid gap-2',
          children: [
            {
              kind: 'box',
              className: 'text-xs font-medium text-muted-foreground',
              children: ['Disabled group'],
            },
            atom(
              family,
              'checkbox-group',
              'root',
              { defaultValue: ['email'], disabled: true, ariaLabel: 'Disabled channels' },
              [
                atom(family, 'checkbox-group', 'item', { value: 'email' }, ['Email']),
                atom(family, 'checkbox-group', 'item', { value: 'sms' }, ['SMS']),
              ]
            ),
          ],
        },
        {
          kind: 'box',
          className: 'grid gap-2',
          children: [
            {
              kind: 'box',
              className: 'text-xs font-medium text-muted-foreground',
              children: ['Read-only group'],
            },
            atom(
              family,
              'checkbox-group',
              'root',
              { defaultValue: ['email'], readOnly: true, ariaLabel: 'Read-only channels' },
              [
                atom(family, 'checkbox-group', 'item', { value: 'email' }, ['Email']),
                atom(family, 'checkbox-group', 'item', { value: 'sms' }, ['SMS']),
              ]
            ),
          ],
        },
      ]),
    };
  }

  if (example === 'controlled') {
    return {
      type: 'demo',
      root: wrapFamilyFrame(family, [
        atom(
          family,
          'checkbox-group',
          'root',
          { value: ['email'], ariaLabel: 'Release channels' },
          [
            atom(family, 'checkbox-group', 'all', {}, ['All channels']),
            atom(family, 'checkbox-group', 'item', { value: 'email' }, ['Email']),
            atom(family, 'checkbox-group', 'item', { value: 'sms' }, ['SMS']),
            atom(family, 'checkbox-group', 'item', { value: 'webhook' }, ['Webhook']),
          ],
          'group'
        ),
        {
          kind: 'box',
          ref: 'status',
          attrs: { role: 'status', 'aria-live': 'polite' },
          className: 'text-xs text-muted-foreground',
          children: ['Selected: email'],
        },
      ]),
      setup({ api, refs }) {
        let current = ['email'];
        const renderStatus = () => {
          refs.status.textContent =
            current.length > 0 ? `Selected: ${current.join(', ')}` : 'Selected: none';
        };
        const onValueChange = (detail: { value?: string[] }) => {
          current = Array.isArray(detail?.value) ? [...detail.value] : [];
          api.setProps('group', {
            value: current,
            ariaLabel: 'Release channels',
            onValueChange,
          });
          renderStatus();
        };
        api.setProps('group', {
          value: current,
          ariaLabel: 'Release channels',
          onValueChange,
        });
        renderStatus();
      },
    };
  }

  return {
    type: 'demo',
    root: wrapFamilyFrame(family, [
      atom(
        family,
        'form',
        'root',
        { ariaLabel: 'Notification preferences' },
        [
          atom(family, 'form', 'field', { name: 'channels', required: true }, [
            atom(family, 'field', 'label', {}, ['Notification channels']),
            atom(family, 'checkbox-group', 'root', { defaultValue: ['email'] }, [
              atom(family, 'checkbox-group', 'item', { value: 'email' }, ['Email']),
              atom(family, 'checkbox-group', 'item', { value: 'sms' }, ['SMS']),
              atom(family, 'checkbox-group', 'item', { value: 'in-app' }, ['In-app']),
            ]),
            atom(family, 'field', 'error'),
          ]),
          {
            kind: 'box',
            className: 'flex flex-wrap items-center gap-2',
            children: [
              atom(family, 'form', 'submit', {}, ['Save preferences']),
              atom(family, 'form', 'reset', {}, ['Reset']),
            ],
          },
        ],
        'form'
      ),
      {
        kind: 'box',
        ref: 'status',
        attrs: { role: 'status', 'aria-live': 'polite' },
        className: 'text-xs text-muted-foreground',
        children: ['Submit to inspect serialized values.'],
      },
    ]),
    setup({ api, refs }) {
      const onSubmit = (detail: { values?: unknown }) => {
        refs.status.textContent = `Submitted: ${JSON.stringify(detail?.values ?? {})}`;
      };
      const onReset = () => {
        refs.status.textContent = 'Reset to initial selection.';
      };
      api.setProps('form', {
        ariaLabel: 'Notification preferences',
        onSubmit,
        onReset,
      });
    },
  };
}
