import type { DemoSetupContext, DemoSpec } from '@/components/PrototypePreviewer/demo-types';
import {
  bindInputShellControl,
  type InputShellProps,
} from '@proto.ui/prototypes-shadcn/input-shell';
import { withShadcnRheaDemo } from './shadcn-demo-style';

/** Interactive disabled toggle with public fact binding under Shadcn Rhea. */
export default withShadcnRheaDemo({
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    let current = true;
    const disposers = new Set<() => void>();
    const shellProps: InputShellProps = { focusIndicator: 'ring' };
    const control = { getExposes: () => api.getExposes('control') };
    const binding = bindInputShellControl(
      {
        isCurrent: () => current,
        onDispose(dispose) {
          disposers.add(dispose);
          return () => disposers.delete(dispose);
        },
      },
      {
        instance: refs.shell,
        setFacts(facts) {
          api.setProps('shell', { ...shellProps, ...facts });
          refs.toggleLabel.textContent = facts.disabled ? 'Enable input' : 'Disable input';
        },
      },
      control
    );
    api.setProps('toggleDisabled', {
      variant: 'outline',
      size: 'sm',
      onClick: () => {
        const disabled = api.getExposes('control')?.disabled as { get(): boolean };
        api.setProps('control', { disabled: !disabled.get() });
      },
    });
    return () => {
      current = false;
      binding.dispose();
      for (const dispose of [...disposers]) dispose();
      disposers.clear();
    };
  },
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-sm gap-3 p-4',
    children: [
      {
        kind: 'proto',
        prototypeId: 'shadcn-input-shell',
        ref: 'shell',
        props: {
          focusIndicator: 'ring',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-shell-control',
            ref: 'control',
            props: {
              placeholder: 'Search messages…',
              ariaLabel: 'Search messages',
            },
          },
        ],
      },
      {
        kind: 'box',
        className: 'flex items-center gap-2',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: 'toggleDisabled',
            props: {
              variant: 'outline',
              size: 'sm',
            },
            children: [
              {
                kind: 'box',
                ref: 'toggleLabel',
                className: 'inline',
                children: ['Disable input'],
              },
            ],
          },
        ],
      },
    ],
  },
} satisfies DemoSpec);
