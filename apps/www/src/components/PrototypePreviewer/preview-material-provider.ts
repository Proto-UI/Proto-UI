import type { EffectsPort } from '@proto.ui/core';
import type { VisualFeedbackSink } from '@proto.ui/module-feedback';
export type PreviewMaterialFactory = (
  host: HTMLElement,
  effects: EffectsPort
) => VisualFeedbackSink | null;
const providers = new WeakMap<HTMLElement, PreviewMaterialFactory>();
export function findPreviewMaterialProvider(host: HTMLElement): PreviewMaterialFactory | null {
  for (let parent: HTMLElement | null = host; parent; parent = parent.parentElement) {
    const provider = providers.get(parent);
    if (provider) return provider;
  }
  return null;
}
export const createPreviewMaterialSink: PreviewMaterialFactory = (host, effects) =>
  findPreviewMaterialProvider(host)?.(host, effects) ?? null;
export function registerPreviewMaterialProvider(
  scope: HTMLElement,
  provider: PreviewMaterialFactory
): () => void {
  providers.set(scope, provider);
  return () => {
    if (providers.get(scope) === provider) providers.delete(scope);
  };
}
