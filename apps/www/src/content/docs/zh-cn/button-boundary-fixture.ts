import type { DemoNode, DemoSpec } from '@/components/PrototypePreviewer/demo-types';

// Private acceptance fixture: deliberately not a globally registered .demo.ts recipe.
// Only the public direct Button is rendered; this fixture owns composition and readouts.
export function createButtonBoundaryFixture(): DemoSpec {
  const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
  const sizes = ['default', 'sm', 'lg', 'icon', 'icon-compact'] as const;
  return {
    type: 'demo',
    root: {
      kind: 'box',
      attrs: { 'data-button-boundary-controls': '' },
      children: [
        {
          kind: 'box',
          attrs: { 'data-button-boundary-row': 'variants' },
          children: variants.map((variant): DemoNode => ({
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: `variant-${variant}`,
            props: { styleProfile: 'new-york', variant },
            children: [variant],
          })),
        },
        {
          kind: 'box',
          attrs: { 'data-button-boundary-row': 'sizes' },
          children: sizes.map((size): DemoNode => ({
            kind: 'proto',
            prototypeId: 'shadcn-button',
            ref: `size-${size}`,
            props: { styleProfile: 'new-york', size, variant: 'outline', wrap: true },
            children: [size === 'icon' || size === 'icon-compact' ? '+' : size],
          })),
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-button',
          ref: 'disabled',
          props: { styleProfile: 'new-york', disabled: true, wrap: true },
          children: ['Disabled command'],
        },
        {
          kind: 'box',
          attrs: { 'data-button-boundary-wrap': '' },
          children: [
            {
              kind: 'proto',
              prototypeId: 'shadcn-button',
              ref: 'wrapped',
              props: { styleProfile: 'new-york', wrap: true },
              children: ['Save the complete translated document and continue editing'],
            },
          ],
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-button',
          ref: 'changing',
          props: { styleProfile: 'new-york' },
          children: ['+'],
        },
        {
          kind: 'box',
          ref: 'counts',
          attrs: { role: 'status', 'aria-live': 'polite' },
          children: ['Waiting for Button ownership'],
        },
      ],
    },
    setup({ host, refs, api }) {
      const counts: Record<string, number> = {};
      const report = () => {
        refs.counts.textContent = JSON.stringify(counts);
      };
      for (const ref of [
        ...variants.map((variant) => `variant-${variant}`),
        'disabled',
        'wrapped',
        'changing',
      ]) {
        counts[ref] = 0;
        // Observe the public outward signal, rather than a native DOM click counter.
        api.setProps(ref, {
          onClick: () => {
            counts[ref]++;
            report();
          },
        });
      }
      report();
      const main = host.closest('main')!;
      const size = main.querySelector<HTMLSelectElement>('[data-button-boundary-size]')!;
      const wrap = main.querySelector<HTMLInputElement>('[data-button-boundary-wrap-input]')!;
      const disabled = main.querySelector<HTMLInputElement>('[data-button-boundary-disabled]')!;
      const reset = main.querySelector<HTMLButtonElement>('[data-button-boundary-reset]')!;
      const update = () =>
        api.setProps('changing', {
          size: size.value,
          wrap: wrap.checked,
          disabled: disabled.checked,
        });
      const restoreDefaults = () => {
        if (!api.removeProps) throw new Error('Button boundary fixture requires public prop removal');
        api.removeProps('changing', ['size', 'wrap', 'disabled']);
        size.value = 'default';
        wrap.checked = false;
        disabled.checked = false;
      };
      for (const control of [size, wrap, disabled]) control.addEventListener('change', update);
      reset.addEventListener('click', restoreDefaults);
      return () => {
        for (const control of [size, wrap, disabled]) control.removeEventListener('change', update);
        reset.removeEventListener('click', restoreDefaults);
      };
    },
  };
}
