import type { DemoChild, DemoNode, DemoSpec, DemoSetupContext } from './demo-types';

/** App Maker composition only: every association lowers through the public channel. */
export function createControlLabelDemo(labelPrototypeId: string): DemoSpec {
  const proto = (
    prototypeId: string,
    ref: string,
    props: Record<string, unknown> = {},
    children: DemoChild[] = [],
    key?: string
  ): DemoNode => ({
    kind: 'proto',
    prototypeId,
    ref,
    props,
    children,
    ...(key ? { associations: { controlLabel: key } } : {}),
  });
  const label = (text: string, key: string, activation = true) =>
    proto(labelPrototypeId, `label-${key}`, { naming: true, activation }, [text], key);
  const stateText = (ref: string): DemoNode => ({
    kind: 'box',
    tag: 'span',
    ref: `state-${ref}`,
    attrs: { 'aria-hidden': 'true' },
    children: ['Off'],
  });
  const row = (children: DemoChild[]): DemoNode => ({
    kind: 'box',
    className: 'flex flex-wrap items-center gap-3',
    children,
  });
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'flex w-full max-w-xl flex-col gap-5',
      children: [
        row([
          proto('base-checkbox-root', 'checkbox', {}, [stateText('checkbox')], 'checkbox'),
          label('Community updates', 'checkbox'),
        ]),
        row([
          proto('base-switch-root', 'switch', {}, [stateText('switch')], 'switch'),
          label('Enable notifications', 'switch'),
        ]),
        proto('base-radio-group-root', 'radio', { defaultValue: 'email' }, [
          row([
            proto(
              'base-radio-group-item',
              'radio-email',
              { value: 'email' },
              [stateText('radio-email')],
              'radio-email'
            ),
            label('Email delivery', 'radio-email'),
          ]),
          row([
            proto(
              'base-radio-group-item',
              'radio-push',
              { value: 'push' },
              [stateText('radio-push')],
              'radio-push'
            ),
            label('Push delivery', 'radio-push'),
          ]),
        ]),
        label('Project name', 'input'),
        proto('base-input-root', 'input', { defaultValue: 'Proto UI' }, [], 'input'),
        label('Project notes', 'textarea'),
        proto(
          'base-textarea-root',
          'textarea',
          { defaultValue: 'Useful content stays selectable', rows: 3 },
          [],
          'textarea'
        ),
        row([
          proto(
            'base-checkbox-root',
            'disabled',
            { disabled: true },
            [stateText('disabled')],
            'disabled'
          ),
          label('Disabled choice', 'disabled'),
        ]),
        row([
          proto(
            'base-checkbox-root',
            'controlled',
            { checked: false },
            [stateText('controlled')],
            'controlled'
          ),
          label('Controlled choice (owner keeps it off)', 'controlled'),
        ]),
        row([
          proto('base-checkbox-root', 'passive', {}, [stateText('passive')], 'passive'),
          label('Naming only: this text can be copied', 'passive', false),
        ]),
        {
          kind: 'box',
          ref: 'description',
          children: [
            'Long descriptions are useful copyable content. Selecting this sentence does not activate a control.',
          ],
        },
      ],
    },
    setup: setupControlLabelDemo,
  };
}

// Read-only App Maker presentation. There is no click forwarding or value setter.
function setupControlLabelDemo({ refs, api }: DemoSetupContext) {
  const off: Array<() => void> = [];
  for (const name of [
    'checkbox',
    'switch',
    'radio-email',
    'radio-push',
    'disabled',
    'controlled',
    'passive',
  ]) {
    const state = api.getExposes(name)?.checked as
      | { get(): unknown; subscribe?(callback: () => void): () => void }
      | undefined;
    const output = refs[`state-${name}`];
    if (!state || !output) continue;
    const paint = () => {
      output.textContent = state.get() ? 'On' : 'Off';
    };
    paint();
    const unsubscribe = state.subscribe?.(paint);
    if (unsubscribe) off.push(unsubscribe);
  }
  return () => {
    for (const unsubscribe of off) unsubscribe();
  };
}
