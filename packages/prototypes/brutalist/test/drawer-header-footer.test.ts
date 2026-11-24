import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent } from '@proto.ui/adapter-web-component';
import {
  drawerRoot,
  drawerTrigger,
  drawerContent,
  drawerHeader,
  drawerFooter,
  drawerTitle,
  drawerDescription,
} from '../src/drawer';

for (const proto of [
  drawerRoot,
  drawerTrigger,
  drawerContent,
  drawerHeader,
  drawerFooter,
  drawerTitle,
  drawerDescription,
]) {
  AdaptToWebComponent(proto as never);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Brutalist Drawer Header and Footer passive structure', () => {
  it('mounts passive Header and Footer parts inside Drawer Content and preserves authored content', async () => {
    const root = document.createElement(drawerRoot.name);
    const trigger = document.createElement(drawerTrigger.name);
    const content = document.createElement(drawerContent.name);
    const header = document.createElement(drawerHeader.name);
    const title = document.createElement(drawerTitle.name);
    const description = document.createElement(drawerDescription.name);
    const footer = document.createElement(drawerFooter.name);

    trigger.textContent = 'Open';
    title.textContent = 'Drawer Title';
    description.textContent = 'Drawer Description';
    footer.textContent = 'Footer Action';

    header.append(title, description);
    content.append(header, footer);
    root.append(trigger, content);
    document.body.append(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(header.getAttribute('data-pui-style')).toContain('flex-col');
    expect(footer.getAttribute('data-pui-style')).toContain('flex-col');
    expect(title.textContent).toBe('Drawer Title');
    expect(footer.textContent).toBe('Footer Action');
  });
});
