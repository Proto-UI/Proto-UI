import { AdaptToWebComponent, setElementProps } from '../src';
import {
  ruleWebAdapterConformance,
  type RuleWebProps,
} from '../../base/test/fixtures/rule-expose-state-web-conformance';
ruleWebAdapterConformance('wc', async (proto) => {
  if (!customElements.get(proto.name)) AdaptToWebComponent(proto);
  const host = document.createElement('div'),
    el = document.createElement(proto.name);
  el.className = 'rule-user-class';
  host.append(el);
  document.body.append(host);
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return {
    host,
    flush,
    async setProps(props: RuleWebProps) {
      setElementProps(el, props);
      (el as HTMLElement & { update(): void }).update();
      await flush();
    },
    async click(target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    },
    async unmount() {
      host.remove();
      await flush();
    },
  };
});
