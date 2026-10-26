// Shared platform-only diagnostic. No imports, Proto calls, timers or host patches.
// Both fresh realms call this exact function with their own standard DOM globals.
export function observeStandaloneConnectionOrder() {
  const observations = [];
  const errors = [];
  let wrapper;
  const record = (element, role) => observations.push({
    role,
    isConnected: element.isConnected,
    parentNode: element.parentNode?.localName ?? null,
  });
  try {
    class OrderingParent extends HTMLElement {
      connectedCallback() { record(this, 'parent'); }
    }
    class OrderingChild extends HTMLElement {
      connectedCallback() { record(this, 'child'); }
    }
    customElements.define('pui-isolated-order-parent', OrderingParent);
    customElements.define('pui-isolated-order-child', OrderingChild);
    const parent = new OrderingParent();
    parent.append(new OrderingChild());
    wrapper = document.createElement('div');
    wrapper.append(parent);
    document.body.append(wrapper);
  } catch (error) {
    errors.push({ phase: 'connect', name: error.name, message: error.message });
  } finally {
    try { wrapper?.remove(); } catch (error) {
      errors.push({ phase: 'cleanup', name: error.name, message: error.message });
    }
  }
  return {
    observations,
    observedOrder: observations.map(({ role }) => role),
    specificationOrder: ['parent', 'child'],
    errors,
    acceptance: 'diagnostic-only-not-product-or-host-admission',
  };
}
