// Web Component smoke. See react.mjs comment for the .mjs / runtime-path rationale.
//
// AdaptToWebComponent registers the custom element as a side effect at module
// load time, so just importing the wc facade should leave proto-ui-shadcn-button
// reachable through customElements. happy-dom provides the DOM globals that the
// adapter and the registry need.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

await import('./proto-ui/components/wc/index.ts');

const tag = 'proto-ui-shadcn-button';
const ctor = customElements.get(tag);
if (!ctor) {
  throw new Error('wc smoke: ' + tag + ' was not registered with customElements');
}

const el = document.createElement(tag);
if (!(el instanceof HTMLElement)) {
  throw new Error('wc smoke: createElement did not produce HTMLElement');
}
document.body.appendChild(el);

console.log('wc smoke ok | ' + tag + ' registered, instance tagName=' + el.tagName);
