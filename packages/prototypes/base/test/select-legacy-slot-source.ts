import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';

/** Complete current authored Item with only its historical storage declaration restored. */
export function historicalSelectItemSource(): string {
  const file = fileURLToPath(new NodeURL('../src/select/item.proto.ts', import.meta.url));
  const source = readFileSync(file, 'utf8');
  const declaration = "const selected = def.state.bool('selected', false);";
  if (source.split(declaration).length !== 2)
    throw new Error('Select legacy control requires exactly one current selected declaration.');
  return source
    .replace(declaration, "const selected = def.state.fromAccessibility('selected');")
    .replace(
      /from '(\.\/[^']+)'/g,
      (_match, relative: string) =>
        `from ${JSON.stringify(path.resolve(path.dirname(file), relative).split(path.sep).join('/'))}`
    );
}
