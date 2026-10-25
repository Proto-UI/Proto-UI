// Additive browser-realm replay of wc-checkbox-label.mjs; not trusted-input or AT evidence.
// Preserve the original operation order, predicate arguments and 50 ms settles.
let stage = 'imports-start';
const checkpoints = [];
let outcome = 'failed';
let failureStage = null;
let error = null;
let cleanupError = null;
let facade, createShadcnCheckboxLabelComposition, setElementAssociations, setElementProps;
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const serializeError = (cause) => ({ name: String(cause?.name ?? 'Error'), message: String(cause?.message ?? cause), stack: typeof cause?.stack === 'string' ? cause.stack : null });
function checkpoint(next) {
  stage = next;
  checkpoints.push(next);
  console.info(`packed WC Checkbox+Label browser replay stage: ${stage}`);
}
try {
  facade = await import('./proto-ui/components/wc/index.ts');
  ({ createShadcnCheckboxLabelComposition } =
    await import('@proto.ui/prototypes-shadcn/checkbox'));
  ({ setElementAssociations, setElementProps } = await import('@proto.ui/adapter-web-component'));
  checkpoint('imports-complete');
// Independent platform canary: no Proto definitions, adapter, context or timers.
// Record the actual host order; do not repair it or replace the explicit case.
function observePreassembledCustomElementOrder() {
  const order = [];
  class OrderingParent extends HTMLElement {
    connectedCallback() {
      order.push('parent');
    }
  }
  class OrderingChild extends HTMLElement {
    connectedCallback() {
      order.push('child');
    }
  }
  customElements.define('pui-smoke-ordering-parent', OrderingParent);
  customElements.define('pui-smoke-ordering-child', OrderingChild);
  const wrapper = document.createElement('div');
  const parent = new OrderingParent();
  parent.append(new OrderingChild());
  wrapper.append(parent);
  document.body.append(wrapper);
  console.log(
    JSON.stringify({
      kind: 'preassembled-custom-element-order',
      host: 'native-chromium-programmatic-replay',
      observed: order,
      specificationOrder: ['parent', 'child'],
      nativeAcceptance: 'separate-trusted-pointer-fixture-required',
    })
  );
  wrapper.remove();
}

function press(element) {
  element.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  element.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1, button: 0 })
  );
  element.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, button: 0, detail: 1 })
  );
}
function mount({ props = {}, indicator = 'default', raw = false } = {}) {
  checkpoint(`mount:start:${raw ? 'raw' : indicator}:${JSON.stringify(props)}`);
  const pair = createShadcnCheckboxLabelComposition();
  const control = raw ? new facade.ShadcnCheckboxRootElement() : new facade.ShadcnCheckboxElement();
  const label = new facade.ShadcnLabelRootElement();
  if (indicator === 'explicit') control.append(new facade.ShadcnCheckboxIndicatorElement());
  if (indicator === 'none') control.setAttribute('data-pui-no-default-indicator', '');
  label.textContent = 'Receive updates';
  setElementProps(control, props);
  setElementProps(label, pair.label.props);
  setElementAssociations(control, pair.control.instanceAssociations);
  setElementAssociations(label, pair.label.instanceAssociations);
  const container = document.createElement('div');
  container.append(control, label);
  document.body.append(container);
  checkpoint(`mount:connected:${raw ? 'raw' : indicator}:${JSON.stringify(props)}`);
  return { pair, control, label, container };
}
function indicators(control) {
  return [...control.children].filter(
    (child) => child.localName === 'proto-ui-shadcn-checkbox-indicator'
  );
}
function hasTokens(element, tokens) {
  const actual = new Set((element.getAttribute('data-pui-style') ?? '').split(/\s+/));
  for (const token of tokens) if (!(actual.has(token))) throw new Error(`missing delivered style token ${token}`);
}

  checkpoint('platform-order-canary');
  observePreassembledCustomElementOrder();
  checkpoint('default-pairs');
  const first = mount(),
    neighbor = mount();
  const strong = document.createElement('strong');
  strong.textContent = 'Receive updates';
  const decoration = document.createElement('span');
  decoration.textContent = '✓';
  decoration.setAttribute('aria-hidden', 'true');
  first.label.replaceChildren(decoration, strong);
  let changes = 0;
  first.control.addEventListener('checkedChange', () => changes++);
  await settle();
  if (Object.is(first.pair.control.instanceAssociations.controlLabel, neighbor.pair.control.instanceAssociations.controlLabel)) throw new Error('original predicate 2 failed');
  if (!Object.is(indicators(first.control).length, 1)) throw new Error('default facade must supply Indicator only');
  if (!Object.is(first.control.querySelector('proto-ui-shadcn-label'), null)) throw new Error('Label remains independent');
  if (!Object.is(first.control.getAttribute('aria-labelledby'), first.label.id)) throw new Error('original predicate 5 failed');
  if (!(first.label.id)) throw new Error('original predicate 6 failed');
  if (!Object.is(first.control.getAttribute('aria-label'), null)) throw new Error('no duplicate hidden naming');
  hasTokens(first.control, ['size-4', 'shrink-0', 'border']);
  hasTokens(first.label, ['flex', 'text-sm', 'font-medium', 'leading-none']);
  if (!Object.is(getComputedStyle(first.label).display, 'flex')) throw new Error('delivered generated Label CSS applies');
  if (!Object.is(getComputedStyle(first.control).flexShrink, '0')) throw new Error('delivered generated control CSS applies');
  checkpoint('rich-label-activation');
  press(strong);
  await settle();
  if (!Object.is(changes, 1)) throw new Error('original predicate 10 failed');
  if (!Object.is(first.control.getAttribute('aria-checked'), 'true')) throw new Error('original predicate 11 failed');
  if (!Object.is(neighbor.control.getAttribute('aria-checked'), 'false')) throw new Error('original predicate 12 failed');
  if (!Object.is(document.activeElement, first.control)) throw new Error('original predicate 13 failed');
  checkpoint('direct-control-activation');
  press(first.control);
  await settle();
  if (!Object.is(changes, 2)) throw new Error('original predicate 14 failed');
  if (!Object.is(first.control.getAttribute('aria-checked'), 'false')) throw new Error('original predicate 15 failed');
  checkpoint('interactive-descendant');
  const action = document.createElement('button');
  action.textContent = 'Separate action';
  first.label.append(action);
  press(action);
  await settle();
  if (!Object.is(changes, 2)) throw new Error('interactive descendant must not also activate control');

  checkpoint('explicit-and-state-cases');
  const explicit = mount({ indicator: 'explicit' });
  const omitted = mount({ indicator: 'none' });
  const raw = mount({ raw: true });
  const disabled = mount({ props: { disabled: true, defaultChecked: true } });
  const controlled = mount({ props: { checked: false } });
  const mixed = mount({ props: { defaultIndeterminate: true } });
  let disabledRequests = 0,
    controlledRequests = 0;
  disabled.control.addEventListener('checkedChange', () => disabledRequests++);
  controlled.control.addEventListener('checkedChange', () => controlledRequests++);
  await settle();
  if (!Object.is(indicators(explicit.control).length, 1)) throw new Error('explicit Indicator must not duplicate');
  if (!Object.is(indicators(omitted.control).length, 0)) throw new Error('default Indicator omission stays supported');
  if (!Object.is(indicators(raw.control).length, 0)) throw new Error('raw Root stays raw');
  if (!Object.is(mixed.control.getAttribute('aria-checked'), 'mixed')) throw new Error('original predicate 20 failed');
  checkpoint('disabled-controlled-mixed');
  press(disabled.label);
  press(controlled.label);
  press(mixed.label);
  await settle();
  if (!Object.is(disabledRequests, 0)) throw new Error('original predicate 21 failed');
  if (!Object.is(disabled.control.getAttribute('aria-checked'), 'true')) throw new Error('original predicate 22 failed');
  if (!Object.is(controlledRequests, 1)) throw new Error('original predicate 23 failed');
  if (!Object.is(controlled.control.getAttribute('aria-checked'), 'false')) throw new Error('controlled rejection remains owned by Checkbox');
  if (!Object.is(mixed.control.getAttribute('aria-checked'), 'true')) throw new Error('original predicate 25 failed');
  checkpoint('naming-only');
  setElementProps(controlled.label, { naming: true, activation: false });
  await settle();
  press(controlled.label);
  await settle();
  if (!Object.is(controlledRequests, 1)) throw new Error('raw naming-only Label must not activate');
  if (!Object.is(controlled.control.getAttribute('aria-labelledby'), controlled.label.id)) throw new Error('original predicate 27 failed');
  checkpoint('label-detach');
  first.label.remove();
  await settle();
  press(first.label);
  await settle();
  if (!Object.is(changes, 2)) throw new Error('detached Label must not activate its former control');
  console.log(
    'packed WC Checkbox+Label ok: actual public helper + generated facade + CSS; browser-realm programmatic replay only'
  );
  outcome = 'passed';
} catch (cause) {
  failureStage = stage;
  error = serializeError(cause);
} finally {
  checkpoint('cleanup');
  try {
    document.body.replaceChildren();
    await settle();
  } catch (cause) {
    cleanupError = serializeError(cause);
    if (!failureStage) failureStage = 'cleanup';
    outcome = 'failed';
  }
  // Publish only after cleanup; imports can fail before any other checkpoint.
  window.packedCheckboxReplay = { checkpoints, outcome, failureStage, error, cleanupError };
}
