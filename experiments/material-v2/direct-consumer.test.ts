import { afterEach, describe, expect, it } from 'vitest';
import { registerPreviewMaterialProvider } from '../../apps/www/src/components/PrototypePreviewer/preview-material-provider';
import {
  mountMaterialConsumer,
  type MaterialRuntime,
  type MaterialView,
} from '../../apps/www/test/material-v2-direct-consumer';
const views: MaterialView[] = [];
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(async () => {
  for (const view of views.splice(0)) view.destroy();
  document.body.replaceChildren();
  await flush();
});
describe('actual material artifact four-Adapter consumers', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as MaterialRuntime[]) {
    it(`${runtime}: consumes both real Button variants, one activation and teardown`, async () => {
      const host = document.createElement('section');
      document.body.append(host);
      let count = 0;
      const sinks: { commits: number; releases: number }[] = [];
      const unregister = registerPreviewMaterialProvider(host, () => {
        const record = { commits: 0, releases: 0 };
        sinks.push(record);
        return {
          commit() {
            record.commits++;
          },
          release() {
            record.releases++;
          },
        };
      });
      views.push(await mountMaterialConsumer(runtime, host, () => count++));
      await flush();
      const regular = host.querySelector<HTMLElement>('[data-demo-ref="regular"]')!;
      expect(regular).toBeTruthy();
      expect(regular.getAttribute('role')).toBe('button');
      expect(host.textContent).toContain('Optical action');
      expect(host.textContent).toContain('Opaque action');
      expect(host.querySelectorAll('[role="button"]')).toHaveLength(2);
      regular.click();
      await flush();
      expect(count).toBe(1);
      expect(sinks).toHaveLength(2);
      expect(sinks.every((sink) => sink.commits > 0)).toBe(true);
      views.pop()!.destroy();
      await flush();
      expect(host.querySelector('[data-demo-ref="regular"]')).toBeNull();
      expect(sinks.every((sink) => sink.releases > 0)).toBe(true);
      unregister();
      regular.click();
      await flush();
      expect(count).toBe(1);
    });
  }
});
