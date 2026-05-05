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
// shadcn's feedback.style stamps the `group/button` token chain.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

const Vue = await import('vue');
const { Button } = await import('./proto-ui/components/vue/index.ts');

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

const container = document.createElement('div');
document.body.appendChild(container);

const app = Vue.createApp({
  render: () => Vue.h(Button, null, () => 'click'),
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
if (!className.includes('group/button')) {
  throw new Error(
    'vue smoke: Button host missing prototype tokens (feedback.style did not stamp); host=' +
      host.outerHTML
  );
}
if (!host.textContent || !host.textContent.includes('click')) {
  throw new Error('vue smoke: Button host did not render slot text; host=' + host.outerHTML);
}

console.log('vue smoke ok | ' + host.outerHTML.length + 'B');
