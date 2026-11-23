import { readPublicRecipeCss } from './public-recipe-css.mjs';

const consumers = [
  ...['base', 'shadcn', 'brutalist'].flatMap((family) =>
    ['tree', 'data-table-recipes', 'virtual-list'].map(
      (kind) => `apps/www/src/content/docs/zh-cn/demo-${family}-${kind}.demo.ts`
    )
  ),
  'apps/www/src/content/docs/zh-cn/data-table-recipes.shared.ts',
  'apps/www/src/content/docs/shadcn-demo-style.ts',
];
export function readCollectionsRecipeCss() {
  return readPublicRecipeCss(consumers);
}
