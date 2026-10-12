import assert from 'node:assert/strict';
import { join } from 'node:path';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import {
  assertStyledSwitch,
  assertSwitchThumbState,
  loadConsumerStyles,
} from './consumer-smoke-css.mjs';

GlobalRegistrator.register();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
// Import itself must succeed without styles, including the styled facade.
const { BaseButton, BaseSwitchRoot, BaseSwitchThumb, ShadcnSwitch } =
  await import('./proto-ui/components/react/index.ts');
const flush = () => new Promise((resolve) => setTimeout(resolve, 80));
const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
assert.equal(document.styleSheets.length, 0, 'Base case must start with zero CSS');
await React.act(async () => {
  root.render(
    React.createElement(
      'div',
      null,
      React.createElement(BaseButton, null, 'Base'),
      React.createElement(
        BaseSwitchRoot,
        { defaultChecked: true },
        React.createElement(BaseSwitchThumb)
      )
    )
  );
  await flush();
});
const base = container.querySelector('[role="switch"]');
assert.equal(base?.getAttribute('aria-checked'), 'true');
assert.ok(container.querySelector('[tabindex="0"]'), 'Base controls remain focusable');
await React.act(async () => {
  base.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flush();
});
assert.equal(base.getAttribute('aria-checked'), 'false', 'Base Switch toggles without CSS');
// No consumer CSS is supplied. The Adapter's existing view-lifecycle sheet
// is independent of theme/token generation and does not supply the Switch visual recipe.
for (const style of document.querySelectorAll('style, link[rel="stylesheet"]')) {
  assert.equal(style.id, 'proto-ui-view-visibility', 'Base must not inject a preset stylesheet');
}
await React.act(async () => root.unmount());

const stylesBeforeUnstyled = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(
  (style) => style.outerHTML
);
// New York has no staticHitInset prerequisite. Missing CSS is a visual failure,
// not a mount failure or a reason for the Adapter to inject substitute styles.
const unstyled = createRoot(container);
await React.act(async () => {
  unstyled.render(React.createElement(ShadcnSwitch, { defaultChecked: true }));
  await flush();
});
const unstyledSwitch = container.querySelector('[role="switch"]');
assert.equal(unstyledSwitch?.getAttribute('aria-checked'), 'true');
const unstyledThumb = unstyledSwitch.firstElementChild;
assert.ok(unstyledThumb?.hasAttribute('data-checked'));
assert.throws(
  () => assertStyledSwitch(unstyledSwitch, 'Shadcn zero CSS'),
  /structural CSS not applied/
);
await React.act(async () => {
  unstyledSwitch.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flush();
});
assert.equal(unstyledSwitch.getAttribute('aria-checked'), 'false');
assert.equal(unstyledThumb.hasAttribute('data-checked'), false);
assertSwitchThumbState(unstyledSwitch, false, 'Shadcn zero CSS: after click');
assert.equal(document.querySelector('[data-pui-static-hit]'), null);
assert.deepEqual(
  [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((style) => style.outerHTML),
  stylesBeforeUnstyled,
  'unstyled Switch must not install fallback CSS'
);
await React.act(async () => unstyled.unmount());
console.log(
  'no-styles consumer: Base and Shadcn semantics usable; Shadcn visual negative without fallback CSS ok'
);

loadConsumerStyles(document, {
  stylesDir: join(process.cwd(), 'consumer-owned-styles'),
  evidenceName: 'consumer-owned',
});
for (const label of ['consumer-owned mount', 'consumer-owned remount']) {
  const styled = createRoot(container);
  await React.act(async () => {
    styled.render(React.createElement(ShadcnSwitch, { defaultChecked: true }));
    await flush();
  });
  const element = container.querySelector('[role="switch"]');
  assertStyledSwitch(element, label);
  assert.equal(element.getAttribute('aria-checked'), 'true');
  await React.act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
  });
  assert.equal(element.getAttribute('aria-checked'), 'false');
  assertSwitchThumbState(element, false, `${label}: after click`);
  await React.act(async () => styled.unmount());
}
container.remove();
console.log(
  'no-styles consumer: explicit application-owned full CSS closure + toggle + remount ok'
);
