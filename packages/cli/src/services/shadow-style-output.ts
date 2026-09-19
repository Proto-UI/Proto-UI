import path from 'node:path';
import { renderShadowStyleDelivery } from './shadow-style-delivery.js';
import type { ShadowStyleTokenUsage } from './proto-style-css.js';
import {
  validateStyleOutputPaths,
  writeStyleOutputSet,
  type StyleOutput,
} from './style-output-set.js';

/** F1 is opt-in. Paths are relative to cwd, not to the preset styles directory. */
export function shadowOutputPath(args: readonly string[]): string | undefined {
  const flags = args.filter((arg) => arg === '--shadow-out' || arg.startsWith('--shadow-out='));
  if (!flags.length) return undefined;
  if (flags.length !== 1) throw new Error('Specify --shadow-out only once');
  const flag = flags[0];
  const value =
    flag === '--shadow-out' ? args[args.indexOf(flag) + 1] : flag.slice('--shadow-out='.length);
  if (!value || value.startsWith('-') || !value.trim())
    throw new Error('--shadow-out requires a file.js path');
  if (!value.endsWith('.js') || path.basename(value) === '.js')
    throw new Error('--shadow-out requires a .js file suffix');
  return path.resolve(value);
}

export async function generateShadowStyleOutputs(options: {
  shadowPath: string;
  cssPath: string;
  tokens: () => Promise<
    readonly string[] | (ShadowStyleTokenUsage & { tokens: readonly string[] })
  >;
  additional?: readonly StyleOutput[];
}) {
  const declaration = options.shadowPath.slice(0, -3) + '.d.ts';
  const extra = options.additional ?? [];
  await validateStyleOutputPaths([
    options.cssPath,
    options.shadowPath,
    declaration,
    ...extra.map((file) => file.path),
  ]);
  const inventory = await options.tokens();
  const delivery = renderShadowStyleDelivery(
    'tokens' in inventory ? inventory.tokens : inventory,
    'protoShadowStyleArtifact',
    'tokens' in inventory ? inventory : undefined
  );
  await writeStyleOutputSet([
    { path: options.cssPath, content: delivery.documentCss },
    { path: options.shadowPath, content: delivery.shadowModule },
    { path: declaration, content: delivery.shadowDeclaration },
    ...extra,
  ]);
  console.log(`[proto-ui] styles: wrote document CSS + ${options.shadowPath} + ${declaration}`);
}
