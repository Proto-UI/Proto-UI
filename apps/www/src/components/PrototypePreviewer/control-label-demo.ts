import type { DemoChild, DemoNode, DemoSpec, DemoSetupContext } from './demo-types';

/** App Maker composition only: every association lowers through the public channel. */
export function createControlLabelDemo(
  labelPrototypeId: string,
  family: 'base' | 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass' = 'base'
): DemoSpec {
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
  const label = (text: string, key: string, activation?: boolean) =>
    proto(
      labelPrototypeId,
      `label-${key}`,
      activation === undefined ? {} : { activation },
      [text],
      key
    );
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
  const controlChildren = (part: string, ref: string): DemoChild[] =>
    family === 'base' ? [stateText(ref)] : [proto(`${family}-${part}`, `${ref}-part`)];
  const externalState = (ref: string): DemoChild[] => (family === 'base' ? [] : [stateText(ref)]);
  return {
    type: 'demo',
    root: {
      kind: 'box',
      className: 'flex w-full max-w-xl flex-col gap-5',
      children: [
        row([
          proto(
            `${family}-checkbox-root`,
            'checkbox',
            {},
            controlChildren('checkbox-indicator', 'checkbox'),
            'checkbox'
          ),
          label('Community updates', 'checkbox'),
          ...externalState('checkbox'),
        ]),
        row([
          proto(
            `${family}-switch-root`,
            'switch',
            {},
            controlChildren('switch-thumb', 'switch'),
            'switch'
          ),
          label('Enable notifications', 'switch'),
          ...externalState('switch'),
        ]),
        proto(`${family}-radio-group-root`, 'radio', { defaultValue: 'email' }, [
          row([
            proto(
              `${family}-radio-group-item`,
              'radio-email',
              { value: 'email' },
              controlChildren('radio-group-indicator', 'radio-email'),
              'radio-email'
            ),
            label('Email delivery', 'radio-email'),
            ...externalState('radio-email'),
          ]),
          row([
            proto(
              `${family}-radio-group-item`,
              'radio-push',
              { value: 'push' },
              controlChildren('radio-group-indicator', 'radio-push'),
              'radio-push'
            ),
            label('Push delivery', 'radio-push'),
            ...externalState('radio-push'),
          ]),
        ]),
        label('Project name', 'input'),
        proto(`${family}-input-root`, 'input', { defaultValue: 'Proto UI' }, [], 'input'),
        label('Project notes', 'textarea'),
        proto(
          `${family}-textarea-root`,
          'textarea',
          { defaultValue: 'Useful content stays selectable', rows: 3 },
          [],
          'textarea'
        ),
        label('Read-only project name', 'readonly-input'),
        proto(
          `${family}-input-root`,
          'readonly-input',
          { defaultValue: 'Published project', readOnly: true },
          [],
          'readonly-input'
        ),
        label('Read-only project notes', 'readonly-textarea'),
        proto(
          `${family}-textarea-root`,
          'readonly-textarea',
          { defaultValue: 'This note stays unchanged.', readOnly: true, rows: 2 },
          [],
          'readonly-textarea'
        ),
        row([
          proto(
            `${family}-checkbox-root`,
            'disabled',
            { disabled: true },
            controlChildren('checkbox-indicator', 'disabled'),
            'disabled'
          ),
          label('Disabled choice', 'disabled'),
          ...externalState('disabled'),
        ]),
        row([
          proto(
            `${family}-checkbox-root`,
            'controlled',
            { checked: false },
            controlChildren('checkbox-indicator', 'controlled'),
            'controlled'
          ),
          label('Controlled choice (owner keeps it off)', 'controlled'),
          ...externalState('controlled'),
          {
            kind: 'box',
            tag: 'span',
            ref: 'controlled-requests',
            children: ['Requests: 0'],
          },
        ]),
        row([
          proto(
            `${family}-checkbox-root`,
            'passive',
            {},
            controlChildren('checkbox-indicator', 'passive'),
            'passive'
          ),
          label('Naming only: this text can be copied', 'passive', false),
          ...externalState('passive'),
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

// Observe state and outward proposals; the controlled owner deliberately keeps
// checked=false. Label still invokes only the target's own activation operation.
function setupControlLabelDemo({ refs, api }: DemoSetupContext) {
  let active = true;
  let requests = 0;
  api.setProps('controlled', {
    checked: false,
    onCheckedChange: () => {
      if (!active) return;
      requests++;
      refs['controlled-requests'].textContent = `Requests: ${requests}`;
    },
  });
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
    active = false;
    for (const unsubscribe of off) unsubscribe();
  };
}
