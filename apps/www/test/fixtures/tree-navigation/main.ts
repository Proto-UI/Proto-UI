import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { treeRoot, treeItem } from '@proto.ui/prototypes-base/tree';
import { activationSnapshot } from './activation-snapshot';

const disabledParent = new URLSearchParams(location.search).get('parent') !== 'enabled';
const Root = AdaptToWebComponent(treeRoot);
const Item = AdaptToWebComponent(treeItem);
const root = new Root();
const parent = new Item();
const child = new Item();
parent.id = 'parent';
child.id = 'child';
parent.textContent = 'Parent';
child.textContent = 'Child';
setElementProps(root, { expandedKeys: ['p'], a11yLabel: 'Navigation test' });
setElementProps(parent, { nodeKey: 'p', disabled: disabledParent });
setElementProps(child, { nodeKey: 'c', parentKey: 'p' });
const changes: string[] = [];
root.addEventListener('valueChange', (event) => {
  changes.push((event as CustomEvent<{ value: string }>).detail.value);
});
root.append(parent, child);
document.querySelector('#app')!.append(root);
document.querySelector('#scenario')!.textContent =
  `WC / controlled expansion / ${disabledParent ? 'disabled' : 'enabled'} parent`;
void activationSnapshot().then((snapshot) => {
  (window as any).treeNavigation = {
    read() {
      const items = [parent, child].map((item) => ({
        id: item.id,
        focused: document.activeElement === item,
        focusFact: item.getExposes().focused.get(),
        tabIndex: item.tabIndex,
        disabled: item.getExposes().disabled.get(),
        hidden: item.getExposes().hidden.get(),
        selected: item.getAttribute('aria-selected'),
      }));
      return {
        value: root.getExposes().value.get(),
        expandedKeys: root.getExposes().getExpandedKeys(),
        changes: [...changes],
        items,
        tabEntries: items
          .filter((item) => item.tabIndex >= 0 && !item.disabled && !item.hidden)
          .map((item) => item.id),
        portableDeclaration: snapshot,
      };
    },
  };
  document.body.dataset.ready = 'true';
});
