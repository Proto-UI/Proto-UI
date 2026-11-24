import type {
  DemoSetupContext,
  DemoSpec,
} from '../../../../components/PrototypePreviewer/demo-types';
import {
  bindInputShellControl,
  type InputShellProps,
} from '@proto.ui/prototypes-shadcn/input-shell';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

/** Default Shadcn Rhea composition with passive shell and single inline editor. */
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
        },
      },
      control
    );
    return () => {
      current = false;
      binding.dispose();
      for (const dispose of [...disposers]) dispose();
      disposers.clear();
    };
  },
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 max-w-sm gap-2 p-4',
    children: [
      {
        kind: 'box',
        className: 'text-sm font-medium text-foreground',
        children: ['Workspace search'],
      },
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
              placeholder: 'Search projects, teams, or docs…',
              ariaLabel: 'Workspace search',
            },
          },
        ],
      },
      {
        kind: 'box',
        className: 'text-xs text-muted-foreground',
        children: ['Press Tab to see the shell display the keyboard focus ring.'],
      },
    ],
  },
} satisfies DemoSpec);
