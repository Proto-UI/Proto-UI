import { GlobalRegistrator } from '@happy-dom/global-registrator';
import {
  assertStyledButton,
  assertStyledSwitch,
  assertSwitchThumbState,
  loadConsumerStyles,
} from './consumer-smoke-css.mjs';

GlobalRegistrator.register();
loadConsumerStyles(document, { evidenceName: 'react-vite' });
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const React = await import('react');
const ReactDOMClient = await import('react-dom/client');
const { App } = await import('./src/App');

const flush = () => new Promise((resolve) => setTimeout(resolve, 80));

async function mountAndAssert(label: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);
  await React.act(async () => {
    root.render(React.createElement(App));
    await flush();
  });

  const main = container.querySelector('main');
  assert(main?.getAttribute('data-consumer-ready') === 'true', `${label}: async update failed`);

  const button = container.querySelector('.consumer-button');
  assert(button?.getAttribute('tabindex') === '0', `${label}: Button is not focusable`);
  assert(button?.getAttribute('aria-disabled') === 'false', `${label}: Button prop update failed`);
  assertStyledButton(button, `${label}: Button`);

  const switchRoot = container.querySelector('.consumer-switch');
  assertStyledSwitch(switchRoot, label);
  assert(switchRoot?.getAttribute('role') === 'switch', `${label}: Switch role is missing`);
  assert(switchRoot?.getAttribute('aria-checked') === 'true', `${label}: Switch state is missing`);
  const switchThumb = switchRoot?.firstElementChild;
  assert(switchThumb?.hasAttribute('data-checked'), `${label}: Switch Thumb state is missing`);
  assertSwitchThumbState(switchRoot, true, `${label}: initial checked`);
  await React.act(async () => {
    switchRoot?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
  });
  assert(switchRoot?.getAttribute('aria-checked') === 'false', `${label}: Switch click failed`);
  assert(!switchThumb?.hasAttribute('data-checked'), `${label}: Switch Thumb did not update`);
  assertSwitchThumbState(switchRoot, false, `${label}: after click`);

  const selectTrigger = container.querySelector('.consumer-select-trigger');
  assert(selectTrigger?.getAttribute('role') === 'combobox', `${label}: Select role is missing`);
  assert(selectTrigger?.getAttribute('aria-expanded') === 'true', `${label}: Select did not open`);
  const selectedOption = document.body.querySelector('[role="option"][aria-selected="true"]');
  assert(selectedOption?.textContent?.includes('Comfortable'), `${label}: Select value is missing`);

  const dialog = document.body.querySelector('[role="dialog"]');
  assert(dialog, `${label}: Dialog role is missing`);
  assert(
    dialog?.getAttribute('aria-label') === 'Preference details' ||
      dialog?.getAttribute('aria-labelledby'),
    `${label}: Dialog accessible name is missing`
  );

  await React.act(async () => root.unmount());
  container.remove();
  await flush();
}

await mountAndAssert('first mount');
await mountAndAssert('remount');

console.log(
  'react consumer runtime smoke ok | Button + Switch + Select + Dialog + async + remount'
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
