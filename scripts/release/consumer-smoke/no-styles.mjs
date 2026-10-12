import assert from 'node:assert/strict';
import { join } from 'node:path';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { assertPositionedSwitch, loadConsumerStyles } from './consumer-smoke-css.mjs';

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
// is independent of theme/token generation and does not position the Switch.
for (const style of document.querySelectorAll('style, link[rel="stylesheet"]')) {
  assert.equal(style.id, 'proto-ui-view-visibility', 'Base must not inject a preset stylesheet');
}
await React.act(async () => root.unmount());

const stylesBeforeUnsupported = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(
  (style) => style.outerHTML
);
const caught = [];
class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const unsupported = createRoot(container, { onCaughtError: (error) => caught.push(error) });
await React.act(async () => {
  unsupported.render(React.createElement(Boundary, null, React.createElement(ShadcnSwitch)));
  await flush();
});
assert.ok(caught.length > 0, 'unstyled Shadcn Switch must reject missing structural CSS');
for (const error of caught) {
  assert.equal(
    error.message,
    '[HitParticipation] staticHitInset unsupported: root needs an existing positioned padding-box.'
  );
}
assert.equal(
  document.querySelector('[data-pui-static-hit]'),
  null,
  'rejection must not accept a hit projection'
);
assert.deepEqual(
  [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((style) => style.outerHTML),
  stylesBeforeUnsupported,
  'rejection must not install fallback CSS'
);
await React.act(async () => unsupported.unmount());
console.log(
  'no-styles consumer: facade import + Base zero-consumer-CSS positive + Shadcn missing-CSS negative ok'
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
  assertPositionedSwitch(element, label);
  assert.equal(element.getAttribute('aria-checked'), 'true');
  await React.act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
  });
  assert.equal(element.getAttribute('aria-checked'), 'false');
  await React.act(async () => styled.unmount());
}
container.remove();
console.log(
  'no-styles consumer: explicit application-owned full CSS closure + toggle + remount ok'
);
