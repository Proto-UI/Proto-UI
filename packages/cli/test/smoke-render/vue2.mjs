// Runs only inside the Vue 2 tarball consumer. It imports the CLI-generated
// per-host facade, so the assertions exercise packaged dependencies and the
// Vue 2 codegen path together rather than source-only Adapter tests.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

const { default: Vue } = await import('vue');
const { BaseImageRoot, ShadcnButton } = await import('./proto-ui/components/vue2/index.ts');

const flush = () => new Promise((resolve) => Vue.nextTick(resolve));

const button = new Vue({
  render: (h) => h(ShadcnButton, { class: 'user-added' }, ['click']),
}).$mount();
document.body.appendChild(button.$el);
await flush();

const host = button.$el;
if (host.getAttribute('tabindex') !== '0') {
  throw new Error(`vue2 smoke: Button host is not focusable: ${host.outerHTML}`);
}
if (!host.getAttribute('data-pui-style')?.includes('group/button')) {
  throw new Error(`vue2 smoke: Button host is missing prototype tokens: ${host.outerHTML}`);
}
if (!host.classList.contains('user-added') || !host.textContent?.includes('click')) {
  throw new Error(`vue2 smoke: Button lost user content or class: ${host.outerHTML}`);
}

const source =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
const image = new Vue({
  render: (h) =>
    h(BaseImageRoot, {
      attrs: {
        source,
        a11yMode: 'informative',
        alternativeText: 'Packed Vue 2 Image',
        fit: 'cover',
      },
    }),
}).$mount();
document.body.appendChild(image.$el);
await flush();

if (
  image.$el.tagName !== 'IMG' ||
  image.$el.getAttribute('src') !== source ||
  image.$el.getAttribute('alt') !== 'Packed Vue 2 Image' ||
  image.$el.style.objectFit !== 'cover'
) {
  throw new Error(
    `vue2 smoke: Base Image did not project one physical image: ${image.$el.outerHTML}`
  );
}

button.$destroy();
button.$el.remove();
image.$destroy();
image.$el.remove();

console.log('vue2 smoke ok | CLI-generated Button + Base Image');
