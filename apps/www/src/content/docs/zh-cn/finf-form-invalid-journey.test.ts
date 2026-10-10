// @vitest-environment node
// Browser-journey negative controls only. Mocked observations are not native paint evidence.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { expect, it } from 'vitest';

const filename = 'apps/www/src/content/docs/zh-cn/finf-representative-features.browser.test.ts';
const source = ts.createSourceFile(
  filename,
  readFileSync(filename, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
const declaration = source.statements.find(
  (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'formJourney'
)!;
const code = transformSync(`${declaration.getText(source)}; formJourney;`, { loader: 'ts' }).code;

type Fault =
  | 'missing ink'
  | 'missing focus'
  | 'missing error'
  | 'editor ink leak'
  | 'stale correction';
function fixture(family: string, fault?: Fault) {
  let value = '',
    invalid = false,
    focused = false,
    status = 'Use the real controls above';
  let smsChecked = false;
  const captures: string[] = [],
    actions: string[] = [];
  const projectsInk = family === 'shadcn' || family === 'brutalist';
  const field = { kind: 'field' };
  const label = {
    kind: 'label',
    locator: () => field,
    getAttribute: async () => 'display-label',
  };
  const error = {
    kind: 'error',
    isVisible: async () => invalid && fault !== 'missing error',
    textContent: async () => 'This field is required.',
  };
  const editor = {
    kind: 'editor',
    fill: async (next: string) => {
      value = next;
      actions.push(`fill:${next}`);
    },
    inputValue: async () => value,
    getAttribute: async (name: string) =>
      name === 'aria-labelledby'
        ? 'display-label'
        : name === 'aria-errormessage'
          ? invalid
            ? 'display-error'
            : null
          : name === 'aria-invalid'
            ? invalid
              ? 'true'
              : null
            : null,
  };
  const submit = {
    click: async () => {
      actions.push('submit');
      invalid = value === '' || fault === 'stale correction';
      focused = invalid && fault !== 'missing focus';
      if (!invalid) status = JSON.stringify({ displayName: value });
    },
  };
  const reset = {
    click: async () => {
      actions.push('reset');
      value = '';
      invalid = false;
    },
  };
  const email = { kind: 'email' };
  const sms = {
    kind: 'sms',
    click: async () => {
      actions.push('sms');
      smsChecked = true;
    },
    getAttribute: async () => String(smsChecked),
  };
  const form = {
    locator: (selector: string) => (selector === 'input' ? { first: () => editor } : error),
    getByText: () => label,
    getByRole: (role: string, options: { name: string | RegExp }) =>
      role === 'checkbox'
        ? String(options.name).startsWith('Email')
          ? email
          : sms
        : String(options.name).includes('Reset values')
          ? reset
          : submit,
  };
  const previewer = {
    locator: (selector: string) =>
      selector.includes('status') ? { textContent: async () => status } : form,
  };
  const fixtureExpect = Object.assign((actual: unknown) => expect(actual), {
    poll: (actual: () => unknown) => expect.poll(actual, { timeout: 40, interval: 2 }),
  });
  const run = vm.runInNewContext(code, {
    expect: fixtureExpect,
    selectRealRuntime: async () => {},
    hasFocus: async () => focused,
    paint: async (element: { kind: string }) => ({
      color:
        element.kind === 'error' ||
        (invalid &&
          projectsInk &&
          ['field', 'label'].includes(element.kind) &&
          fault !== 'missing ink') ||
        (invalid && element.kind === 'editor' && fault === 'editor ink leak')
          ? 'red'
          : 'black',
      border: ['0px', '0px', '0px', '0px'],
    }),
  });
  return {
    actions,
    captures,
    run: () =>
      run({ page: {}, previewer, family, capture: async (state: string) => captures.push(state) }),
  };
}

for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'])
  it(`${family} retains invalid/corrected captures and the prior edit/reset/checkbox journey`, async () => {
    const current = fixture(family);
    await current.run();
    expect(current.captures).toEqual([
      'rest',
      'invalid-submit-first-focus',
      'corrected-submit',
      'reset',
      'edited',
    ]);
    expect(current.actions.filter((action) => action === 'submit')).toHaveLength(2);
    expect(current.actions).toContain('reset');
    expect(current.actions).toContain('sms');
  });

for (const family of ['shadcn', 'brutalist'])
  for (const fault of [
    'missing ink',
    'missing focus',
    'missing error',
    'editor ink leak',
    'stale correction',
  ] as const)
    it(`${family} browser assertions reject ${fault}`, async () => {
      await expect(fixture(family, fault).run()).rejects.toThrow();
    });
