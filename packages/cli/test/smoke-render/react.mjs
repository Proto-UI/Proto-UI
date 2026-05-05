// Run inside the cli-smoke workflow only. Imports a runtime path that exists
// in the smoke project (./proto-ui/components/react) but not in the source
// repo, so tsc must not pick this up — keep the extension as .mjs (Node ESM,
// JS).
//
// We don't use react-dom/server here: the v0 React adapter renders a
// client-only host placeholder during SSR (output is `<div></div>` with no
// prototype tokens applied), so SSR would only test the placeholder, not the
// real prototype output. happy-dom's GlobalRegistrator gives us a real DOM,
// then react-dom/client + a microtask flush lets the prototype mount and
// stamp its feedback tokens onto the host — matching what an SPA user sees.
//
// We also import from the per-host facade rather than the root re-export
// because the root index also re-exports the wc facade, whose
// AdaptToWebComponent extends HTMLElement at module load. Even with happy-dom
// registered globally, importing the root facade would still register
// customElements as a side effect of importing react bits, which we keep
// scoped to wc.mjs.
//
// What we assert: v0's React adapter renders the host as `rootTag` (default
// `div`), so we don't query for `<button>`. Both shadcn-button and base-button
// pull in asFocusable via asButton, so the focus module stamps `tabindex="0"`
// onto the host. Shadcn additionally stamps its feedback.style class tokens,
// so we assert `group/button` only on the shadcn host.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

const React = await import('react');
const ReactDOMClient = await import('react-dom/client');
const { Button, BaseButton } = await import('./proto-ui/components/react/index.ts');

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

async function renderHost(label, Component) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);
  root.render(React.createElement(Component, null, 'click'));
  await flush();
  const host = container.firstElementChild;
  if (!host) {
    throw new Error(
      'react smoke: ' + label + ' did not render a host element; container=' + container.innerHTML
    );
  }
  if (host.getAttribute('tabindex') !== '0') {
    throw new Error(
      'react smoke: ' +
        label +
        ' host missing tabindex="0" (focus module did not attach); host=' +
        host.outerHTML
    );
  }
  if (!host.textContent || !host.textContent.includes('click')) {
    throw new Error(
      'react smoke: ' + label + ' host did not render slot text; host=' + host.outerHTML
    );
  }
  return host;
}

const shadcn = await renderHost('shadcn Button', Button);
const shadcnClass = shadcn.getAttribute('class') || '';
if (!shadcnClass.includes('group/button')) {
  throw new Error(
    'react smoke: shadcn Button host missing prototype tokens (feedback.style did not stamp); host=' +
      shadcn.outerHTML
  );
}

const base = await renderHost('base BaseButton', BaseButton);

console.log(
  'react smoke ok | shadcn=' + shadcn.outerHTML.length + 'B base=' + base.outerHTML.length + 'B'
);
