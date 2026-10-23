import type { DemoChild, DemoNode } from '../PrototypePreviewer/demo-types';
import type { ProjectionFamilyId } from '../PrototypePreviewer/projection-families';

type Builders = {
  p: (
    id: string,
    children?: DemoChild[],
    props?: Record<string, unknown>,
    ref?: string
  ) => DemoNode;
  box: (
    className: string,
    children: DemoChild[],
    ref?: string,
    attrs?: Record<string, string>
  ) => DemoNode;
  card: (title: string, caption: string, children: DemoChild[], id: string) => DemoNode;
  button: (label: string, ref?: string, variant?: string) => DemoNode;
  status: (value: string, ref: string) => DemoNode;
};

type Bindings = {
  bind: (ref: string, event: string, callback: (detail: Record<string, unknown>) => void) => void;
  write: (ref: string, props: Record<string, unknown>) => void;
  feedback: (ref: string, value: string) => void;
};

/** Website-owned scenarios; filtering, focus, range and disclosure remain Prototype-owned. */
export function createHomepageCompositionParts(
  family: ProjectionFamilyId,
  locale: string,
  { p, box, card, button, status }: Builders
) {
  const zh = locale === 'zh-cn';
  const initialProgress = 40;
  const commands = [
    {
      value: 'outline',
      text: zh ? '整理提纲' : 'Outline an idea',
      progress: 25,
    },
    {
      value: 'prototype',
      text: zh ? '制作原型' : 'Build a prototype',
      progress: 60,
    },
    {
      value: 'review',
      text: zh ? '复查细节' : 'Review the details',
      progress: 90,
    },
  ];
  // Command's upstream slot intentionally does not select the ordinary shell focus ring.
  // This passive shell has no disabled opacity of its own; the editor retains those facts.
  const commandInput = () =>
    p(
      `${family}-command-input`,
      [],
      {
        placeholder: zh ? '搜索步骤…' : 'Find a step…',
        a11yLabel: zh ? '搜索示例步骤' : 'Search example steps',
      },
      'composition-command-input'
    );
  const command = card(
    zh ? '下一步做什么？' : 'What comes next?',
    zh ? '搜索一个步骤，更新本页的计划。' : 'Find a step to update the plan on this page.',
    [
      p(
        `${family}-command-root`,
        [
          family === 'shadcn'
            ? p('shadcn-command-input-wrapper', [
                p('shadcn-input-shell', [commandInput()], { focusIndicator: 'none' }),
              ])
            : commandInput(),
          p(`${family}-command-content`, [
            ...commands.map(({ value, text }) =>
              p(`${family}-command-item`, [text], {
                value,
                textValue: text,
              })
            ),
            p(
              `${family}-command-item`,
              [zh ? '发布到线上（不可用）' : 'Publish online (unavailable)'],
              {
                value: 'publish',
                textValue: zh ? '发布到线上' : 'Publish online',
                disabled: true,
              }
            ),
            p(`${family}-command-empty`, [zh ? '没有匹配的步骤' : 'No matching steps']),
          ]),
        ],
        { a11yLabel: zh ? '选择示例步骤' : 'Choose an example step' },
        'composition-command'
      ),
      status(
        zh ? '仅更新此页面，不会执行外部操作。' : 'Page-only demo. No external actions.',
        'composition-command-status'
      ),
    ],
    'workspace-command'
  );
  const progress = card(
    zh ? '给想法留一点空间' : 'Make room for an idea',
    zh ? '拖动或用方向键调整计划进度。' : 'Drag or use arrow keys to adjust your plan.',
    [
      p(
        `${family}-progress-root`,
        [
          p(`${family}-progress-label`, [zh ? '示例计划' : 'Example plan']),
          p(`${family}-progress-track`, [p(`${family}-progress-indicator`)]),
          p(`${family}-progress-value`),
        ],
        { value: initialProgress, min: 0, max: 100 },
        'composition-progress'
      ),
      p(
        `${family}-slider-root`,
        [
          p(`${family}-slider-track`, [
            p(`${family}-slider-indicator`),
            p(`${family}-slider-thumb`, [], {}, 'composition-slider-thumb'),
          ]),
        ],
        {
          value: initialProgress,
          min: 0,
          max: 100,
          step: 5,
          ariaLabel: zh ? '调整示例计划进度' : 'Adjust example plan progress',
        },
        'composition-slider'
      ),
      box('home-gallery__row', [
        button(zh ? '重新开始' : 'Start again', 'composition-reset', 'secondary'),
      ]),
      status(zh ? '计划进度 40%' : 'Plan progress: 40%', 'composition-progress-status'),
    ],
    'workspace-progress'
  );
  const helpItems = [
    {
      value: 'try',
      title: zh ? '从哪里开始？' : 'Where do I start?',
      body: zh
        ? '在步骤搜索中选一个结果，或直接调整进度。两个场景使用同一份本页计划数据。'
        : 'Choose a result in the step finder, or adjust the progress. Both scenes use the same page-local plan.',
    },
    {
      value: 'keyboard',
      title: zh ? '可以只用键盘吗？' : 'Can I use the keyboard?',
      body: zh
        ? '用 Tab 移动焦点；在搜索结果中用方向键和 Enter 选择，在滑块中用方向键调整。'
        : 'Use Tab to move focus, arrows and Enter to choose search results, and arrows to adjust the slider.',
    },
    {
      value: 'local',
      title: zh ? '这会保存到哪里？' : 'Where is this saved?',
      body: zh
        ? '这只是当前页面中的交互示例，不会上传、发布或保存到账号。重新加载后恢复默认值。'
        : 'This is an interactive example on the current page. Nothing is uploaded, published or saved to an account. Reloading restores the defaults.',
    },
  ];
  const help = card(
    zh ? '试一试，了解更多' : 'A little help along the way',
    zh ? '展开一个问题，继续探索。' : 'Open a question and keep exploring.',
    [
      p(
        `${family}-accordion-root`,
        helpItems.map(({ value, title, body }) =>
          p(
            `${family}-accordion-item`,
            [
              p(`${family}-accordion-heading`, [p(`${family}-accordion-trigger`, [title])], {
                level: 3,
              }),
              p(`${family}-accordion-content`, [box('home-gallery__copy', [body])], {
                region: true,
              }),
            ],
            { value }
          )
        ),
        { defaultOpenItems: ['try'] },
        'composition-help'
      ),
    ],
    'workspace-help'
  );

  return {
    command,
    progress,
    help,
    setup({ bind, write, feedback }: Bindings) {
      const update = (value: number) => {
        // This validates outward data; range stepping and keyboard semantics belong to Slider.
        if (!Number.isFinite(value) || value < 0 || value > 100) return;
        write('composition-slider', { value });
        write('composition-progress', { value });
        feedback(
          'composition-progress-status',
          zh ? `计划进度 ${value}%` : `Plan progress: ${value}%`
        );
      };
      bind('composition-slider', 'valueChange', ({ value }) => {
        if (typeof value === 'number') update(value);
      });
      bind('composition-command', 'execute', ({ value }) => {
        const selected = commands.find((command) => command.value === value);
        if (!selected) return;
        update(selected.progress);
        feedback(
          'composition-command-status',
          zh ? `已选择：${selected.text}` : `Selected: ${selected.text}`
        );
      });
      bind('composition-reset', 'click', () => {
        update(initialProgress);
        feedback(
          'composition-command-status',
          zh ? '计划已重置，可选择另一个步骤。' : 'Plan reset. Choose another step.'
        );
      });
    },
  };
}
