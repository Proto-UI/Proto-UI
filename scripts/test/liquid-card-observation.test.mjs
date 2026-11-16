import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(
  'apps/www/src/content/docs/zh-cn/library-liquid-card-observation.ts',
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { withLiquidCardFailureObservation: observe } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('successful native work is returned unchanged without any diagnostic', async () => {
  const result = {};
  const unexpected = () => {
    throw new Error('Diagnostic called on passing native work');
  };
  assert.equal(await observe(async () => result, unexpected, unexpected, unexpected), result);
});

for (const primary of [new Error('native'), undefined, null, false, 0, '']) {
  test(`retains and rethrows original native failure including ${String(primary)}`, async () => {
    let caught = false;
    let retained;
    const facts = { rect: { y: 23 } };
    try {
      await observe(
        async () => {
          throw primary;
        },
        async () => facts,
        async (value) => {
          retained = value;
        },
        () => {}
      );
    } catch (actual) {
      caught = true;
      assert.equal(actual, primary);
    }
    assert.equal(caught, true);
    assert.equal(retained, facts);
  });
}

for (const stage of ['read', 'write', 'report']) {
  test(`secondary ${stage} failure cannot replace the native error`, async () => {
    const primary = new Error('native');
    let caught;
    try {
      await observe(
        async () => {
          throw primary;
        },
        async () => {
          if (stage !== 'write') throw new Error('read');
          return {};
        },
        async () => {
          throw new Error('write');
        },
        () => {
          if (stage === 'report') throw new Error('report');
        }
      );
    } catch (actual) {
      caught = actual;
    }
    assert.equal(caught, primary);
  });
}

test('a timed-out read cannot publish a late diagnostic or swallow native failure', async () => {
  const primary = new Error('native');
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  let writes = 0;
  let reports = 0;
  await assert.rejects(
    observe(
      async () => {
        throw primary;
      },
      () => pending,
      async () => {
        writes++;
      },
      () => {
        reports++;
      },
      5
    ),
    (error) => error === primary
  );
  finish({ late: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writes, 0);
  assert.equal(reports, 1);
});

test('producer keeps verified native wheel, blocking checks, public surfaces and failure retention', () => {
  const producer = readFileSync(
    'apps/www/src/content/docs/zh-cn/library-liquid-card-producer.browser.test.ts',
    'utf8'
  );
  assert.match(producer, /\(\) => revealNoScriptLink\(input, destination\)/);
  assert.match(producer, /scroll-failure-observation\.json/);
  assert.match(producer, /actual-viewport\.png/);
  assert.match(producer, /throw error;/);
  assert.match(producer, /libraryCardReadabilityFailures\(cards\)/);
  assert.match(
    producer,
    /waitForURL\(`\$\{baseUrl\}\/\$\{locale\}\/ui-libraries\/liquid-glass\/button\/`\)/
  );
  assert.doesNotMatch(
    source,
    /\.scrollIntoView|\.focus\(|\.finish\(|\.pause\(|\.style\.|\.remove\(|addStyleTag/
  );
});

test('the retained candidate gallery links to real component demos in both locales', () => {
  const file = 'apps/www/src/components/UiLibraryGallery.astro';
  const frontmatter = readFileSync(file, 'utf8').split('---')[1];
  const ast = ts.createSourceFile(file, frontmatter, ts.ScriptTarget.Latest, true);
  const data = ast.statements.filter(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some((declaration) =>
        ['copy', 'isZh', 'cards'].includes(declaration.name.getText(ast))
      )
  );
  assert.equal(data.length, 3);
  const js = ts.transpileModule(data.map((node) => node.getText(ast)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const destinations = {
    base: 'base/button',
    shadcn: 'shadcn/button',
    lucide: 'lucide/icons',
    brutalist: 'brutalist/components/button',
    'bootstrap-2-3-2': 'bootstrap-2-3-2/button',
    'liquid-glass': 'liquid-glass/button',
  };
  for (const locale of ['en', 'zh-cn']) {
    const cards = runInNewContext(`${js}; cards`, { locale });
    assert.deepEqual(
      Array.from(cards, (card) => card.id),
      Object.keys(destinations)
    );
    for (const card of cards) {
      const route = `${locale}/ui-libraries/${destinations[card.id]}`;
      assert.equal(card.href, `/${route}/`);
      assert.ok(readFileSync(`apps/www/src/content/docs/${route}.mdx`, 'utf8').length > 0);
    }
  }
});
