import { collectPrototypeIds, type DemoNode, type DemoSpec } from '../PrototypePreviewer/demo-types';
import { resolveProjectionSelectParts } from '../PrototypePreviewer/projection-families';
import type { RuntimeId } from '../PrototypePreviewer/runtimes/ids';
import type { SiteLibraryFamily } from '../site-library-family';
import { bindSiteSelectDismissal } from '../site-select-dismissal';
import { navigateSiteLocale } from '../site-locale-navigation';
import { headerSelectControlProps } from '../site-header-control-recipes';

export type HomepageLocale = Readonly<{
  value: string;
  label: string;
  options: readonly Readonly<{ value: string; label: string; path: string }>[];
}>;

/** Malformed consumer metadata must retain its existing recovery control, not
 * abort the independent Header actions or poison a page-wide transaction. */
export function parseHomepageLocale(raw: string): HomepageLocale | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return;
    const candidate = value as Partial<HomepageLocale>;
    if (
      typeof candidate.value !== 'string' ||
      typeof candidate.label !== 'string' ||
      !Array.isArray(candidate.options) ||
      !candidate.options.length ||
      !candidate.options.every(
        (option) =>
          option &&
          typeof option === 'object' &&
          typeof option.value === 'string' &&
          typeof option.label === 'string' &&
          typeof option.path === 'string' &&
          option.path.startsWith('/') &&
          !option.path.startsWith('//')
      ) ||
      !candidate.options.some((option) => option.value === candidate.value)
    )
      return;
    return candidate as HomepageLocale;
  } catch {
    return;
  }
}

/** One real Select anatomy, materialized with the homepage's atomic family and
 * Runtime transaction. No WC-only island and no duplicate interaction owner. */
export function createHomepageLocaleSelect(
  locale: HomepageLocale,
  family: SiteLibraryFamily,
  runtime: RuntimeId,
  isActive: () => boolean
): { demo: DemoSpec; prototypeIds: string[] } {
  const parts = resolveProjectionSelectParts(family);
  const control = headerSelectControlProps();
  const proto = (
    prototypeId: string,
    children: (DemoNode | string)[] = [],
    props = {},
    ref?: string
  ): DemoNode => ({ kind: 'proto', prototypeId, children, props, ...(ref ? { ref } : {}) });
  const items = locale.options.map((option) =>
    proto(parts.item, parts.itemText ? [proto(parts.itemText, [option.label])] : [option.label], {
      value: option.value,
      textValue: option.label,
    })
  );
  const content = proto(
    parts.content,
    parts.surface && parts.viewport
      ? [proto(parts.surface, [proto(parts.viewport, items)])]
      : items,
    parts.surface ? {} : { position: 'popper', align: 'end' }
  );
  const value = proto(parts.value, [], { placeholder: locale.label });
  if (value.kind === 'proto')
    value.surfaceStyle = {
      minWidth: '0',
      flex: '1 1 auto',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
    };
  const trigger = proto(
    parts.trigger,
    [value],
    {
      accessibleLabel: locale.label,
      appearance:
        family === 'shadcn' ? control.triggerAppearance : control.brutalistTriggerAppearance,
    },
    'home-locale-trigger'
  );
  if (trigger.kind === 'proto')
    trigger.surfaceStyle = {
      width: '100%',
      minWidth: '0',
      maxWidth: '100%',
      height: 'auto',
      minHeight: control.minHeight,
      paddingBlock: control.paddingBlock,
    };
  const root = proto(
    parts.root,
    [trigger, content],
    {
      value: locale.value,
      closeOnSelect: true,
      ...(family === 'shadcn' ? { styleProfile: control.shadcnStyleProfile } : {}),
    },
    'home-locale-root'
  );
  const paths = Object.fromEntries(locale.options.map(({ value, path }) => [value, path]));
  const demoRoot: DemoNode = {
    kind: 'box',
    ref: 'home-locale-owner',
    attrs: { 'data-projection-control': 'locale' },
    children: [root],
  };
  const prototypeIds = new Set<string>();
  collectPrototypeIds(demoRoot, prototypeIds);
  return {
    prototypeIds: [...prototypeIds],
    demo: {
      type: 'demo',
      root: demoRoot,
      setup(context) {
        const owner = context.refs['home-locale-owner'];
        const element = context.refs['home-locale-root'];
        const trigger = context.refs['home-locale-trigger'];
        if (!owner || !element || !trigger)
          throw new Error('[HomepageLocale] Missing Select anatomy.');
        element.setAttribute('data-language-select-root', '');
        element.dataset.currentLocale = locale.value;
        element.dataset.languageSelectInitialized = 'true';
        let alive = true;
        const close = (reason: string) =>
          context.api.call('home-locale-root', 'requestOpen', {
            open: false,
            reason,
            focusReason: 'programmatic',
          });
        const unbind = bindSiteSelectDismissal(owner, close);
        const change = (detail: unknown) => {
          if (!alive || !isActive() || !detail || typeof detail !== 'object') return;
          const value = (detail as { value?: unknown }).value;
          if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(paths, value))
            return;
          close('locale.valueChange');
          const window = owner.ownerDocument.defaultView;
          if (window) navigateSiteLocale(window, locale.value, paths, value);
        };
        const listener = (event: Event) => {
          if (event instanceof (owner.ownerDocument.defaultView?.CustomEvent ?? CustomEvent))
            change((event as CustomEvent).detail);
        };
        if (runtime === 'wc') element.addEventListener('valueChange', listener);
        else context.api.setProps('home-locale-root', { onValueChange: change });
        return () => {
          alive = false;
          unbind();
          element.removeEventListener('valueChange', listener);
          if (runtime !== 'wc')
            context.api.setProps('home-locale-root', { onValueChange: undefined });
        };
      },
    },
  };
}
