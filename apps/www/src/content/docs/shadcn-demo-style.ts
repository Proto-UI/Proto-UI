import type { DemoSpec } from '../../components/PrototypePreviewer/demo-types';

/** Website example policy, not a change to any public component default. */
export const SHADCN_DEMO_STYLE_PROFILE = 'rhea' as const;

/** Compose the existing public logical style scope. Preserve the exact child
 * object and setup owner; do not rewrite leaf props, callbacks or runtime APIs.
 * Explicit leaf overrides still win and are audited by the demo policy tests.
 * It requests a flow-neutral contents surface; cross-host layout still needs
 * independent native verification. */
export function withShadcnRheaDemo(demo: DemoSpec): DemoSpec {
  return {
    ...demo,
    root: {
      kind: 'proto',
      prototypeId: 'shadcn-style-scope',
      className: 'contents',
      props: { styleProfile: SHADCN_DEMO_STYLE_PROFILE },
      children: [demo.root],
    },
  };
}
