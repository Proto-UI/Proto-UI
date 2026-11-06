// Packed installed WC consumer. HappyDOM events are synthetic, not native or AT evidence.
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { loadConsumerStyles } from './consumer-smoke-css.mjs';

const installedHostVersion = createRequire(import.meta.url)('happy-dom/package.json').version;
GlobalRegistrator.register();
loadConsumerStyles(document, { evidenceName: 'cli-wc-checkbox-label' });
const facade = await import('./proto-ui/components/wc/index.ts');
const { createShadcnCheckboxLabelComposition } =
  await import('@proto.ui/prototypes-shadcn/checkbox');
const { setElementAssociations, setElementProps } = await import('@proto.ui/adapter-web-component');

let stage = 'imports-complete';
// Independent row receipt: which named contract cases this host actually ran,
// and which of the shared case names remain native-only. Printed even on
// failure so an interrupted row is never indistinguishable from a passing one.
const attemptedCases = [];
const nativeOnlyCases = [
  'rich-label-naming',
  'focused-space',
  'removal-without-observed-pageerror',
];
let hostOrder = null;
function attempt(name) {
  attemptedCases.push(name);
}
// Observe fatal async failures without installing an exception/rejection handler
// that would suppress Node's default nonzero exit.
Error.stackTraceLimit = 40;
process.on('uncaughtExceptionMonitor', (error, origin) => {
  console.error(`packed WC Checkbox+Label fatal ${origin} at ${stage}`, error);
});
function checkpoint(next) {
  stage = next;
  console.log(`packed WC Checkbox+Label stage: ${stage}`);
}
// Independent platform canary: no Proto definitions, adapter, context or timers.
// Record the actual host order from real connectedCallback invocations, then
// require specification order. The required Checkbox context subscription runs
// during the Indicator's own connect, so a host that connects the preassembled
// child first cannot serve that subtree; that is a host prerequisite failure,
// not a packed-delivery result. Nothing here reorders insertion, installs a
// callback, or replaces the explicit case.
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
      host: 'installed-happy-dom',
      hostVersion: installedHostVersion,
      observed: order,
      specificationOrder: ['parent', 'child'],
      nativeAcceptance: 'not-run',
    })
  );
  wrapper.remove();
  assert.deepEqual(
    order,
    ['parent', 'child'],
    `installed-happy-dom ${installedHostVersion} connected the preassembled subtree out of specification order`
  );
  return order;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
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
  for (const token of tokens) assert(actual.has(token), `missing delivered style token ${token}`);
}

let primaryError;
try {
  checkpoint('platform-order-canary');
  hostOrder = observePreassembledCustomElementOrder();
  checkpoint('default-pairs');
  attempt('default');
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
  assert.notEqual(
    first.pair.control.instanceAssociations.controlLabel,
    neighbor.pair.control.instanceAssociations.controlLabel
  );
  attempt('pair-isolation');
  assert.equal(indicators(first.control).length, 1, 'default facade must supply Indicator only');
  assert.equal(
    first.control.querySelector('proto-ui-shadcn-label'),
    null,
    'Label remains independent'
  );
  assert.equal(first.control.getAttribute('aria-labelledby'), first.label.id);
  assert(first.label.id);
  assert.equal(first.control.getAttribute('aria-label'), null, 'no duplicate hidden naming');
  hasTokens(first.control, ['size-4', 'shrink-0', 'border']);
  hasTokens(first.label, ['flex', 'text-sm', 'font-medium', 'leading-none']);
  assert.equal(
    getComputedStyle(first.label).display,
    'flex',
    'delivered generated Label CSS applies'
  );
  assert.equal(
    getComputedStyle(first.control).flexShrink,
    '0',
    'delivered generated control CSS applies'
  );
  checkpoint('rich-label-activation');
  attempt('label-pointer');
  press(strong);
  await settle();
  assert.equal(changes, 1);
  assert.equal(first.control.getAttribute('aria-checked'), 'true');
  assert.equal(neighbor.control.getAttribute('aria-checked'), 'false');
  assert.equal(document.activeElement, first.control);
  checkpoint('direct-control-activation');
  attempt('direct-pointer');
  press(first.control);
  await settle();
  assert.equal(changes, 2);
  assert.equal(first.control.getAttribute('aria-checked'), 'false');
  checkpoint('interactive-descendant');
  attempt('interactive-descendant-exclusion');
  const action = document.createElement('button');
  action.textContent = 'Separate action';
  first.label.append(action);
  press(action);
  await settle();
  assert.equal(changes, 2, 'interactive descendant must not also activate control');

  checkpoint('explicit-and-state-cases');
  // The preassembled explicit Indicator is the known red case on this host: the
  // installed host connects the child before its parent, so the composite mount
  // throws before the remaining rows can be observed. Record that one failure
  // and keep every following independent row executable. The insertion and its
  // assertion stay unmodified, and the fixture still exits nonzero.
  let explicitFailure;
  let explicit;
  attempt('preassembled-explicit');
  try {
    explicit = mount({ indicator: 'explicit' });
  } catch (error) {
    explicitFailure = error;
    console.error(`packed WC Checkbox+Label independent case failure at ${stage}`, error);
  }
  const omitted = mount({ indicator: 'none' });
  const raw = mount({ raw: true });
  const disabled = mount({ props: { disabled: true, defaultChecked: true } });
  const controlled = mount({ props: { checked: false } });
  const mixed = mount({ props: { defaultIndeterminate: true } });
  attempt('omitted-indicator');
  attempt('raw-root');
  attempt('disabled');
  attempt('controlled-rejection');
  attempt('mixed');
  let disabledRequests = 0,
    controlledRequests = 0;
  disabled.control.addEventListener('checkedChange', () => disabledRequests++);
  controlled.control.addEventListener('checkedChange', () => controlledRequests++);
  await settle();
  if (explicit) {
    assert.equal(indicators(explicit.control).length, 1, 'explicit Indicator must not duplicate');
  }
  assert.equal(indicators(omitted.control).length, 0, 'default Indicator omission stays supported');
  assert.equal(indicators(raw.control).length, 0, 'raw Root stays raw');
  assert.equal(mixed.control.getAttribute('aria-checked'), 'mixed');
  checkpoint('disabled-controlled-mixed');
  press(disabled.label);
  press(controlled.label);
  press(mixed.label);
  await settle();
  assert.equal(disabledRequests, 0);
  assert.equal(disabled.control.getAttribute('aria-checked'), 'true');
  assert.equal(controlledRequests, 1);
  assert.equal(
    controlled.control.getAttribute('aria-checked'),
    'false',
    'controlled rejection remains owned by Checkbox'
  );
  assert.equal(mixed.control.getAttribute('aria-checked'), 'true');
  checkpoint('naming-only');
  attempt('naming-only');
  setElementProps(controlled.label, { naming: true, activation: false });
  await settle();
  press(controlled.label);
  await settle();
  assert.equal(controlledRequests, 1, 'raw naming-only Label must not activate');
  assert.equal(controlled.control.getAttribute('aria-labelledby'), controlled.label.id);
  checkpoint('label-detach');
  attempt('detached-label-programmatic-regression');
  first.label.remove();
  await settle();
  press(first.label);
  await settle();
  assert.equal(changes, 2, 'detached Label must not activate its former control');
  if (explicitFailure) {
    throw new AggregateError(
      [explicitFailure],
      'packed WC synthetic explicit preassembly failed; independent rows above were executed'
    );
  }
  console.log(
    'packed WC Checkbox+Label ok: actual public helper + generated facade + CSS; synthetic host only'
  );
} catch (error) {
  primaryError = error;
  console.error(`packed WC Checkbox+Label primary failure at ${stage}`, error);
  throw error;
} finally {
  checkpoint('cleanup');
  console.log(
    JSON.stringify({
      kind: 'checkbox-label-packed-wc-synthetic-cases',
      host: 'installed-happy-dom',
      hostVersion: installedHostVersion,
      hostOrder,
      specificationOrder: ['parent', 'child'],
      attemptedCases,
      nativeOnlyCases,
      syntheticAcceptance: 'synthetic-host-only-not-native-or-at',
    })
  );
  try {
    document.body.replaceChildren();
    await settle();
    GlobalRegistrator.unregister();
  } catch (cleanupError) {
    console.error('packed WC Checkbox+Label cleanup failure', cleanupError);
    if (primaryError) {
      throw new AggregateError([primaryError, cleanupError], 'WC fixture and cleanup both failed');
    }
    throw cleanupError;
  }
}
