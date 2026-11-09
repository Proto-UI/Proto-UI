import { readFileSync } from 'node:fs';

/**
 * Install the generated Proto UI stylesheet into the current document.
 *
 * The real site loads `src/styles/proto-ui-style.css`, which imports the
 * generated token sheet. A Prototype's own appearance therefore depends on
 * that stylesheet: a host that declares `relative` is only a positioned
 * padding box once the matching rule is present. Several host bridges check
 * the computed position before projecting a region, so a test that renders a
 * real Prototype without the stylesheet observes a different physical host
 * than the published page does.
 *
 * Happy DOM's CSSOM does not parse `@layer` or `@import`, and it stops after
 * the first at-rule. Those wrappers carry no declarations of their own, so
 * removing them leaves the same effective rules and lets the whole sheet
 * parse. The file is read from disk, never reimplemented here, so the test
 * still exercises the generated artifact rather than a copy.
 */
export function installGeneratedProtoUiStylesheet(target: Document = document): HTMLStyleElement {
  const source = readFileSync('apps/www/src/styles/proto-ui-tokens.generated.css', 'utf8');
  const style = target.createElement('style');
  style.dataset.protoUiGeneratedStylesheet = 'true';
  style.textContent = source.replace(/@layer[^{]*\{/g, '').replace(/@import[^;]*;/g, '');
  target.head.append(style);
  return style;
}

/** Remove a stylesheet previously installed by `installGeneratedProtoUiStylesheet`. */
export function removeGeneratedProtoUiStylesheet(target: Document = document): void {
  for (const style of [
    ...target.head.querySelectorAll('style[data-proto-ui-generated-stylesheet]'),
  ])
    style.remove();
}
