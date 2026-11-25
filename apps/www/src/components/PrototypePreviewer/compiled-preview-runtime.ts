import type { BrowserPreviewArtifact } from '../../../../../packages/compiler/src/browser/protocol';
import type { BrowserTargetAssets, CompiledPreviewItem } from './compiled-preview-sandbox';

interface PreviewInput {
  preview: BrowserPreviewArtifact;
  target: BrowserTargetAssets;
  revision: string;
  token: string;
  items: readonly CompiledPreviewItem[];
}

const input = JSON.parse(document.getElementById('preview-input')!.textContent!) as PreviewInput;
const urls: string[] = [];
const cleanupFailures: unknown[] = [];
const secondaryFailures: unknown[] = [];
let retire: () => void | Promise<void> = () => {};
let closed = false;
let failed = false;
let retiring = false;
const describe = (value: unknown) => (value instanceof Error ? value.message : String(value));
const send = (type: string, detail: Record<string, unknown> = {}) =>
  parent.postMessage({ type, revision: input.revision, token: input.token, ...detail }, '*');
const fail = (value: unknown) => {
  if (retiring) cleanupFailures.push(value);
  else if (!closed) {
    if (failed) secondaryFailures.push(value);
    else {
      failed = true;
      send('preview-error', { message: describe(value).slice(0, 2000) });
    }
  }
};
addEventListener('error', (event) => fail(event.error ?? event.message));
addEventListener('unhandledrejection', (event) => fail(event.reason));
addEventListener(
  'click',
  (event) => {
    if (
      event
        .composedPath()
        .some(
          (node) => node instanceof Element && node.tagName === 'A' && node.hasAttribute('href')
        )
    )
      event.preventDefault();
  },
  true
);
addEventListener('submit', (event) => event.preventDefault(), true);
addEventListener('message', (event: MessageEvent) => {
  const message = event.data;
  if (
    event.source !== parent ||
    message?.type !== 'dispose' ||
    message.token !== input.token ||
    message.revision !== input.revision ||
    closed
  )
    return;
  closed = true;
  retiring = true;
  void Promise.resolve()
    .then(retire)
    .catch((failure) => cleanupFailures.push(failure))
    .finally(() => {
      try {
        document.getElementById('stage')!.replaceChildren();
      } catch (failure) {
        cleanupFailures.push(failure);
      }
      for (const url of urls) {
        try {
          URL.revokeObjectURL(url);
        } catch (failure) {
          cleanupFailures.push(failure);
        }
      }
      const failures = [
        ...secondaryFailures.map((value) => 'Secondary preview error: ' + describe(value)),
        ...cleanupFailures.map((value) => 'Cleanup error: ' + describe(value)),
      ];
      if (failures.length) send('cleanup-error', { message: failures.join(' | ').slice(0, 2000) });
      retiring = false;
      send('disposed');
    });
});
send('preview-listener-ready');

async function mount() {
  if (
    input.target.target !== 'react' ||
    input.preview.execution !== 'native-react' ||
    input.preview.entry !== 'pui:compiled/component' ||
    input.preview.styles.length !== 0 ||
    Object.keys(input.preview.modules).length !== 1 ||
    typeof input.preview.modules['pui:compiled/component'] !== 'string' ||
    JSON.stringify(Object.keys(input.target.modules).sort()) !==
      JSON.stringify(['pui:target/react-runtime', 'react', 'react-dom', 'react-dom/client']) ||
    Object.values(input.target.modules).some((source) => typeof source !== 'string')
  )
    throw new Error('This preview accepts a native React artifact.');
  const modules = { ...input.target.modules, ...input.preview.modules };
  const imports: Record<string, string> = {};
  for (const [name, source] of Object.entries(modules)) {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    urls.push(url);
    imports[name] = url;
  }
  const map = document.createElement('script');
  map.type = 'importmap';
  map.nonce = input.token;
  map.textContent = JSON.stringify({ imports });
  document.head.append(map);
  const [React, { createRoot }, { flushSync }, generated] = await Promise.all([
    import('react'),
    import('react-dom/client'),
    import('react-dom'),
    import('pui:compiled/component'),
  ]);
  if (closed) return;
  const component = generated.default;
  if (typeof component !== 'function')
    throw new Error('The generated artifact has no React component export.');
  const root = createRoot(document.getElementById('stage')!, { onUncaughtError: fail });
  retire = () => root.unmount();
  flushSync(() =>
    root.render(
      React.createElement(
        React.Fragment,
        null,
        ...input.items.map((item, index) =>
          React.createElement(
            'div',
            { key: index, 'data-preview-item': '' },
            React.createElement(component, { ...item.props }, item.text ?? '')
          )
        )
      )
    )
  );
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  if (!closed && !failed) send('preview-ready', { target: input.target.target });
}
void mount().catch(fail);
