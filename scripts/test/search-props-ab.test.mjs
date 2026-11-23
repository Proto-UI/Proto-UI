import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformSync } from 'esbuild';
import test from 'node:test';
import {
  PROPS_AB_PLAN,
  PROPS_PATH,
  isPropsUrl,
  plannedSamples,
  propsABSummary,
  propsVariant,
  validateModuleReceipt,
} from './search-props-ab.mjs';

const source = `const unchangedCustomProperty = sameValue && samePriority;
if (!unchangedCustomProperty) { target.style.setProperty(property, style.value, style.priority); }
//# sourceMappingURL=unchanged-source-map`;
function receipt(variant = 'current') {
  const changed = propsVariant(source, variant);
  const { body, ...proof } = changed;
  const url = `http://127.0.0.1:4321/@fs/repo/${PROPS_PATH}`;
  return {
    requests: [url],
    responses: [{ url, ...proof }],
    parsed: [{ url, digest: changed.servedDigest }],
    alternatives: [],
  };
}
const validSamples = () =>
  plannedSamples().map((sample) => ({
    ...sample,
    capture: 'complete',
    readiness: { onTime: sample.variant === 'current' },
  }));

test('source and real transformed props preserve every byte outside the single condition', async () => {
  const product = await readFile(PROPS_PATH, 'utf8');
  const transformed = transformSync(product, {
    loader: 'ts',
    format: 'esm',
    target: 'esnext',
    sourcemap: 'inline',
  }).code;
  for (const input of [source, product, transformed]) {
    const current = propsVariant(input, 'current');
    const forced = propsVariant(input, 'forced-write');
    assert.equal(current.body, input);
    assert.equal(forced.originalDigest, current.originalDigest);
    assert.equal(
      forced.body,
      input.slice(0, forced.mutation.offset) +
        'true' +
        input.slice(forced.mutation.offset + '!unchangedCustomProperty'.length)
    );
    assert.equal(forced.body.replace('if (true)', 'if (!unchangedCustomProperty)'), input);
    assert.notEqual(forced.servedDigest, current.servedDigest);
  }
});

test('missing, duplicate and ambiguous guards cannot produce a false mutation receipt', () => {
  for (const candidate of [source.replace('!unchangedCustomProperty', 'true'), source + source])
    assert.throws(() => propsVariant(candidate, 'forced-write'), /exactly one/);
  assert.throws(() => propsVariant(source, 'unknown'), /Unknown/);
});

test('only canonical props module on the same origin may be intercepted', () => {
  const origin = 'http://127.0.0.1:4321';
  assert.equal(isPropsUrl(`${origin}/@fs/repo/${PROPS_PATH}?v=identity`, origin), true);
  assert.equal(isPropsUrl(`${origin}/${PROPS_PATH}`, origin), true);
  assert.equal(isPropsUrl(`${origin}/another/props.ts`, origin), false);
  assert.equal(isPropsUrl(`http://127.0.0.1:4322/${PROPS_PATH}`, origin), false);
  assert.equal(isPropsUrl(`${origin}/${PROPS_PATH}.js`, origin), false);
  assert.equal(isPropsUrl('not a URL', origin), false);
});

test('actual parsed source, requested source and intercepted source must match exactly', () => {
  for (const variant of PROPS_AB_PLAN.variants) {
    const proof = receipt(variant);
    assert.doesNotThrow(() =>
      validateModuleReceipt(proof, variant, proof.responses[0].originalDigest)
    );
  }
  const negative = [
    (proof) => proof.requests.splice(0),
    (proof) => proof.responses.splice(0),
    (proof) => proof.parsed.splice(0),
    (proof) => proof.requests.push(proof.requests[0]),
    (proof) => proof.parsed.push(proof.parsed[0]),
    (proof) => {
      proof.parsed[0].digest = 'different-browser-bytes';
    },
    (proof) => {
      proof.parsed[0].url += '?other-copy';
    },
    (proof) => proof.alternatives.push('unintercepted-props.js'),
    (proof) => {
      proof.responses[0].originalDigest = 'different-sample-source';
    },
    (proof) => {
      proof.responses[0].mutation.after = 'false';
    },
  ];
  for (const mutate of negative) {
    const proof = receipt('forced-write');
    const expected = proof.responses[0].originalDigest;
    mutate(proof);
    assert.throws(() => validateModuleReceipt(proof, 'forced-write', expected));
  }
});

test('eight scenarios each retain five interleaved fresh-context pairs and the 1000ms budget', () => {
  const plan = plannedSamples();
  assert.equal(plan.length, 80);
  assert.equal(new Set(plan.map((sample) => sample.id)).size, 80);
  assert.equal(PROPS_AB_PLAN.readinessBudgetMs, 1000);
  for (const family of PROPS_AB_PLAN.families)
    for (const theme of PROPS_AB_PLAN.themes)
      for (const width of PROPS_AB_PLAN.widths) {
        const scenario = plan.filter(
          (sample) => sample.family === family && sample.theme === theme && sample.width === width
        );
        assert.equal(scenario.length, 10);
        for (let pair = 0; pair < 5; pair++)
          assert.deepEqual(
            scenario.filter((sample) => sample.pair === pair).map((sample) => sample.variant),
            pair % 2 ? ['forced-write', 'current'] : ['current', 'forced-write']
          );
      }
});

test('all counterfactual misses remain explicit while each current sample must pass', () => {
  const samples = validSamples();
  const summary = propsABSummary(samples);
  assert.equal(summary.complete, true);
  assert.equal(summary.candidatePassed, true);
  assert.equal(summary.variants.current.readinessPasses, 40);
  assert.equal(summary.variants['forced-write'].readinessFailures.length, 40);
  samples[0].readiness.onTime = false;
  const failed = propsABSummary(samples);
  assert.equal(failed.complete, true);
  assert.equal(failed.candidatePassed, false);
  assert.deepEqual(failed.variants.current.readinessFailures, [samples[0].id]);
});

test('missing, duplicate, unplanned and incomplete captures never masquerade as five valid pairs', () => {
  const missing = validSamples();
  missing.pop();
  assert.equal(propsABSummary(missing).complete, false);
  const duplicate = validSamples();
  duplicate[1] = duplicate[0];
  assert.equal(propsABSummary(duplicate).complete, false);
  const extra = validSamples();
  extra.push({ ...extra[0], id: 'not-planned' });
  assert.equal(propsABSummary(extra).complete, false);
  const incomplete = validSamples();
  incomplete[0].capture = 'incomplete';
  assert.equal(propsABSummary(incomplete).complete, false);
  assert.equal(propsABSummary(incomplete).candidatePassed, false);
  const noReadiness = validSamples();
  delete noReadiness[0].readiness;
  assert.equal(propsABSummary(noReadiness).candidatePassed, false);
});
