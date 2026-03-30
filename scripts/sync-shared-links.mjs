import { readFile, writeFile } from 'node:fs/promises';

import links from '../shared/links.json' with { type: 'json' };

const replacements = [
  {
    path: new URL('../README.md', import.meta.url),
    pairs: [
      {
        pattern: /\*\*Discord:\*\* \[Join the community\]\([^)]+\)/,
        value: `**Discord:** [Join the community](${links.discord})`,
      },
    ],
  },
  {
    path: new URL('../README.zh-CN.md', import.meta.url),
    pairs: [
      {
        pattern: /\*\*Discord：\*\* \[加入社区\]\([^)]+\)/,
        value: `**Discord：** [加入社区](${links.discord})`,
      },
    ],
  },
  {
    path: new URL('../CONTRIBUTING.md', import.meta.url),
    pairs: [
      {
        pattern:
          /If you are unsure, open an Issue first\. You do not need to join Discord to contribute, but a quick heads-up helps reviewers help you faster\./,
        value: `If you are unsure, open an Issue first. You do not need to join [Discord](${links.discord}) to contribute, but a quick heads-up there can help reviewers help you faster.`,
      },
      {
        pattern: /- Discord is available for quick syncs, but not required\./,
        value: `- [Discord](${links.discord}) is available for quick syncs, but not required.`,
      },
    ],
  },
  {
    path: new URL('../apps/www/src/content/docs/en/whitepaper/faq.md', import.meta.url),
    pairs: [
      {
        pattern:
          /Questions better suited to quick exchanges, temporary follow-ups, or more open-ended discussion fit better in the Discord community\./,
        value: `Questions better suited to quick exchanges, temporary follow-ups, or more open-ended discussion fit better in the [Discord community](${links.discord}).`,
      },
    ],
  },
  {
    path: new URL('../apps/www/src/content/docs/zh-cn/whitepaper/faq.md', import.meta.url),
    pairs: [
      {
        pattern: /适合快速交流、临时追问或发散讨论的问题，则更适合放到 Discord 社群。/,
        value: `适合快速交流、临时追问或发散讨论的问题，则更适合放到 [Discord 社群](${links.discord})。`,
      },
    ],
  },
];

for (const target of replacements) {
  let content = await readFile(target.path, 'utf8');
  for (const { pattern, value } of target.pairs) {
    content = content.replace(pattern, value);
  }
  await writeFile(target.path, content, 'utf8');
}

console.log('[sync-shared-links] synced Discord links from shared/links.json');
