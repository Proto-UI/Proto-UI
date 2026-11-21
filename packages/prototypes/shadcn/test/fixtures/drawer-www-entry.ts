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
  // The public demo composes Button surfaces inside its Trigger and Close commands.
  registerPrototype('shadcn-button', shadcnButton);
  for (const value of Object.values(drawer)) {
    if (value && typeof value === 'object' && 'name' in value)
      registerPrototype(value.name, value as any);
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
      const actions = host.querySelectorAll<HTMLElement>(
        'wc-shadcn-drawer-trigger [data-demo-ref="trigger-action"]'
      );
      if (actions.length !== 1 || actions[0].localName !== 'wc-shadcn-button')
        throw new Error('Public Drawer entry requires one authored trigger-action Button.');
      actions[0].click();
    },
    async dispose() {
      await rendered.destroy();
      host.remove();
    },
  };
}
