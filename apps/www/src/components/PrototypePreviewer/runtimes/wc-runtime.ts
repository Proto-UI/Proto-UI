import { setElementProps } from '@proto.ui/adapter-web-component';
import type { RuntimeAPI } from './registry';
import { ensurePreviewWcRegistered } from '../wc-registry';
import { claimHostMount, releaseHostMount } from './host-mount';

export const runtime: RuntimeAPI = {
  id: 'wc',
  label: 'Web Components',

  async mount(host, prototype, options) {
    const lease = claimHostMount(host);

    // 为预览器中的 WC 添加前缀，避免与其他 runtime 冲突
    const wcName = ensurePreviewWcRegistered(prototype.name, prototype as any);

    const el = document.createElement(wcName);
    // 传递 props
    if (options?.props) {
      setElementProps(el, options.props);
    }
    if (!lease.commit(() => el.remove())) return;
    host.appendChild(el);
  },
  unmount(host) {
    releaseHostMount(host);
  },
};
