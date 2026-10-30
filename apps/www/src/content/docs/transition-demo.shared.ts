import type {
  DemoNode,
  DemoSetupContext,
  DemoSpec,
} from '@/components/PrototypePreviewer/demo-types';

const exposeGet = (handle: unknown): unknown => {
  const h = handle as { get?: () => unknown; state?: { get?: () => unknown } } | undefined;
  return h?.get ? h.get() : h?.state?.get?.();
};

/**
 * The family Transition is a transparent protocol projection over the exact
 * Base phase machine: it adds no host animation engine, and (outside Liquid
 * Glass's endpoint-opacity recipe) no family paint claims motion. This demo
 * demonstrates the true bounded behavior: the authored slot's presence is
 * governed by the phase machine, phases are observable through the exposed
 * transitionState, and enter/leave/complete are the real public controls.
 */
export function createTransitionDemo(family: string): DemoSpec {
  const button = (ref: string, label: string): DemoNode => ({
    kind: 'proto',
    prototypeId: `${family}-button`,
    ref,
    props: {},
    children: [label],
  });
  const phaseChip = (phase: string): DemoNode => ({
    kind: 'box',
    className: 'px-3 py-1 bg-muted text-muted-foreground rounded',
    children: [phase],
  });
  return {
    type: 'demo',
    setup({ host, refs, api }: DemoSetupContext) {
      const readState = () => {
        if (!refs.stateLabel) return;
        const s = exposeGet(api.getExposes('transition')?.transitionState);
        refs.stateLabel.textContent = typeof s === 'string' ? s : 'unknown';
      };
      readState();
      const mo = new MutationObserver(readState);
      mo.observe(host, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-transition-state'],
      });
      const command = (path: string) => () => {
        api.call('transition', path);
        // The MutationObserver covers hosts that project the phase into
        // data-transition-state; a next-frame read covers the rest.
        requestAnimationFrame(readState);
      };
      api.setProps('enterBtn', { onClick: command('controls.enter') });
      api.setProps('leaveBtn', { onClick: command('controls.leave') });
      api.setProps('completeBtn', { onClick: command('controls.complete') });
      return () => {
        mo.disconnect();
      };
    },
    root: {
      kind: 'box',
      className: 'flex w-full min-w-0 max-w-full flex-col items-center gap-6 p-4 sm:p-8',
      children: [
        {
          kind: 'proto',
          prototypeId: `${family}-transition`,
          ref: 'transition',
          props: { defaultOpen: true, appear: true },
          children: [
            {
              kind: 'box',
              className:
                'flex h-40 w-64 max-w-full flex-col items-center justify-center rounded-xl border border-border bg-muted/50 shadow-sm',
              children: [
                { kind: 'box', className: 'text-lg font-semibold', children: ['Presence'] },
                {
                  kind: 'box',
                  className: 'mt-2 text-sm text-muted-foreground',
                  children: ['Owned by the phase machine · 由状态机治理'],
                },
              ],
            },
          ],
        },
        {
          kind: 'box',
          className: 'flex flex-wrap items-center justify-center gap-2',
          children: [
            button('enterBtn', 'Enter · 进入'),
            button('leaveBtn', 'Leave · 离开'),
            button('completeBtn', 'Complete · 完成'),
          ],
        },
        {
          kind: 'box',
          className: 'text-sm text-muted-foreground',
          children: [
            'transitionState: ',
            {
              kind: 'box',
              ref: 'stateLabel',
              className: 'inline font-semibold text-foreground',
              children: ['—'],
            },
          ],
        },
        {
          kind: 'box',
          className: 'flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs',
          children: [phaseChip('closed'), phaseChip('entering'), phaseChip('entered'), phaseChip('leaving')],
        },
      ],
    },
  };
}
