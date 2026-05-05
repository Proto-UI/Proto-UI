export type ConceptLocale = 'zh-cn' | 'en';

export type ConceptEntry = {
  slug: string;
  term: Record<ConceptLocale, string>;
  summary: Record<ConceptLocale, string>;
  href?: string;
};

export const concepts: ConceptEntry[] = [
  {
    slug: 'host',
    term: { 'zh-cn': 'host', en: 'host' },
    summary: {
      'zh-cn':
        'Proto UI 的依赖环境：泛指框架技术、平台技术、硬件设备等。限制极少，几乎可运行于任何 HCI 技术体系之上。',
      en: 'The environment Proto UI depends on (frameworks, platforms, hardware, etc.). Constraints are intentionally minimal.',
    },
  },
  {
    slug: 'adapter',
    term: { 'zh-cn': 'adapter', en: 'adapter' },
    summary: {
      'zh-cn':
        '把 Proto UI 的协议能力翻译到具体技术载体（某个 host）上的“适配层”。它负责把抽象能力落地为真实的运行时行为。',
      en: 'A translation layer that maps Proto UI capabilities onto a specific host, turning abstractions into real runtime behavior.',
    },
  },
  {
    slug: 'prototype',
    term: { 'zh-cn': 'prototype', en: 'prototype' },
    summary: {
      'zh-cn':
        'Proto UI 中的交互主体单元：以协议的方式描述结构、状态、事件与反馈等能力，并可被 adapter/运行时解释与执行。',
      en: 'An interaction subject described as a protocol (structure, state, events, feedback, etc.), interpretable by adapters/runtimes.',
    },
  },
];

export function getConcept(slug: string): ConceptEntry | undefined {
  return concepts.find((c) => c.slug === slug);
}
