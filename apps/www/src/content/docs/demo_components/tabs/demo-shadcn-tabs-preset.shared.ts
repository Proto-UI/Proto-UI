import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

/**
 * Builds the bounded Shadcn Tabs preset exhibition recipe for a supported
 * upstream profile. Children, refs, defaultValue, and the disabled trigger are
 * held identical across every preset. These are independent static comparisons;
 * the separate profile-switch recipe exercises a live scope update.
 *
 * These three exhibition profiles preserve the original bounded comparison.
 * The current Tabs visual definition separately lists all supported profiles.
 */
export function createTabsPresetDemo(styleProfile: 'nova' | 'rhea' | 'new-york-v4'): DemoSpec {
  const recipe: DemoSpec = {
    type: 'demo',
    root: {
      kind: 'proto',
      prototypeId: 'shadcn-tabs-root',
      ref: 'tabs',
      className: 'w-[420px] max-w-full',
      props: { defaultValue: 'account' },
      children: [
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-list',
          ref: 'tabList',
          children: [
            {
              kind: 'proto',
              prototypeId: 'shadcn-tabs-trigger',
              ref: 'accountTab',
              props: { value: 'account' },
              children: ['Account'],
            },
            {
              kind: 'proto',
              prototypeId: 'shadcn-tabs-trigger',
              ref: 'passwordTab',
              props: { value: 'password' },
              children: ['Password'],
            },
            {
              kind: 'proto',
              prototypeId: 'shadcn-tabs-trigger',
              ref: 'billingTab',
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
          ref: 'accountContent',
          props: { value: 'account' },
          children: ['Make changes to your account here.'],
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-content',
          ref: 'passwordContent',
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
      ref: 'profileScope',
      props: { styleProfile },
    },
  };
}
