import { readPublicRecipeCss } from './public-recipe-css.mjs';

const consumers = [
  'apps/www/src/content/docs/form-validation-demo.shared.ts',
  'apps/www/src/content/docs/select-input-demo.shared.ts',
  'apps/www/src/content/docs/field-choices-demo.shared.ts',
  'apps/www/src/content/docs/shadcn-demo-style.ts',
];
export function readFormSelectRecipeCss() {
  return readPublicRecipeCss(consumers);
}
