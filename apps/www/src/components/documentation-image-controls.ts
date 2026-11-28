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
import baseButton from '@proto.ui/prototypes-base/button';
import { dialogContent, dialogMask } from '@proto.ui/prototypes-base/dialog';
import shadcnSurface from '@proto.ui/prototypes-shadcn/surface';
import brutalistSurface from '@proto.ui/prototypes-brutalist/surface';
import shadcnText from '@proto.ui/prototypes-shadcn/text';
import brutalistText from '@proto.ui/prototypes-brutalist/text';
import './documentation-image-zoom.css';
export const IMAGE_ZOOM_DURATION = 420;

export type PreviewFamily = 'shadcn' | 'brutalist';
export type PreviewControl = HTMLElement & {
  setProps?: (props: Record<string, unknown>) => void;
  getExposes?: () => Record<string, any>;
};
const propsByHost = new WeakMap<HTMLElement, Record<string, unknown>>();
const parts = {
  shadcn: {
    button: shadcnButton,
    surface: shadcnSurface,
    text: shadcnText,
    imageTrigger: baseButton,
    ...shadcnDialog,
    dialogContent,
    dialogMask,
  },
  brutalist: {
    button: brutalistButton,
    surface: brutalistSurface,
    text: brutalistText,
    imageTrigger: baseButton,
    ...brutalistDialog,
    dialogContent,
    dialogMask,
  },
};
const roles = [
  'button',
  'surface',
  'text',
  'imageTrigger',
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
          AdaptToWebComponent(parts[family][part] as any, {
            register: false,
            registerAs: tag,
          })
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
  host.dataset.docsPreviewPrototype = parts[family][part].name;
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

/** Bind passive facts from the existing semantic owner. This adds no event
 * detector, Transition clock or native interaction truth. */
export function bindPreviewSurface(
  owner: PreviewControl,
  surface: PreviewControl,
  key: 'focusVisible' | 'transitionState',
  signal: AbortSignal
): void {
  const bind = () => {
    if (signal.aborted || !owner.isConnected || !surface.isConnected) return;
    const fact = owner.getExposes?.()[key];
    if (!fact?.get || !fact?.subscribe) throw new Error(`Missing public ${key} expose`);
    const sync = (value: unknown) => {
      if (!signal.aborted && owner.isConnected && surface.isConnected)
        setPreviewProps(surface, { [key]: value });
    };
    const off = fact.subscribe((event: { type: string; next?: unknown }) => {
      if (event.type === 'next') sync(event.next);
    });
    signal.addEventListener('abort', off, { once: true });
    sync(fact.get());
  };
  // Caller builds disconnected composition first; WC exposes exist after append.
  queueMicrotask(bind);
}
/** Web Surface duration input mirrors its sole Transition owner's validated
 * millisecond value. It never schedules work or accepts arbitrary CSS. */
export function setPreviewSurfaceDuration(surface: HTMLElement, duration: number): void {
  if (!Number.isFinite(duration) || duration < 0) throw new Error('Invalid Surface duration');
  surface.style.setProperty('--pui-surface-transition-duration', `${duration}ms`);
}
