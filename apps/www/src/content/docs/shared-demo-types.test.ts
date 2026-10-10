// @vitest-environment node
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { assertDemoSpec } from '../../components/PrototypePreviewer/demo-types';
import { createFormPrimitivesDemo } from './form-primitives-demo.shared';
import { createNumericInputDemo } from './numeric-input-demo.shared';
import { createRangeReadoutDemo } from './range-readout-demo.shared';

it('type-checks shared proto builders and their ref/props spreads without widening to text nodes', () => {
  const configPath = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url));
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  expect(config.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    fileURLToPath(new URL('../../../', import.meta.url)),
    { noEmit: true },
    configPath
  );
  expect(parsed.errors).toEqual([]);
  const files = ['form-primitives', 'numeric-input', 'range-readout'].map((name) =>
    fileURLToPath(new URL(`./${name}-demo.shared.ts`, import.meta.url))
  );
  const program = ts.createProgram(files, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    file: diagnostic.file?.fileName,
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));
  expect(diagnostics).toEqual([]);
});

describe.each(['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])(
  '%s shared demo trees',
  (family) => {
    it.each(['fieldset', 'form', 'checkbox-group'] as const)(
      '%s remains a valid DemoSpec',
      (component) => {
        expect(() => assertDemoSpec(createFormPrimitivesDemo(family, component))).not.toThrow();
      }
    );
    it.each(['slider', 'number-field', 'input-otp'] as const)(
      '%s remains a valid DemoSpec',
      (component) => {
        expect(() => assertDemoSpec(createNumericInputDemo(family, component))).not.toThrow();
      }
    );
    it.each(['progress', 'meter'] as const)('%s remains a valid DemoSpec', (component) => {
      expect(() => assertDemoSpec(createRangeReadoutDemo(family, component))).not.toThrow();
    });
  }
);
