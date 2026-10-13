// Run inside the cli-smoke workflow only. Imports a runtime path that exists
// in the smoke project (./proto-ui/components/vue) but not in the source
// repo, so tsc must not pick this up — keep the extension as .mjs (Node ESM,
// JS).
//
// We don't use vue/server-renderer here: the v0 Vue adapter renders a
// client-only host placeholder during SSR (output is `<div></div>` with no
// prototype tokens applied), so SSR would only test the placeholder, not the
// real prototype output. happy-dom's GlobalRegistrator gives us a real DOM,
// then createApp().mount() + a microtask flush lets the prototype mount and
// stamp its feedback tokens onto the host — matching what an SPA user sees.
//
// We also import from the per-host facade rather than the root re-export
// because the root index also re-exports the wc facade, whose
// AdaptToWebComponent extends HTMLElement at module load. Even with happy-dom
// registered globally, importing the root facade would still register
// customElements as a side effect of importing vue bits, which we keep
// scoped to wc.mjs.
//
// What we assert: v0's Vue adapter renders the host as `rootTag` (default
// `div`), so we don't query for `<button>`. shadcn-button pulls in
// asFocusable via asButton, so the focus module stamps `tabindex="0"`, and
// shadcn's feedback.style stamps the pinned New York paint token chain.
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import {
  assertStyledButton,
  assertStyledSwitch,
  assertSwitchThumbState,
  loadConsumerStyles,
} from './consumer-smoke-css.mjs';

GlobalRegistrator.register();
loadConsumerStyles(document, { evidenceName: 'cli-vue' });

const Vue = await import('vue');
const { ShadcnButton, ShadcnDialogContent, ShadcnDialogRoot, ShadcnSwitch, BaseImageRoot } =
  await import('./proto-ui/components/vue/index.ts');

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

const container = document.createElement('div');
document.body.appendChild(container);

const app = Vue.createApp({
  render: () => Vue.h(ShadcnButton, { class: 'user-added' }, () => 'click'),
});
app.mount(container);
await flush();

const host = container.firstElementChild;
if (!host) {
  throw new Error(
    'vue smoke: Button did not render a host element; container=' + container.innerHTML
  );
}
if (host.getAttribute('tabindex') !== '0') {
  throw new Error(
    'vue smoke: Button host missing tabindex="0" (focus module did not attach); host=' +
      host.outerHTML
  );
}
const className = host.getAttribute('class') || '';
assertStyledButton(host, 'vue smoke: Button');
if (!className.includes('user-added')) {
  throw new Error('vue smoke: Button host missing user class; host=' + host.outerHTML);
}
if (!host.textContent || !host.textContent.includes('click')) {
  throw new Error('vue smoke: Button host did not render slot text; host=' + host.outerHTML);
}

const presetContainer = document.createElement('div');
document.body.appendChild(presetContainer);
const presetApp = Vue.createApp({
  render: () =>
    Vue.h('div', null, [
      Vue.h(ShadcnSwitch, { defaultChecked: true, class: 'consumer-switch' }),
      Vue.h(ShadcnDialogRoot, { defaultOpen: true }, () => [
        Vue.h(ShadcnDialogContent, { class: 'consumer-dialog-content' }),
      ]),
    ]),
});
presetApp.mount(presetContainer);
await flush();

const switchRoot = presetContainer.querySelector('.consumer-switch');
assertStyledSwitch(switchRoot, 'vue smoke');
const switchThumb = switchRoot?.firstElementChild;
assertSwitchThumbState(switchRoot, true, 'vue smoke: initial checked');
switchRoot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
await flush();
if (
  switchRoot.getAttribute('aria-checked') !== 'false' ||
  switchThumb.hasAttribute('data-checked')
) {
  throw new Error('vue smoke: Switch click did not update Root and Thumb');
}
assertSwitchThumbState(switchRoot, false, 'vue smoke: after click');
const closeIcon = document.body.querySelector('.consumer-dialog-content [aria-label="Close"]');
if (!closeIcon) {
  throw new Error('vue smoke: Dialog Content preset did not mount its default CloseIcon');
}

const imageContainer = document.createElement('div');
document.body.appendChild(imageContainer);
const source =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
const imageApp = Vue.createApp({
  render: () =>
    Vue.h(BaseImageRoot, {
      source,
      a11yMode: 'informative',
      alternativeText: 'Packed Base Image',
      fit: 'cover',
    }),
});
imageApp.mount(imageContainer);
await flush();
const image = imageContainer.querySelector('img');
if (
  imageContainer.querySelectorAll('img').length !== 1 ||
  image?.getAttribute('src') !== source ||
  image.alt !== 'Packed Base Image' ||
  image.style.objectFit !== 'cover'
) {
  throw new Error(
    'vue smoke: Base Image did not project its physical image: ' + imageContainer.innerHTML
  );
}
imageApp.unmount();

console.log('vue smoke ok | Button + Switch preset + Dialog CloseIcon preset + Base Image');
