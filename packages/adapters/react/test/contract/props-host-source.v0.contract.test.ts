import { describeAdapterPropsHostSourceConformance } from '../../../base/test-utils/props-host-source';
import { createMountedReactAdapter } from '../utils/fake-react';

describeAdapterPropsHostSourceConformance({
  adapterName: 'adapter-react',
  mount(proto, props) {
    const mounted = createMountedReactAdapter(proto, props, {
      autoUpdateOnPropsChange: false,
    });

    return {
      updateHostProps(nextProps) {
        mounted.update(nextProps);
      },
      syncRuntime() {
        mounted.ref.current.update();
        mounted.update();
      },
      readRenderedValue() {
        return mounted.root?.textContent ?? null;
      },
      unmount() {
        mounted.unmount();
      },
    };
  },
});
