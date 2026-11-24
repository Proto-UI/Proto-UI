import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';
import {
  bindInputShellControl,
  type InputShellProps,
} from '@proto.ui/prototypes-shadcn/input-shell';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

/** Composes Command with Input Shell using focusIndicator="none" around commandInput. */
export default withShadcnRheaDemo({
  type: 'demo',
  setup({ refs, api }: DemoSetupContext) {
    let current = true;
    const disposers = new Set<() => void>();
    const shellProps: InputShellProps = { focusIndicator: 'none' };
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
        },
      },
      { getExposes: () => api.getExposes('input') }
    );

    api.setProps('command', {
      a11yLabel: 'Quick actions',
      onExecute: (detail: { value: string; textValue: string }) => {
        refs.status.textContent = `Selected: ${detail.textValue}`;
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
        prototypeId: 'shadcn-command-root',
        ref: 'command',
        props: {
          a11yLabel: 'Quick actions',
        },
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-input-shell',
            ref: 'shell',
            props: {
              focusIndicator: 'none',
            },
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-command-input',
                ref: 'input',
                props: {
                  placeholder: 'Type a command or search…',
                  a11yLabel: 'Command search',
                },
              },
            ],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-command-content',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-command-item',
                props: { value: 'calendar', textValue: 'Calendar' },
                children: ['Calendar'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-command-item',
                props: { value: 'billing', textValue: 'Billing' },
                children: ['Billing'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-command-item',
                props: { value: 'settings', textValue: 'Settings' },
                children: ['Settings'],
              },
              {
                kind: 'proto',
                prototypeId: 'shadcn-command-empty',
                children: ['No matching commands.'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        ref: 'status',
        attrs: { 'aria-live': 'polite' },
        className: 'text-xs text-muted-foreground',
        children: ['Type to filter, then press Enter or click an item.'],
      },
    ],
  },
} satisfies DemoSpec);
