/** Bounded documentation-media integration boundary. Application glue consumes
 * these facade hosts/public methods, never raw keyboard, focus or overlay logic.
 * Keep this bridge distinct from the independently maintained site chrome.
 */
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import shadcnButton from '@proto.ui/prototypes-shadcn/button';
import * as shadcnDialog from '@proto.ui/prototypes-shadcn/dialog';
import brutalistButton from '@proto.ui/prototypes-brutalist/button';
import * as brutalistDialog from '@proto.ui/prototypes-brutalist/dialog';
import { BRUTALIST_THEME } from '@proto.ui/prototypes-brutalist/theme';
import { imageZoomContent, imageZoomMask } from './documentation-image-zoom.proto';

export type PreviewFamily = 'shadcn' | 'brutalist';
export type PreviewControl = HTMLElement & {
  setProps?: (props: Record<string, unknown>) => void;
  getExposes?: () => Record<string, any>;
};
const propsByHost = new WeakMap<HTMLElement, Record<string, unknown>>();
const parts = {
  shadcn: {
    button: shadcnButton,
    ...shadcnDialog,
    dialogContent: imageZoomContent,
    dialogMask: imageZoomMask,
  },
  brutalist: {
    button: brutalistButton,
    ...brutalistDialog,
    dialogContent: imageZoomContent,
    dialogMask: imageZoomMask,
  },
};
const roles = [
  'button',
  'dialogRoot',
  'dialogMask',
  'dialogContent',
  'dialogTitle',
  'dialogDescription',
  'dialogClose',
] as const;
export type PreviewPart = (typeof roles)[number];

export function registerPreviewControls(): void {
  for (const family of ['shadcn', 'brutalist'] as const)
    for (const part of roles) {
      const tag = previewTag(family, part);
      if (!customElements.get(tag))
        customElements.define(
          tag,
          AdaptToWebComponent(parts[family][part] as any, { register: false, registerAs: tag })
        );
    }
}
export function previewTag(family: PreviewFamily, part: PreviewPart): string {
  return `docs-preview-${family}-${part.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}
export function previewFamily(doc: Document): PreviewFamily {
  return doc.documentElement.dataset.siteLibraryFamily === 'brutalist' ||
    (!doc.documentElement.dataset.siteLibraryFamily &&
      /\/ui-libraries\/brutalist(?:\/|$)/.test(doc.location.pathname))
    ? 'brutalist'
    : 'shadcn';
}
export function setPreviewProps(host: PreviewControl, props: Record<string, unknown>): void {
  const merged = { ...propsByHost.get(host), ...props };
  propsByHost.set(host, merged);
  setElementProps(host, merged);
  queueMicrotask(() => {
    if (host.isConnected) host.setProps?.(propsByHost.get(host)!);
  });
}
export function makePreviewControl(
  family: PreviewFamily,
  part: PreviewPart,
  props: Record<string, unknown> = {}
): PreviewControl {
  const host = document.createElement(previewTag(family, part)) as PreviewControl;
  host.dataset.docsPreviewFamily = family;
  setPreviewProps(host, props);
  return host;
}
export function themePreviewControl(host: HTMLElement, family: PreviewFamily, dark: boolean): void {
  if (family !== 'brutalist') return;
  const theme = BRUTALIST_THEME[dark ? 'dark' : 'light'];
  for (const [key, value] of Object.entries(theme)) {
    host.style.setProperty(`--pui-${key}`, String(value));
    host.style.setProperty(`--color-${key}`, String(value));
  }
}
