import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';
import { createTabsPresetDemo } from './demo-shadcn-tabs-preset.shared';

export const TABS_EXHIBITION_PROFILES = ['nova', 'rhea', 'new-york-v4'] as const;

/** One live style-scope owner; controls change paint without replacing Tabs. */
export default withShadcnRheaDemo({
  type: 'demo',
  root: {
    kind: 'box',
    className: 'grid w-full min-w-0 gap-4',
    children: [
      {
        kind: 'box',
        className: 'flex flex-wrap gap-2',
        attrs: { role: 'group', 'aria-label': 'Tabs style profile' },
        children: TABS_EXHIBITION_PROFILES.map((profile) => ({
          kind: 'proto' as const,
          prototypeId: 'shadcn-button',
          ref: `profile-${profile}`,
          props: { variant: 'outline', size: 'sm' },
          children: [profile],
        })),
      },
      createTabsPresetDemo('rhea').root,
      {
        kind: 'box',
        ref: 'profileStatus',
        attrs: { role: 'status', 'aria-live': 'polite' },
        className: 'text-sm text-muted-foreground',
        children: ['Profile: rhea'],
      },
    ],
  },
  setup({ host, refs, api }) {
    let current: (typeof TABS_EXHIBITION_PROFILES)[number] = 'rhea';
    let disposed = false;
    const select = (profile: typeof current) => {
      if (disposed || profile === current) return;
      api.setProps('profileScope', { styleProfile: profile });
      current = profile;
      refs.profileStatus.textContent = `Profile: ${profile}`;
    };
    for (const profile of TABS_EXHIBITION_PROFILES)
      api.setProps(`profile-${profile}`, { onClick: () => select(profile) });
    // An explicit modified shortcut can change paint while a tab retains focus.
    // Ordinary arrows, Enter, Space and typing still belong to their native owner.
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing)
        return;
      const index = ['1', '2', '3'].indexOf(event.key);
      if (index < 0) return;
      event.preventDefault();
      select(TABS_EXHIBITION_PROFILES[index]!);
    };
    host.addEventListener('keydown', onKey);
    return () => {
      disposed = true;
      host.removeEventListener('keydown', onKey);
    };
  },
} satisfies DemoSpec);
