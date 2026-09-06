export type ShadcnDocFamily = 'base' | 'radix';

export interface ProtoUiTheoryLink {
  slug: string;
  title: {
    'zh-CN': string;
    en: string;
  };
  description: {
    'zh-CN': string;
    en: string;
  };
}

const DEFAULT_SHADCN_DOCS_BASE_URL = 'https://ui.shadcn.com/docs/components';

export const DEFAULT_PROTO_UI_THEORY_LINKS: ProtoUiTheoryLink[] = [
  {
    slug: 'whitepaper/1-components-before-code',
    title: {
      'zh-CN': '代码之前的组件',
      en: 'Components Before Code',
    },
    description: {
      'zh-CN': '理解 Proto UI 为什么先把组件看作交互主体，而不是某一种代码形式。',
      en: 'Understand why Proto UI first treats a component as an interactive subject rather than one code form.',
    },
  },
  {
    slug: 'whitepaper/3-component-boundary',
    title: {
      'zh-CN': '组件的边界',
      en: 'Component Boundaries',
    },
    description: {
      'zh-CN': '查看 Base 原型与上层风格化原型之间应该如何分层和继承。',
      en: 'See how Base prototypes and upper-layer styled prototypes should divide and inherit responsibilities.',
    },
  },
  {
    slug: 'build/prototypes/building-a-styled-library-on-top-of-base',
    title: {
      'zh-CN': '基于 Base 长出一个带风格的原型库',
      en: 'Building a Styled Library on Top of Base',
    },
    description: {
      'zh-CN': '对应当前 shadcn 风格库的构建路径，适合继续看 styled library 的设计方法。',
      en: 'Matches the current shadcn-style library path and is the best next read for styled library design.',
    },
  },
];

export function getShadcnDocsBaseUrl(): string {
  const configured = import.meta.env.PUBLIC_SHADCN_DOCS_BASE_URL || DEFAULT_SHADCN_DOCS_BASE_URL;
  return configured.replace(/\/+$/, '');
}

export function getShadcnComponentDocUrl(
  componentSlug: string,
  family: ShadcnDocFamily = 'base'
): string {
  return `${getShadcnDocsBaseUrl()}/${family}/${componentSlug}`;
}
