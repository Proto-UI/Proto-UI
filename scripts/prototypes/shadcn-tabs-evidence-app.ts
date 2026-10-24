import {
  AdaptToWebComponent,
  setElementProps,
} from '../../packages/adapters/web-component/src/index';
import {
  tabsRoot,
  tabsList,
  tabsTrigger,
  tabsContent,
  SHADCN_TABS_TEXT_DEFAULT_STYLES,
} from '../../packages/prototypes/shadcn/src/tabs';
import { styleScope } from '../../packages/prototypes/shadcn/src/style-scope';
[styleScope, tabsRoot, tabsList, tabsTrigger, tabsContent].forEach((p) =>
  AdaptToWebComponent(p as any)
);
const records: any[] = [];
function el(name: string, props: Record<string, unknown> = {}) {
  const node = document.createElement(name) as any;
  setElementProps(node, props);
  return node;
}
for (const style of SHADCN_TABS_TEXT_DEFAULT_STYLES) {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = style;
  section.append(title);
  for (const orientation of ['horizontal', 'vertical']) {
    const label = document.createElement('h3');
    label.textContent = orientation;
    section.append(label);
    const scope = el('shadcn-style-scope', { styleProfile: style });
    const root = el('shadcn-tabs-root', {
      defaultValue: 'account',
      orientation,
      activationMode: 'manual',
    });
    const list = el('shadcn-tabs-list');
    const triggers = ['account', 'password', 'disabled'].map((value) => {
      const item = el('shadcn-tabs-trigger', { value, disabled: value === 'disabled' });
      item.textContent = value[0].toUpperCase() + value.slice(1);
      list.append(item);
      return item;
    });
    const content = el('shadcn-tabs-content', { value: 'account', keepMounted: true });
    content.textContent = 'Update your account settings.';
    root.append(list, content);
    scope.append(root);
    section.append(scope);
    records.push({ scope, root, list, triggers, content, style, orientation });
  }
  document.querySelector('main')!.append(section);
}
(window as any).tabsEvidence = { records, setElementProps };
document.documentElement.dataset.ready = 'true';
