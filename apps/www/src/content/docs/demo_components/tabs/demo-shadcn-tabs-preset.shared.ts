import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';

/**
 * Builds the bounded Shadcn Tabs preset exhibition recipe for a supported
 * upstream profile. Children, refs, defaultValue, and the disabled trigger are
 * held identical across every preset. These are independent static comparisons;
 * the separate profile-switch recipe exercises a live scope update.
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
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-content',
          ref: 'accountContent',
          props: { value: 'account' },
          children: ['Make changes to your account profile and preferences here.'],
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-content',
          ref: 'passwordContent',
          props: { value: 'password' },
          children: ['Update your password and two-factor sign-in methods here.'],
        },
        {
          kind: 'proto',
          prototypeId: 'shadcn-tabs-content',
          props: { value: 'billing' },
          children: ['Manage workspace subscription plans and billing contacts.'],
        },
      ],
    },
  };
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
