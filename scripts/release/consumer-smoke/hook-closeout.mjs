import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
const { declareModule, defineHook, definePrototype, moduleDeclaration } =
  await import('@proto.ui/core');
const { AdaptToWebComponent, setElementProps } = await import('@proto.ui/adapter-web-component');
const selectedIds = new Set(process.argv.slice(3));
const observations = {
  schemaVersion: 1,
  environment: 'actual packed WC Adapter on happy-dom15.11.7; synthetic events',
  historicalEvidenceRecovered: false,
  results: [],
  fullGenericContractAcceptance: false,
  remainingCoverage: [
    'Adapter preselection and unavailable-capability outcomes',
    'Logical-owner view detach/reattach independently of terminal WC removal',
    'Complete trace invocation/reuse/failure diagnostics',
    'Actual same-source non-Web generated consumer and independent target conformance',
  ],
};
let sequence = 0;
const flush = () => new Promise((done) => setImmediate(done));
async function until(predicate) {
  const deadline = performance.now() + 2000;
  while (!predicate()) {
    assert(performance.now() < deadline, 'actual Adapter did not publish the required ready state');
    await flush();
  }
}
async function probe(id, criteria, run) {
  if (selectedIds.size > 0 && !selectedIds.has(id)) return;
  const row = { id, criteria, status: 'running' };
  observations.results.push(row);
  try {
    row.observed = await run();
    row.status = 'passed';
  } catch (error) {
    row.status = 'failed';
    row.error = String(error?.stack ?? error);
  }
}
async function mounted(setup) {
  const tag = `issue-1154-probe-${++sequence}`;
  const prototype = definePrototype({
    name: tag,
    setup(def) {
      setup(def);
      return (r) => r.el('span', 'ready');
    },
  });
  AdaptToWebComponent(prototype, { registerAs: tag });
  const element = document.createElement(tag);
  try {
    document.body.append(element);
    await until(() => element.textContent.includes('ready'));
    return { element, prototype };
  } catch (error) {
    element.remove();
    throw error;
  }
}

await probe(
  'current-public-legacy-defineHook',
  ['current-public-API; not historical raw-value conformance'],
  async () => {
    let installs = 0;
    let first;
    let repeated;
    const useLegacy = defineHook({
      name: 'issue-1154-legacy',
      setup(def) {
        installs += 1;
        const count = def.state.numberDiscrete('count', 1);
        def.event.on('key.down', (_run, event) => {
          if (event.key === 'Enter') count.set(count.get() + 2);
        });
      },
    });
    const { element } = await mounted(() => {
      first = useLegacy();
      repeated = useLegacy();
    });
    try {
      assert.equal(installs, 1);
      assert.equal(first, repeated);
      assert.equal(first.getState('count').get(), 1);
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await until(() => first.getState('count').get() === 3);
      return {
        installs,
        sameResult: true,
        before: 1,
        after: 3,
        stateSource: 'actual def.state declaration and event registration',
      };
    } finally {
      element.remove();
      await flush();
    }
  }
);

await probe(
  'generated-cli-facade-helper-consumer',
  ['issue.1154.001', 'issue.1154.002', 'T-BASE-COLLAPSIBLE-0001-CASE-UNCONTROLLED'],
  async () => {
    await import('./proto-ui/components/wc/index.js');
    const root = document.createElement('proto-ui-base-collapsible-root');
    const trigger = document.createElement('proto-ui-base-collapsible-trigger');
    const content = document.createElement('proto-ui-base-collapsible-content');
    assert(
      customElements.get(root.localName),
      'actual generated facade must register the component'
    );
    const requests = [];
    root.addEventListener('openChange', (event) => requests.push(event.detail));
    setElementProps(root, { defaultOpen: true });
    trigger.textContent = 'Disclosure';
    content.textContent = 'Packed helper consumer';
    root.append(trigger, content);
    try {
      document.body.append(root);
      await until(() => trigger.getAttribute('aria-expanded') === 'true');
      assert.deepEqual(requests, []);
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await until(() => trigger.getAttribute('aria-expanded') === 'false');
      assert.equal(root.getExposes().open.get(), false);
      assert.deepEqual(requests, [{ open: false, reason: 'pointer' }]);
      setElementProps(root, { defaultOpen: false });
      setElementProps(root, { defaultOpen: true });
      await flush();
      assert.equal(root.getExposes().open.get(), false);
      root.getExposes().openCollapsible();
      await until(() => trigger.getAttribute('aria-expanded') === 'true');
      return {
        generatedFacadeImported: true,
        initialOpen: true,
        clickOpen: false,
        laterDefaultDidNotReset: true,
        imperativeOpen: true,
        requests,
        meaning:
          'real CLI facade and existing useOpenState consumer; no full generic or native-input claim',
      };
    } finally {
      root.remove();
      await flush();
    }
  }
);

await probe(
  'unchanged-authored-raw-value-tuple-once',
  ['C-HOOK-0001-C', 'C-HOOK-0001-D', 'C-HOOK-0001-E'],
  async () => {
    const { default: counter, useCount } = await import('./hook-closeout.proto.ts');
    const tag = `issue-1154-authored-${++sequence}`;
    AdaptToWebComponent(counter, { registerAs: tag });
    const element = document.createElement(tag);
    try {
      document.body.append(element);
      await until(() => typeof element.getExposes?.()?.snapshot === 'function');
      const before = element.getExposes().snapshot();
      assert.deepEqual(before, {
        sameResult: true,
        sameValue: true,
        firstReference: true,
        count: 1,
        label: 'first',
      });
      assert.equal(element.getExposes().publicCount.get(), 1);
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await until(() => element.getExposes().snapshot().count === 3);
      const after = element.getExposes().snapshot();
      assert.equal(element.getExposes().publicCount.get(), 3);
      assert.equal(after.label, 'first');
      assert.throws(() => useCount({ count: 0, label: 'outside' }, 1));
      return { before, after, outsideSetupRejected: true };
    } finally {
      element.remove();
      await flush();
    }
  }
);

await probe(
  'definition-identity-and-direct-capture',
  ['C-HOOK-0001-B', 'C-HOOK-0001-F', 'C-HOOK-0001-J'],
  async () => {
    let firstInstalls = 0;
    let secondInstalls = 0;
    let first;
    let aliasResult;
    let second;
    let parent;
    const useFirst = defineHook({
      name: 'issue-1154-equal-name',
      setup(def) {
        firstInstalls += 1;
        def.state.bool('first', false);
      },
    });
    const useSecond = defineHook({
      name: 'issue-1154-equal-name',
      setup(def) {
        secondInstalls += 1;
        def.state.bool('second', false);
      },
    });
    const alias = useFirst;
    const useParent = defineHook({
      name: 'issue-1154-parent',
      setup(def) {
        def.state.bool('parent', false);
        first = useFirst();
        aliasResult = alias();
        second = useSecond();
      },
    });
    const { element, prototype } = await mounted(() => {
      parent = useParent();
    });
    try {
      assert.equal(firstInstalls, 1);
      assert.equal(secondInstalls, 1);
      assert.equal(first, aliasResult);
      assert.notEqual(first, second);
      assert(first.getState('first') && second.getState('second'));
      assert.equal(parent.getState('first'), undefined);
      assert.equal(parent.getState('second'), undefined);
      assert(parent.asHooks.some((entry) => entry.result === first));
      assert(parent.asHooks.some((entry) => entry.result === second));
      const trace = prototype.__asHooks;
      assert(Object.isFrozen(trace));
      return {
        firstInstalls,
        secondInstalls,
        aliasSharesResult: true,
        parentStateNames: Object.keys(parent.stateHandles ?? {}),
        readonlyTrace: true,
      };
    } finally {
      element.remove();
      await flush();
    }
  }
);

await probe(
  'failed-installation-and-capture-unwind',
  ['C-HOOK-0001-G', 'C-HOOK-0001-H'],
  async () => {
    let installs = 0;
    let recursiveRejected = false;
    let failedAttempts = 0;
    const caught = [];
    const useFailure = defineHook({
      name: 'issue-1154-failed',
      setup() {
        failedAttempts += 1;
        throw 0;
      },
    });
    const useRecursive = defineHook({
      name: 'issue-1154-recursive',
      setup() {
        installs += 1;
        try {
          useRecursive();
        } catch {
          recursiveRejected = true;
        }
      },
    });
    let clean;
    const useClean = defineHook({
      name: 'issue-1154-clean',
      setup(def) {
        def.state.bool('clean', false);
      },
    });
    const { element } = await mounted(() => {
      useRecursive();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          useFailure();
          caught.push({ present: false });
        } catch (error) {
          caught.push({ present: true, wasOriginalFalsyError: error === 0 });
        }
      }
      clean = useClean();
    });
    try {
      assert(recursiveRejected, 'initializing installation must not expose an empty ready result');
      assert.equal(installs, 1);
      assert.equal(failedAttempts, 1);
      assert(caught.every((entry) => entry.present));
      assert.equal(caught[0].wasOriginalFalsyError, true);
      assert(clean.getState('clean'));
      assert.equal(clean.getState('first'), undefined);
      return { installs, failedAttempts, caught, captureScopeRecovered: true };
    } finally {
      element.remove();
      await flush();
    }
  }
);

await probe('static-module-declarations', ['C-HOOK-0001-K'], async () => {
  // C-MODULE-DECLARATION-0001 supplies the real token/declaration substrate.
  // Publishing it from defineHook remains the retained historical K target;
  // the current legacy HookCaller has no public modules commitment.
  const ids = ['M-ISSUE-1154-STATIC-Z', 'M-ISSUE-1154-STATIC-A'];
  const tokens = ids.map((id) => moduleDeclaration(id));
  const configs = [{ slot: 'first' }, { slot: 'second' }];
  const declarations = tokens.map((token, index) => declareModule(token, configs[index]));
  const definition = { name: 'issue-1154-static', modules: declarations, setup() {} };
  const useStatic = defineHook(definition);
  const actual = useStatic.modules;
  assert(
    Array.isArray(actual),
    'retained C-HOOK-0001-K target requires a Module declaration array'
  );
  assert.equal(actual.length, declarations.length);
  assert.deepEqual(
    actual.map((entry) => entry.id),
    ids
  );
  assert(Object.isFrozen(actual));
  for (let index = 0; index < declarations.length; index += 1) {
    const declaration = actual[index];
    assert.equal(declaration, declarations[index]);
    for (const key of ['id', 'token', 'config']) assert(Object.hasOwn(declaration, key));
    assert.equal(declaration.id, ids[index]);
    assert.equal(declaration.token, tokens[index]);
    assert.equal(declaration.token.id, ids[index]);
    assert.equal(declaration.config, configs[index]);
    assert.equal(declaration.config.slot, index === 0 ? 'first' : 'second');
    assert(Object.isFrozen(declaration));
    assert(Object.isFrozen(declaration.token));
    assert(Object.isFrozen(declaration.config));
  }
  return {
    declarationIds: actual.map((entry) => entry.id),
    declarationTokenConfigIdentity: true,
    immutableDeclarationSurface: true,
    contractScope: 'historical C-HOOK-0001-K target; no current legacy HookCaller.modules promise',
    remaining: 'unavailable-capability and Adapter preselection still require independent coverage',
  };
});

const retired = {
  mode: 'once',
  configure() {},
  projectHandle() {},
  store: {},
  instanceKey: 'second',
};
for (const [key, value] of Object.entries(retired)) {
  await probe(`retired-metadata-${key}`, ['C-HOOK-0001-L'], async () => {
    assert.throws(() =>
      defineHook({ name: `issue-1154-retired-${key}`, setup() {}, [key]: value })
    );
    return { rejected: key };
  });
}

observations.selection = {
  scope: selectedIds.size > 0 ? 'selected-probes-only' : 'all-prepared-probes',
  requested: [...selectedIds],
  executed: observations.results.map((row) => row.id),
  unmatched: [...selectedIds].filter((id) => !observations.results.some((row) => row.id === id)),
};
observations.complete =
  observations.results.length > 0 &&
  observations.selection.unmatched.length === 0 &&
  observations.results.every((row) => row.status === 'passed');
writeFileSync(process.argv[2], `${JSON.stringify(observations, null, 2)}\n`);
if (!observations.complete) process.exitCode = 1;
