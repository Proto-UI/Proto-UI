export type ImageViewFit = 'contain' | 'cover' | 'fill';
export type ImageViewA11yMode = 'informative' | 'decorative';
export type ImageViewStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type ImageViewStatusChange = Readonly<{ status: ImageViewStatus; previousStatus: ImageViewStatus; source: string }>;
export type ImageViewPatch = Readonly<{
  source?: string;
  alternativeText?: string;
  a11yMode?: ImageViewA11yMode;
  fit?: ImageViewFit;
  loadingStatus?: ImageViewStatus;
}>;
export type ImageViewSnapshot = Readonly<{ source: string; loadingStatus: ImageViewStatus; fit: ImageViewFit }>;
export type ImageViewHandle<P = unknown> = {
  on(type: 'loadingStatusChange', callback: (event: ImageViewStatusChange) => void): () => void;
  sync(patch: ImageViewPatch): void;
  snapshot(): ImageViewSnapshot | null;
};
