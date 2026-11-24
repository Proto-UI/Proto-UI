import { enhanceCodeExampleTree } from './code-example-tree';
import { refreshCodePanel } from './PrototypePreviewer/code-panel-client';
import { enhanceCodeScrollArea } from './PrototypePreviewer/code-scroll-area-client';

const nativeRevealOwners = new WeakSet<HTMLElement>();

function installNativeFileReveal(files: HTMLElement): void {
  if (nativeRevealOwners.has(files)) return;
  nativeRevealOwners.add(files);
  files.addEventListener('focusin', (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    const link = event.target.closest<HTMLElement>('[data-code-file-tab]');
    const viewport = link?.closest<HTMLElement>('[data-code-tree-scroll]');
    if (!link || !viewport || !files.contains(viewport)) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const target = link.getBoundingClientRect();
    if (!width || !height || !target.width || !target.height) return;
    const bounds = viewport.getBoundingClientRect();
    const left = bounds.left + viewport.clientLeft;
    const top = bounds.top + viewport.clientTop;
    // Native host navigation uses preventScroll. Reveal within its actual
    // viewport without moving the document or depending on wrapper depth.
    if (target.left < left || target.width > width) viewport.scrollLeft += target.left - left;
    else if (target.right > left + width) viewport.scrollLeft += target.right - left - width;
    if (target.top < top || target.height > height) viewport.scrollTop += target.top - top;
    else if (target.bottom > top + height) viewport.scrollTop += target.bottom - top - height;
  });
}

/** Both host examples and standalone files share the public ScrollArea anatomy. */
export function initCodeFileBrowsers(scope: ParentNode = document): void {
  initStandaloneCodeFileBrowsers(scope);
  for (const files of scope.querySelectorAll<HTMLElement>(
    '[data-code-file-browser] [data-code-files]'
  )) {
    installNativeFileReveal(files);
    void enhanceCodeScrollArea(files).catch((error) => {
      console.error(
        '[CodeFileBrowser] ScrollArea unavailable; retaining native file scrolling.',
        error
      );
    });
  }
}

/** Standalone generated files reuse the same real Tree as host-specific examples. */
export function initStandaloneCodeFileBrowsers(scope: ParentNode = document): void {
  for (const root of scope.querySelectorAll<HTMLElement>('[data-standalone-file-browser]')) {
    if (root.dataset.fileBrowserInit) continue;
    const list = root.querySelector<HTMLElement>('[data-code-file-tabs]');
    if (!list) continue;
    const tabs = [...list.querySelectorAll<HTMLElement>('[data-code-file-tab]')];
    const panels = [...root.querySelectorAll<HTMLElement>('[data-code-file-panel]')];
    const directories = [...list.querySelectorAll<HTMLElement>('[data-code-directory-path]')].map(
      (node) => node.dataset.codeDirectoryPath!
    );
    const select = (index: number, selectedPanel: HTMLElement) => {
      for (const panel of panels) panel.hidden = panel !== selectedPanel;
      for (const [i, tab] of tabs.entries()) tab.dataset.codeFileSelected = String(i === index);
      refreshCodePanel(selectedPanel);
    };
    // Initial state is authored in SSR. Real Tree reads this state before admission.
    tabs.forEach((tab) =>
      tab.setAttribute('aria-selected', String(tab.dataset.codeFileSelected === 'true'))
    );
    try {
      const projection = enhanceCodeExampleTree({
        list,
        tabs,
        panels,
        directories,
        onSelect: select,
      });
      tabs.forEach((tab) => tab.removeAttribute('aria-selected'));
      if (!list.hidden) {
        panels.forEach((panel) => {
          panel.hidden = false;
        });
        root.dataset.fileBrowserFallback = '';
        continue;
      }
      // A previous focused/failed admission may have revealed every source.
      // Restore the authored selection before returning to the bounded layout.
      const selectedTab = tabs.find((tab) => tab.dataset.codeFileSelected === 'true') ?? tabs[0];
      const selectedPanel = panels.find(
        (panel) => panel.id === selectedTab.getAttribute('aria-controls')
      );
      if (selectedPanel) select(tabs.indexOf(selectedTab), selectedPanel);
      root.dataset.fileBrowserInit = '1';
      delete root.dataset.fileBrowserFallback;
      document.addEventListener(
        'astro:before-swap',
        () => {
          projection.destroy();
          panels.forEach((panel) => {
            panel.hidden = false;
          });
          root.dataset.fileBrowserFallback = '';
          delete root.dataset.fileBrowserInit;
        },
        { once: true }
      );
    } catch (error) {
      tabs.forEach((tab) => tab.removeAttribute('aria-selected'));
      panels.forEach((panel) => {
        panel.hidden = false;
      });
      root.dataset.fileBrowserFallback = '';
      console.error(
        '[CodeFileBrowser] Tree unavailable; retaining native file links and all source.',
        error
      );
    }
  }
}
