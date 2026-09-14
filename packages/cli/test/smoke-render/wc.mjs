// Web Component smoke. See react.mjs comment for the .mjs / runtime-path rationale.
//
// AdaptToWebComponent registers the custom element as a side effect at module
// load time, so just importing the wc facade should leave proto-ui-shadcn-button
// reachable through customElements. happy-dom provides the DOM globals that the
// adapter and the registry need.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

await import('./proto-ui/components/wc/index.ts');
const { setElementProps } = await import('@proto.ui/adapter-web-component');

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

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

const switchElement = document.createElement('proto-ui-shadcn-switch');
document.body.appendChild(switchElement);
await flush();
const switchThumb = switchElement.firstElementChild;
if (switchThumb?.localName !== 'proto-ui-shadcn-switch-thumb') {
  throw new Error('wc smoke: Switch preset did not materialize its default Thumb');
}
if (
  !switchThumb
    .getAttribute('data-pui-style')
    ?.includes('data-[checked]:translate-x-[calc(100%_-_2px)]')
) {
  throw new Error('wc smoke: Switch Thumb is missing its checked translation token');
}
switchElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
await flush();
if (!switchElement.hasAttribute('data-checked') || !switchThumb.hasAttribute('data-checked')) {
  throw new Error('wc smoke: Switch preset did not propagate checked state to its Thumb');
}

const dialogRoot = document.createElement('proto-ui-shadcn-dialog-root');
document.body.appendChild(dialogRoot);
const dialogContent = document.createElement('proto-ui-shadcn-dialog-content');
dialogRoot.appendChild(dialogContent);
await flush();
const closeIcon = dialogContent.querySelector('proto-ui-shadcn-dialog-close-icon');
if (!closeIcon || closeIcon.getAttribute('aria-label') !== 'Close') {
  throw new Error('wc smoke: Dialog Content preset did not mount its default CloseIcon');
}

const imageElement = document.createElement('proto-ui-base-image');
const source =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
setElementProps(imageElement, {
  source,
  a11yMode: 'informative',
  alternativeText: 'Packed Base Image',
  fit: 'cover',
});
document.body.appendChild(imageElement);
await flush();
const image = imageElement.querySelector('img');
if (
  imageElement.querySelectorAll('img').length !== 1 ||
  image?.getAttribute('src') !== source ||
  image.alt !== 'Packed Base Image' ||
  image.style.objectFit !== 'cover'
) {
  throw new Error(
    'wc smoke: Base Image did not project its physical image: ' + imageElement.outerHTML
  );
}
imageElement.remove();

console.log(
  'wc smoke ok | Button + Switch preset + Dialog CloseIcon preset + Base Image, instance tagName=' +
    el.tagName
);
