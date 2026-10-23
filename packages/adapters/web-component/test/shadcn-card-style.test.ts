import { AdaptToWebComponent, setElementProps } from '../src';
import { describeShadcnCardStyle } from '../../base/test-utils/shadcn-card-style';

describeShadcnCardStyle('wc', async (proto, options) => {
  AdaptToWebComponent(proto, options);
  const host = document.createElement('div');
  const element = document.createElement(proto.name) as HTMLElement & {
    update(): void;
    getExposes(): { view: { show(): void; hide(): void } };
  };
  host.append(element);
  document.body.append(host);
  const settle = async (action: () => void) => {
    action();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return {
    host,
    act: settle,
    setProps: (props: any, concurrent?: () => void) =>
      settle(() => {
        setElementProps(element, props);
        concurrent?.();
      }),
    setPresent: (present: boolean) =>
      settle(() => element.getExposes().view[present ? 'show' : 'hide']()),
    update: () => settle(() => element.update()),
    unmount: () => settle(() => host.remove()),
  };
});
