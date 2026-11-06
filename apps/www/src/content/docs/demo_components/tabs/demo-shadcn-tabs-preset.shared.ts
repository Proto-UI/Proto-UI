import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '@/components/PrototypePreviewer/demo-types';

/**
 * Builds the bounded Shadcn Tabs preset exhibition recipe for a supported
 * upstream profile. Children, refs, defaultValue, and the disabled trigger are
 * held identical across every preset so the only changing input is the
 * styleProfile on the wrapping style scope. Switching presets therefore cannot
 * reset value, focus, or children — Base remains the sole state owner.
 *
 * Supported presets come from internal/fixtures/shadcn-tabs-style/coverage.json
 * (`projected-bounded-text-default` entries): nova, rhea, new-york-v4.
 */
export function createTabsPresetDemo(styleProfile: 'nova' | 'rhea' | 'new-york-v4'): DemoSpec {
  const recipe: DemoSpec = {
    type: 'demo',
    root: {
      kind: 'proto',
      prototypeId: 'shadcn-tabs-root',
      className: 'w-[420px] max-w-full',
      props: { defaultValue: 'account' },
      children: [
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-list',
          children: [
            {
              kind: 'proto',
              prototypeId: 'shadcn-tabs-trigger',
              props: { value: 'account' },
              children: ['Account'],
            },
            {
              kind: 'proto',
              prototypeId: 'shadcn-tabs-trigger',
              props: { value: 'password' },
              children: ['Password'],
            },
            {
              kind: 'proto',
              prototypeId: 'shadcn-tabs-trigger',
              props: { value: 'billing', disabled: true },
              children: ['Billing'],
            },
          ],
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-indicator',
          className: 'block h-0.5',
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-content',
          props: { value: 'account' },
          children: ['Make changes to your account here.'],
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-content',
          props: { value: 'password' },
          children: ['Change your password here.'],
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-content',
          props: { value: 'billing' },
          children: ['Billing tab is disabled in this preview.'],
        },
      ],
    },
  };
  // The Rhea helper writes a wrapping `shadcn-style-scope` with
  // `styleProfile: 'rhea'`. We retarget only that scope prop to the requested
  // preset; the leaf recipe is unchanged so the demo policy invariants still hold.
  const wrapped = withShadcnRheaDemo(recipe);
  return {
    ...wrapped,
    root: {
      ...wrapped.root,
      props: { styleProfile },
    },
  };
}
