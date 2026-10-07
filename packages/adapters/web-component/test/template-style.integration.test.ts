import { AdaptToWebComponent } from '../src';
import { templateStyleConformance } from '../../base/test/fixtures/template-style-conformance';

templateStyleConformance('wc', async (proto) => {
  const host = document.createElement('div');
  if (!customElements.get(proto.name)) AdaptToWebComponent(proto);
  const root = document.createElement(proto.name) as HTMLElement & { update(): void };
  root.className = 'caller-root p-8';
  root.setAttribute('data-pui-style', 'p-6');
  const slot = document.createElement('b');
  slot.setAttribute('data-caller-slot', '');
  slot.className = 'caller-slot p-8';
  slot.setAttribute('data-pui-style', 'p-6 opacity-100');
  slot.textContent = 'caller';
  root.append(slot);
  host.append(root);
  document.body.append(host);
  const settle = async (action: () => void) => {
    action();
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return {
    host,
    update: () => settle(() => root.update()),
    async unmount() {
      await settle(() => host.remove());
    },
  };
});
