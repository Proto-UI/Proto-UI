// Diagnostic consumer fixture for scripts/analysis/package-budgets.mjs: one
// shipped primitive on the Light DOM profile. Never executed; the bundle
// measurement shows what a single-primitive consumer pays after tree-shaking.
import { AdaptToWebComponent } from '../../../packages/adapters/web-component/src/index';
import button from '../../../packages/prototypes/shadcn/src/button/index';

AdaptToWebComponent(button, { registerAs: 'pui-budget-light-button' });
