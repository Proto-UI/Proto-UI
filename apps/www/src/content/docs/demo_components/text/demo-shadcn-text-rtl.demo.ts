import type { DemoSpec } from '../../../../components/PrototypePreviewer/demo-types';
import { withShadcnRheaDemo } from '../../shadcn-demo-style';

const demo: DemoSpec = {
  type: 'demo',
  root: {
    kind: 'box',
    className: 'flex w-full max-w-xl flex-col gap-5 p-2',
    children: [
      {
        kind: 'box',
        attrs: { dir: 'rtl', lang: 'ar' },
        className: 'flex flex-col gap-3 rounded-lg border border-border p-4 text-start',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: {
              size: '2xl',
              font: 'heading',
              weight: 'bold',
              leading: 'tight',
            },
            children: ['فرض الضرائب على الضحك: سجلات ضريبة النكتة'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'base', tone: 'muted', leading: 'relaxed' },
            children: [
              'تتبع النصوص اتجاه الحاوية المنطقي مع الحفاظ على تدرج الخطوط وارتفاع الأسطر عبر اللغات من اليمين إلى اليسار.',
            ],
          },
          {
            kind: 'box',
            className: 'border-s-2 border-border ps-4',
            children: [
              {
                kind: 'proto',
                prototypeId: 'shadcn-text-root',
                rootTag: 'span',
                props: { size: 'sm', emphasis: 'italic', leading: 'relaxed' },
                children: ['«الجميع يستمتع بنكتة جيدة عندما تكون القراءة مريحة وواضحة.»'],
              },
            ],
          },
        ],
      },
      {
        kind: 'box',
        attrs: { lang: 'zh-CN' },
        className: 'flex flex-col gap-2 rounded-lg border border-border p-4 text-start',
        children: [
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: {
              size: 'xl',
              font: 'heading',
              weight: 'semibold',
              leading: 'snug',
            },
            children: ['中英混排与 CJK 回退示例 · Geist + System CJK'],
          },
          {
            kind: 'proto',
            prototypeId: 'shadcn-text-root',
            rootTag: 'span',
            props: { size: 'sm', tone: 'muted', leading: 'relaxed' },
            children: [
              '搭配 SHADCN_TYPOGRAPHY 预设时，拉丁字符优先使用 Geist，中文字符平滑回退至系统无衬线字体。',
            ],
          },
        ],
      },
    ],
  },
};

export default withShadcnRheaDemo(demo);
