import { enhanceCodeExampleTree } from './code-example-tree';
import { refreshCodePanel } from './PrototypePreviewer/code-panel-client';

/** Standalone generated files reuse the same real Tree as host-specific examples. */
export function initStandaloneCodeFileBrowsers(scope: ParentNode = document): void {
  for (const root of scope.querySelectorAll<HTMLElement>('[data-standalone-file-browser]')) {
    if (root.dataset.fileBrowserInit) continue;
    const list = root.querySelector<HTMLElement>('[data-code-file-tabs]');
    if (!list) continue;
    const tabs = [...list.querySelectorAll<HTMLElement>('[data-code-file-tab]')];
    const panels = [...root.querySelectorAll<HTMLElement>('[data-code-file-panel]')];
    const directories = [...list.querySelectorAll<HTMLElement>('[data-code-directory-path]')].map((node) => node.dataset.codeDirectoryPath!);
    const select = (index: number) => {
      for (const [i, panel] of panels.entries()) panel.hidden = i !== index;
      for (const [i, tab] of tabs.entries()) tab.dataset.codeFileSelected = String(i === index);
      refreshCodePanel(panels[index]);
    };
    // Initial state is authored in SSR. Real Tree reads this state before admission.
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.codeFileSelected === 'true')));
    try {
      const projection = enhanceCodeExampleTree({ list, tabs, panels, directories, onSelect: select });
      tabs.forEach((tab) => tab.removeAttribute('aria-selected'));
      if (!list.hidden) { panels.forEach((panel) => { panel.hidden = false; }); return; }
      root.dataset.fileBrowserInit = '1';
      document.addEventListener('astro:before-swap', () => {
        projection.destroy();
        panels.forEach((panel) => { panel.hidden = false; });
        delete root.dataset.fileBrowserInit;
      }, { once: true });
    } catch (error) {
      tabs.forEach((tab) => tab.removeAttribute('aria-selected'));
      panels.forEach((panel) => { panel.hidden = false; });
      console.error('[CodeFileBrowser] Tree unavailable; retaining native file links and all source.', error);
    }
  }
}
