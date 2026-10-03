import type { DemoNode, DemoSetupContext } from '../PrototypePreviewer/demo-types';
import type { ProjectionFamilyId } from '../PrototypePreviewer/projection-families';

export const PREVIEW_SURFACE_ID = 'site-preview-surface';
export type PreviewSettings = {
  view: 'list' | 'board' | 'calendar';
  summary: boolean;
  note: string;
};

/** Read-only example data, visibly rearranged by the real settings controls.
 * No request, server, storage, task mutation or Calendar component is implied. */
export function createHomepageLivePreview(family: ProjectionFamilyId, locale: string) {
  const zh = locale === 'zh-cn';
  const copy = zh
    ? {
        title: '项目预览',
        example: '示例项目',
        note: '工作区备注',
        summary: '每周摘要',
        totals: '3 项任务 · 1 项已完成',
        views: { list: '列表', board: '看板', calendar: '日历' },
        tasks: [
          ['检查键盘交互', '待处理', '周一', '为新组件核对 Tab 顺序与焦点'],
          ['调整主题配色', '进行中', '周二', '检查浅色与深色的对比度'],
          ['补齐组件测试', '已完成', '周三', '保留跨 Runtime 的交互回归'],
        ],
      }
    : {
        title: 'Project preview',
        example: 'Example project',
        note: 'Workspace note',
        summary: 'Weekly summary',
        totals: '3 tasks · 1 complete',
        views: { list: 'List', board: 'Board', calendar: 'Calendar' },
        tasks: [
          [
            'Check keyboard flow',
            'To do',
            'Mon',
            'Review tab order and focus in the new component',
          ],
          [
            'Refine the theme',
            'In progress',
            'Tue',
            'Check contrast in light and dark appearances',
          ],
          ['Add component tests', 'Done', 'Wed', 'Keep interaction coverage across runtimes'],
        ],
      };
  const text = (className: string, value: string, ref?: string): DemoNode => ({
    kind: 'box',
    className,
    ...(ref ? { ref } : {}),
    children: [value],
  });
  const surface = (ref: string, children: DemoNode[], emphasis = 'plain'): DemoNode => ({
    kind: 'box',
    ref,
    className: 'home-preview__surface',
    children: [
      {
        kind: 'proto',
        prototypeId: PREVIEW_SURFACE_ID,
        props: { family, emphasis, appearance: 'card' },
        children,
      },
    ],
  });
  const node: DemoNode = {
    kind: 'box',
    ref: 'settings-preview',
    className: 'home-preview',
    attrs: { 'data-home-live-preview': '', role: 'region', 'aria-label': copy.title },
    children: [
      {
        kind: 'box',
        className: 'home-preview__heading',
        children: [
          {
            kind: 'box',
            attrs: { role: 'heading', 'aria-level': '3' },
            className: 'home-preview__title',
            children: [copy.title],
          },
          text('home-preview__context', copy.example),
        ],
      },
      text('home-preview__view-label', copy.views.list, 'settings-preview-view'),
      {
        kind: 'box',
        ref: 'settings-preview-tasks',
        className: 'home-preview__tasks',
        attrs: { 'data-view': 'list' },
        children: copy.tasks.map(([title, status, day, detail], index) =>
          surface(`settings-preview-task-${index}`, [
            {
              kind: 'box',
              className: 'home-preview__task',
              children: [
                text('home-preview__day', day!),
                {
                  kind: 'box',
                  className: 'home-preview__task-copy',
                  children: [
                    text('home-preview__task-title', title!),
                    text('home-preview__detail', detail!),
                  ],
                },
                text('home-preview__task-status', status!),
              ],
            },
          ])
        ),
      },
      surface(
        'settings-preview-summary',
        [text('home-preview__task-title', copy.summary), text('home-preview__detail', copy.totals)],
        'accent'
      ),
      surface('settings-preview-note', [
        text('home-preview__task-title', copy.note),
        text('home-preview__note', '', 'settings-preview-note-text'),
      ]),
    ],
  };
  return {
    node,
    update(context: DemoSetupContext, settings: PreviewSettings) {
      const refs = context.refs;
      refs['settings-preview-tasks']!.dataset.view = settings.view;
      refs['settings-preview-view']!.textContent = copy.views[settings.view];
      refs['settings-preview-summary']!.hidden = !settings.summary;
      refs['settings-preview-note']!.hidden = !settings.note.trim();
      refs['settings-preview-note-text']!.textContent = settings.note;
    },
  };
}
