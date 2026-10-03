import { createHomepageGalleryParts } from './homepage-gallery-parts';
import type { DemoNode, DemoSetupContext, DemoSpec } from '../PrototypePreviewer/demo-types';
import type { ProjectionContentRecipe } from '../PrototypePreviewer/projection-composition';
import {
  resolveProjectionPart,
  type ProjectionFamilyId,
} from '../PrototypePreviewer/projection-families';
import type { RuntimeId } from '../PrototypePreviewer/runtimes/registry';

export const HOMEPAGE_SHOWCASE_ID = 'website-component-gallery';

type Settings = { view: 'list' | 'board' | 'calendar'; summary: boolean; note: string };
const defaults = (): Settings => ({ view: 'list', summary: false, note: '' });
const equal = (left: Settings, right: Settings) =>
  left.view === right.view && left.summary === right.summary && left.note === right.note;

const COPY = {
  en: {
    title: 'Notification preferences',
    view: 'Delivery channel',
    views: { list: 'Email', board: 'Push', calendar: 'In-app' },
    summary: 'Weekly digest',
    note: 'Additional note',
    placeholder: 'Add a note for this example',
    save: 'Save to this page',
    reset: 'Restore defaults',
    unchanged: 'No unsaved changes',
    changed: 'Unsaved changes',
    saved: 'Saved to this page',
    restored: 'Defaults restored',
    summaryOn: 'Weekly summary on',
    summaryOff: 'Weekly summary off',
    characters: (count: number) => `${count} / 240 characters`,
    noteLength: (count: number) => `Note: ${count} characters`,
  },
  'zh-cn': {
    title: '通知偏好',
    view: '通知方式',
    views: { list: '邮件', board: '推送', calendar: '站内信' },
    summary: '每周摘要',
    note: '附加说明',
    placeholder: '为这个示例补充备注',
    save: '保存到本页',
    reset: '恢复默认值',
    unchanged: '没有未保存的更改',
    changed: '有未保存的更改',
    saved: '已保存到本页',
    restored: '已恢复默认值',
    summaryOn: '显示每周摘要',
    summaryOff: '隐藏每周摘要',
    characters: (count: number) => `${count} / 240 字`,
    noteLength: (count: number) => `备注 ${count} 字`,
  },
};

/** Website-owned task composition. All interactive behavior stays in existing public Prototypes. */
export function createHomepageShowcase(
  family: ProjectionFamilyId,
  runtime: RuntimeId,
  locale: string,
  isActive: () => boolean,
  isCurrentGeneration: () => boolean = isActive
): { demo: DemoSpec; recipe: ProjectionContentRecipe } {
  const copy = COPY[locale === 'en' ? 'en' : 'zh-cn'];
  const parts = {
    select: resolveProjectionPart(family, 'select', 'root').prototypeId,
    trigger: resolveProjectionPart(family, 'select', 'trigger').prototypeId,
    value: resolveProjectionPart(family, 'select', 'value').prototypeId,
    content: resolveProjectionPart(family, 'select', 'content').prototypeId,
    item: resolveProjectionPart(family, 'select', 'item').prototypeId,
    switch: resolveProjectionPart(family, 'switch', 'root').prototypeId,
    thumb: resolveProjectionPart(family, 'switch', 'thumb').prototypeId,
    textarea: resolveProjectionPart(family, 'textarea', 'root').prototypeId,
    button: resolveProjectionPart(family, 'button', 'root').prototypeId,
  };
  const label = (text: string): DemoNode => ({
    kind: 'box',
    className: 'home-settings__label',
    children: [text],
  });
  const initial = defaults();
  const gallery = createHomepageGalleryParts(
    family,
    runtime,
    locale,
    isActive,
    isCurrentGeneration
  );
  const result: { demo: DemoSpec; recipe: ProjectionContentRecipe } = {
    recipe: {
      id: HOMEPAGE_SHOWCASE_ID,
      prototypeIds: [...new Set([...Object.values(parts), ...gallery.ids])],
      rootPrototypeId: parts.select,
    },
    demo: {
      type: 'demo',
      root: {
        kind: 'box',
        ref: 'settings',
        className: 'home-settings',
        attrs: { 'data-home-settings': '', role: 'group', 'aria-label': copy.title },
        children: [
          {
            kind: 'box',
            className: 'home-settings__title',
            attrs: { role: 'heading', 'aria-level': '2' },
            children: [copy.title],
          },
          {
            kind: 'box',
            className: 'home-settings__fields',
            children: [
              {
                kind: 'box',
                className: 'home-settings__preferences',
                children: [
                  {
                    kind: 'box',
                    className: 'home-settings__field',
                    children: [
                      label(copy.view),
                      {
                        kind: 'proto',
                        prototypeId: parts.select,
                        ref: 'settings-view',
                        props: { value: initial.view, closeOnSelect: true },
                        surfaceStyle: { width: '100%' },
                        children: [
                          {
                            kind: 'proto',
                            prototypeId: parts.trigger,
                            ref: 'settings-view-trigger',
                            surfaceStyle: { width: '100%' },
                            children: [
                              {
                                kind: 'proto',
                                prototypeId: parts.value,
                                props: { placeholder: copy.view },
                              },
                            ],
                          },
                          {
                            kind: 'proto',
                            prototypeId: parts.content,
                            props: { position: 'popper', align: 'start' },
                            children: Object.entries(copy.views).map(([value, text]) => ({
                              kind: 'proto',
                              prototypeId: parts.item,
                              props: { value, textValue: text },
                              children: [text],
                            })),
                          },
                        ],
                      },
                    ],
                  },
                  {
                    kind: 'box',
                    className: 'home-settings__switch-row',
                    children: [
                      label(copy.summary),
                      {
                        kind: 'proto',
                        prototypeId: parts.switch,
                        ref: 'settings-summary',
                        props: { checked: initial.summary },
                        children: [
                          { kind: 'proto', prototypeId: parts.thumb },
                          { kind: 'box', className: 'sr-only', children: [copy.summary] },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                kind: 'box',
                className: 'home-settings__field',
                children: [
                  label(copy.note),
                  {
                    kind: 'proto',
                    prototypeId: parts.textarea,
                    ref: 'settings-note',
                    props: {
                      value: initial.note,
                      ariaLabel: copy.note,
                      placeholder: copy.placeholder,
                      rows: 3,
                      maxLength: 240,
                    },
                    surfaceStyle: { width: '100%', minWidth: '0' },
                  },
                  {
                    kind: 'box',
                    ref: 'settings-count',
                    className: 'home-settings__muted',
                    children: [copy.characters(0)],
                  },
                ],
              },
            ],
          },
          {
            kind: 'box',
            className: 'home-settings__footer',
            children: [
              {
                kind: 'box',
                className: 'home-settings__actions',
                children: [
                  {
                    kind: 'proto',
                    prototypeId: parts.button,
                    ref: 'settings-save',
                    props: { disabled: true },
                    children: [copy.save],
                  },
                  {
                    kind: 'proto',
                    prototypeId: parts.button,
                    ref: 'settings-reset',
                    props: { disabled: true, variant: family === 'shadcn' ? 'outline' : 'surface' },
                    children: [copy.reset],
                  },
                ],
              },
              {
                kind: 'box',
                ref: 'settings-feedback',
                className: 'home-settings__feedback',
                attrs: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
                children: [copy.unchanged],
              },
            ],
          },
        ],
      },
      setup(context: DemoSetupContext) {
        let draft = defaults();
        let saved = defaults();
        let alive = true;
        let composing = false;
        const cleanups: Array<() => void> = [];
        const refs = context.refs;
        const canAct = () => alive && isActive();
        const pendingProps = new Map<string, Record<string, unknown>>();
        // setProps replaces the WC bag; keep authored configuration and bound
        // framework callbacks alongside each controlled value update.
        const currentProps = new Map<string, Record<string, unknown>>();
        const collectProps = (node: DemoNode) => {
          if (node.kind === 'proto' && node.ref) currentProps.set(node.ref, { ...node.props });
          for (const child of ('children' in node ? node.children : []) ?? [])
            if (typeof child === 'object' && child !== null) collectProps(child);
        };
        collectProps(result.demo.root);
        const completeProps = (ref: string, next: Record<string, unknown>) => {
          const complete = { ...currentProps.get(ref), ...next };
          currentProps.set(ref, complete);
          return complete;
        };
        let propsScheduled = false;
        // A protocol event may continue doing owner work after its outward signal.
        // WC and this demo renderer's React flushSync path update synchronously;
        // re-entering either can invalidate that callback's phase.
        // Vue's existing nextTick staging must remain ahead of TextControl's owner
        // restoration microtask, or accepted text can lose its caret position.
        const publishProps = (ref: string, next: Record<string, unknown>) => {
          next = completeProps(ref, next);
          if (runtime === 'vue' || runtime === 'vue2') {
            context.api.setProps(ref, next);
            return;
          }
          pendingProps.set(ref, { ...pendingProps.get(ref), ...next });
          if (propsScheduled) return;
          propsScheduled = true;
          queueMicrotask(() => {
            propsScheduled = false;
            const writes = [...pendingProps];
            pendingProps.clear();
            for (const [ref, props] of writes) {
              // A preparing old generation still owns already-accepted input.
              // Only replacement/disposal revokes queued owner feedback.
              if (!alive || !isCurrentGeneration()) return;
              context.api.setProps(ref, props);
            }
          });
        };
        const refresh = (message?: string) => {
          const dirty = !equal(draft, saved);
          refs.settings!.dataset.dirty = String(dirty);
          refs['settings-count']!.textContent = copy.characters(draft.note.length);
          refs['settings-feedback']!.textContent =
            message ?? (dirty ? copy.changed : copy.unchanged);
          publishProps('settings-save', { disabled: !dirty || composing });
          publishProps('settings-reset', {
            disabled: equal(draft, defaults()) || composing,
          });
        };
        const replay = () => {
          publishProps('settings-view', { value: draft.view });
          publishProps('settings-summary', { checked: draft.summary });
          publishProps('settings-note', { value: draft.note });
        };
        const bind = (
          ref: string,
          event: string,
          callback: (detail: Record<string, unknown>) => void
        ) => {
          const deliver = (detail: unknown) => {
            if (!canAct()) return;
            callback(
              detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : {}
            );
          };
          if (runtime === 'wc') {
            const element = refs[ref]!;
            const CustomEventType = element.ownerDocument.defaultView!.CustomEvent;
            const listener = (event: Event) => {
              if (event instanceof CustomEventType) deliver(event.detail);
            };
            element.addEventListener(event, listener);
            cleanups.push(() => element.removeEventListener(event, listener));
          } else {
            const prop = `on${event[0]!.toUpperCase()}${event.slice(1)}`;
            context.api.setProps(ref, completeProps(ref, { [prop]: deliver }));
            // The view owns this callback; alive=false revokes it without a
            // cleanup write that could replay an uncommitted queued value.
          }
        };
        // Select owns its content-derived name. This consumer adds the field context
        // on the actual trigger, matching the existing website Select label policy.
        const trigger = refs['settings-view-trigger']!;
        const restoreLabel = () => {
          if (trigger.getAttribute('aria-label') !== copy.view)
            trigger.setAttribute('aria-label', copy.view);
        };
        restoreLabel();
        const observer = new MutationObserver(restoreLabel);
        observer.observe(trigger, { attributes: true, attributeFilter: ['aria-label'] });
        cleanups.push(() => observer.disconnect());
        bind('settings-view', 'valueChange', ({ value }) => {
          if (value !== 'list' && value !== 'board' && value !== 'calendar') return;
          draft.view = value;
          publishProps('settings-view', { value });
          refresh();
        });
        bind('settings-summary', 'checkedChange', ({ checked }) => {
          if (typeof checked !== 'boolean') return;
          draft.summary = checked;
          publishProps('settings-summary', { checked });
          refresh();
        });
        bind('settings-note', 'valueChange', ({ value, composing: nextComposing }) => {
          if (typeof value !== 'string') return;
          draft.note = value;
          composing = nextComposing === true;
          publishProps('settings-note', { value });
          refresh();
        });
        bind('settings-note', 'compositionStart', () => {
          composing = true;
          refresh();
        });
        bind('settings-note', 'compositionEnd', ({ value }) => {
          composing = false;
          if (typeof value === 'string') {
            draft.note = value;
            publishProps('settings-note', { value });
          }
          refresh();
        });
        bind('settings-save', 'click', () => {
          if (composing || equal(draft, saved)) return;
          saved = { ...draft };
          refresh(
            `${copy.saved} · ${copy.views[saved.view]} · ${saved.summary ? copy.summaryOn : copy.summaryOff} · ${copy.noteLength(saved.note.length)}`
          );
        });
        bind('settings-reset', 'click', () => {
          if (composing || equal(draft, defaults())) return;
          draft = defaults();
          replay();
          refresh(`${copy.restored} · ${equal(draft, saved) ? copy.unchanged : copy.changed}`);
        });
        const stopGallery = gallery.setup(context);
        refresh();
        return () => {
          if (!alive) return;
          alive = false;
          pendingProps.clear();
          stopGallery();
          context.api.call('settings-view', 'close', 'workspace settings disposed');
          for (const cleanup of cleanups) cleanup();
        };
      },
    },
  };
  if (result.demo.root.kind !== 'box') throw new Error('Workspace root must remain an app box');
  const [, fields, footer] = result.demo.root.children!;
  const form: DemoNode = gallery.card(
    copy.title,
    'Select · Switch · Textarea · Button',
    [
      {
        kind: 'box',
        ref: 'settings',
        className: 'home-settings',
        attrs: { 'data-home-settings': '', role: 'group', 'aria-label': copy.title },
        children: [fields!, footer!],
      },
    ],
    'preferences'
  );
  result.demo.root = {
    kind: 'box',
    className: 'home-gallery',
    attrs: {
      'data-home-gallery': '',
      role: 'region',
      'aria-label': locale === 'en' ? 'Interactive component gallery' : '可交互的组件展示',
    },
    children: gallery.columns(form),
  };
  return result;
}
