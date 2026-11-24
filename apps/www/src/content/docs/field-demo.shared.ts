import type { DemoChild, DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import type { FieldValidationRequest } from '@proto.ui/prototypes-base/field';

export function createFieldDemo(family: string): DemoSpec {
  const atom = (
    role: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = []
  ): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-field-${role}`,
    ref,
    props,
    children,
    ...(family === 'base'
      ? {
          className:
            role === 'control'
              ? 'block w-full min-w-0 rounded border px-3 py-2'
              : role === 'root'
                ? 'grid min-w-0 gap-2'
                : 'block break-words',
        }
      : {}),
  });

  const field = (
    id: string,
    label: string,
    props: Record<string, unknown> = {},
    controlProps: Record<string, unknown> = {},
    help?: string,
    control?: DemoNode,
    includeValidity = false
  ): DemoNode =>
    atom('root', `${id}Root`, props, [
      atom('label', `${id}Label`, {}, [label]),
      control ?? atom('control', `${id}Control`, controlProps),
      ...(help ? [atom('description', `${id}Description`, {}, [help])] : []),
      atom('error', `${id}Error`),
      ...(includeValidity ? [atom('validity', `${id}Validity`)] : []),
    ]);

  const button = (ref: string, text: string, variant?: 'outline' | 'secondary'): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    props: variant && family === 'shadcn' ? { variant } : {},
    children: [text],
    ...(family === 'base' ? { className: 'rounded border px-3 py-2 text-sm' } : {}),
  });

  const part = (
    role: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = []
  ): DemoNode => ({ kind: 'proto', prototypeId: `${family}-${role}`, ref, props, children });

  const additionalControls: DemoNode[] =
    family === 'shadcn' || family === 'bootstrap-2-3-2' || family === 'liquid-glass'
      ? [
          field(
            'bio',
            'Project summary',
            { required: true },
            {},
            'Shown on your public workspace page.',
            atom('textarea', 'bioControl', {
              rows: 3,
              placeholder: 'Describe your workspace...',
              defaultValue: 'Design system and component primitives.',
            })
          ),
          field(
            'delivery',
            'Notification channel',
            { required: true },
            {},
            'Choose how alerts are delivered to your team.',
            part('select-root', 'deliverySelect', { defaultValue: 'email' }, [
              atom('select-trigger', 'deliveryControl', {}, [
                part('select-value', 'deliveryValue', {
                  placeholder: 'Select a channel',
                }),
              ]),
              part('select-content', 'deliveryContent', {}, [
                part('select-surface', 'deliverySurface', {}, [
                  part('select-viewport', 'deliveryViewport', {}, [
                    part('select-group', 'deliveryGroup', {}, [
                      part('select-label', 'deliveryGroupLabel', {}, ['Channels']),
                      part('select-item', 'deliveryEmail', { value: 'email', textValue: 'Email' }, [
                        part('select-item-text', 'deliveryEmailText', {}, ['Email']),
                      ]),
                      part(
                        'select-item',
                        'deliveryPush',
                        { value: 'push', textValue: 'Push notification' },
                        [part('select-item-text', 'deliveryPushText', {}, ['Push notification'])]
                      ),
                    ]),
                  ]),
                ]),
              ]),
            ])
          ),
          atom('root', 'notificationsRoot', { orientation: 'horizontal' }, [
            atom('label', 'notificationsLabel', {}, ['Weekly digest emails']),
            atom('switch', 'notificationsControl', { defaultChecked: true }, [
              part('switch-thumb', 'notificationsThumb'),
            ]),
          ]),
        ]
      : [];

  const formContent: DemoNode = {
    kind: 'box',
    className:
      family === 'liquid-glass'
        ? 'grid w-full max-w-md min-w-0 gap-5 rounded-2xl bg-background/85 p-5 shadow-sm'
        : 'grid w-full max-w-md min-w-0 gap-5 p-2',
    children: [
      field(
        'username',
        'Username',
        { required: true, minLength: 3, validationMode: 'onBlur' },
        { placeholder: 'alex.chen' },
        'Must be at least 3 characters.',
        undefined,
        true
      ),
      field(
        'handle',
        'Workspace handle',
        { externalValidation: true, validationMode: 'onChange' },
        { defaultValue: 'acme-studio', placeholder: 'Try "taken"' },
        'Type "taken" to preview asynchronous availability validation.'
      ),
      {
        kind: 'box',
        ref: 'handleStatus',
        className: 'text-xs text-muted-foreground',
        attrs: { 'aria-live': 'polite' },
        children: ['Handle ready'],
      },
      field(
        'email',
        'Account email',
        { readOnly: true },
        { defaultValue: 'alex@acme.dev' },
        'Managed by your workspace single sign-on.'
      ),
      field(
        'plan',
        'Billing plan',
        { disabled: true },
        { defaultValue: 'Enterprise' },
        'Contact your administrator to change plans.'
      ),
      ...additionalControls,
      {
        kind: 'box',
        className: 'flex flex-wrap items-center gap-2 pt-1',
        children: [
          button('validate', 'Save changes'),
          button('reset', 'Reset validation', 'outline'),
        ],
      },
    ],
  };

  return {
    type: 'demo',
    root:
      family === 'liquid-glass'
        ? {
            kind: 'box',
            className:
              'flex w-full justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20 p-6',
            children: [formContent],
          }
        : {
            kind: 'box',
            className: 'flex w-full justify-center p-2',
            children: [formContent],
          },
    setup({ refs, api }) {
      let alive = true;
      let currentRequest = '';
      const timers = new Set<ReturnType<typeof setTimeout>>();

      const checkHandle = (request: FieldValidationRequest) => {
        if (currentRequest === request.requestId) return;
        currentRequest = request.requestId;
        refs.handleStatus.textContent = 'Checking availability...';
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!alive) return;
          const invalid = request.value === 'taken';
          const accepted = api.call('handleRoot', 'resolveValidation', request.requestId, {
            invalid,
            errors: invalid ? ['That workspace handle is already taken.'] : [],
          });
          if (currentRequest === request.requestId) {
            refs.handleStatus.textContent = accepted
              ? invalid
                ? 'Handle unavailable'
                : 'Handle available'
              : 'Superseded check ignored';
          }
        }, 400);
        timers.add(timer);
      };

      api.setProps('handleRoot', {
        externalValidation: true,
        validationMode: 'onChange',
        onValidationRequest: checkHandle,
      });

      api.setProps('validate', {
        onClick: () => {
          api.call('usernameRoot', 'validate');
          api.call('handleRoot', 'validate');
        },
      });

      api.setProps('reset', {
        onClick: () => {
          api.call('usernameRoot', 'resetValidation');
          api.call('handleRoot', 'resetValidation');
          currentRequest = '';
          refs.handleStatus.textContent = 'Handle ready';
        },
      });

      return () => {
        alive = false;
        for (const timer of timers) clearTimeout(timer);
      };
    },
  };
}
