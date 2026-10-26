// Packed installed WC consumer. HappyDOM events are synthetic, not native or AT evidence.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { loadConsumerStyles } from './consumer-smoke-css.mjs';

GlobalRegistrator.register();
loadConsumerStyles(document, { evidenceName: 'cli-wc-checkbox-label' });
const facade = await import('./proto-ui/components/wc/index.ts');
const { createShadcnCheckboxLabelComposition } =
  await import('@proto.ui/prototypes-shadcn/checkbox');
const { setElementAssociations, setElementProps } = await import('@proto.ui/adapter-web-component');

let stage = 'imports-complete';
// Observation only: never handles/suppresses an exception, changes an action,
// schedules work, or declares a failed synthetic run successful.
const receipt = {
  kind: 'checkbox-label-synthetic-process-receipt', version: 1,
  fixtureSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  checkpoints: [stage], platformOrder: null, primary: null, cleanup: null,
  cleanupCompleted: false, fatal: [],
};
const describeError = (error) => ({
  name: error?.name ?? null, code: error?.code ?? null,
  message: error?.message ?? null, stack: error?.stack ?? null,
});
process.on('exit', (exitCode) => {
  const final = { ...receipt, final: true, exitCode, finalStage: stage };
  // Fixed local sidecar, not an environment-selected output destination.
  writeFileSync('checkbox-label-synthetic-receipt.json', JSON.stringify(final));
  console.error(JSON.stringify(final));
});
// Observe fatal async failures without installing an exception/rejection handler
// that would suppress Node's default nonzero exit.
Error.stackTraceLimit = 40;
process.on('uncaughtExceptionMonitor', (error, origin) => {
  receipt.fatal.push({ origin, stage, sameAsPrimary: error === primaryError, error: describeError(error) });
  console.error(`packed WC Checkbox+Label fatal ${origin} at ${stage}`, error);
});
function checkpoint(next) {
  stage = next;
  receipt.checkpoints.push(stage);
  console.log(`packed WC Checkbox+Label stage: ${stage}`);
}
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
      host: 'installed-happy-dom',
      observed: order,
      specificationOrder: ['parent', 'child'],
      nativeAcceptance: 'not-run',
    })
  );
  receipt.platformOrder = [...order];
  wrapper.remove();
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
  assert.notEqual(
    first.pair.control.instanceAssociations.controlLabel,
    neighbor.pair.control.instanceAssociations.controlLabel
  );
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
  press(strong);
  await settle();
  assert.equal(changes, 1);
  assert.equal(first.control.getAttribute('aria-checked'), 'true');
  assert.equal(neighbor.control.getAttribute('aria-checked'), 'false');
  assert.equal(document.activeElement, first.control);
  checkpoint('direct-control-activation');
  press(first.control);
  await settle();
  assert.equal(changes, 2);
  assert.equal(first.control.getAttribute('aria-checked'), 'false');
  checkpoint('interactive-descendant');
  const action = document.createElement('button');
  action.textContent = 'Separate action';
  first.label.append(action);
  press(action);
  await settle();
  assert.equal(changes, 2, 'interactive descendant must not also activate control');

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
  assert.equal(indicators(explicit.control).length, 1, 'explicit Indicator must not duplicate');
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
  setElementProps(controlled.label, { naming: true, activation: false });
  await settle();
  press(controlled.label);
  await settle();
  assert.equal(controlledRequests, 1, 'raw naming-only Label must not activate');
  assert.equal(controlled.control.getAttribute('aria-labelledby'), controlled.label.id);
  checkpoint('label-detach');
  first.label.remove();
  await settle();
  press(first.label);
  await settle();
  assert.equal(changes, 2, 'detached Label must not activate its former control');
  console.log(
    'packed WC Checkbox+Label ok: actual public helper + generated facade + CSS; synthetic host only'
  );
} catch (error) {
  primaryError = error;
  receipt.primary = { stage, error: describeError(error) };
  console.error(`packed WC Checkbox+Label primary failure at ${stage}`, error);
  throw error;
} finally {
  checkpoint('cleanup');
  try {
    document.body.replaceChildren();
    await settle();
    GlobalRegistrator.unregister();
    receipt.cleanupCompleted = true;
  } catch (cleanupError) {
    receipt.cleanup = { stage, error: describeError(cleanupError) };
    console.error('packed WC Checkbox+Label cleanup failure', cleanupError);
    if (primaryError) {
      throw new AggregateError([primaryError, cleanupError], 'WC fixture and cleanup both failed');
    }
    throw cleanupError;
  }
}
