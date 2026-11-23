/** Diagnostic fixture: the public demo tree and renderer, without panel size overrides. */
import * as drawer from '@proto.ui/prototypes-shadcn/drawer';
import { shadcnButton } from '@proto.ui/prototypes-shadcn/button';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import { registerPrototype } from '../../../../../apps/www/src/components/PrototypePreviewer/registry';
import { renderDemo } from '../../../../../apps/www/src/components/PrototypePreviewer/demo-renderer';
import type { DemoSpec } from '../../../../../apps/www/src/components/PrototypePreviewer/demo-types';
export async function createPublicDrawerEntryFixture(
  fixedControl: boolean,
  demo: DemoSpec,
  includeStyleScope = true
) {
  // The ordinary public demo explicitly owns this dependency. False is only the
  // fresh-page missing-dependency countercontrol; the real renderer still rejects it.
  if (includeStyleScope) registerPrototype('shadcn-style-scope', styleScope);
  // The public demo composes a real shadcn-button for its trigger and close
  // action, so the renderer needs that prototype registered alongside the
  // drawer family; omitting it leaves the demo unbuildable before entry.
  registerPrototype('shadcn-button', shadcnButton as any);
  for (const value of Object.values(drawer)) {
    if (value && typeof value === 'object' && 'name' in value)
      registerPrototype(value.name as string, value as any);
  }
  const host = document.createElement('div');
  document.body.append(host);
  const rendered = await renderDemo({ host, runtime: 'wc', demo });
  const content = host.querySelector('wc-shadcn-drawer-content') as HTMLElement;
  if (fixedControl) {
    content.style.height = '200px';
    content.style.width = '320px';
  }
  return {
    open() {
      // C-AS-TRIGGER-0001-D/J: the directly nested Button is the group's
      // interaction surface; the outer Drawer Trigger is only its anchor.
      const actions = host.querySelectorAll<HTMLElement>(
        'wc-shadcn-drawer-trigger [data-demo-ref="trigger-action"]'
      );
      if (actions.length !== 1)
        throw new Error('Public Drawer requires one physical trigger action');
      actions[0]!.click();
    },
    async dispose() {
      await rendered.destroy();
      host.remove();
    },
  };
}
