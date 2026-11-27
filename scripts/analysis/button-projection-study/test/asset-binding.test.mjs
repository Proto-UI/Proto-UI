import test from 'node:test';
import assert from 'node:assert/strict';
import { bindProductionAsset } from '../asset-binding.mjs';

const origin = 'http://127.0.0.1:4750';
const body = {
  origin,
  url: `${origin}/assets/index.js`,
  path: 'assets/index.js',
  status: 200,
  diskSha256: 'a'.repeat(64),
  bodySha256: 'a'.repeat(64),
  etag: 'W/"269004-1795401026757"',
};
const cached = {
  ...body,
  status: 304,
  bodySha256: undefined,
  etag: undefined,
  ifNoneMatch: body.etag,
};
const prior = () => bindProductionAsset(body);

test('a real body hash binds the first successful representation', () => {
  assert.equal(prior().proof, 'response-body');
  assert.equal(prior().sha256, body.diskSha256);
});
test('the observed Vite 304 shape binds to the earlier body without inventing a new body', () => {
  const result = bindProductionAsset(cached, prior());
  assert.equal(result.status, 304);
  assert.equal(result.proof, 'conditional-revalidation-of-verified-body');
  assert.equal(result.sha256, body.diskSha256);
  assert.equal(result.responseEtag, null);
  assert.equal(bindProductionAsset({ ...cached, etag: body.etag }, prior()).status, 304);
});
test('a 304 cannot establish the initial body or reuse another 304 as body evidence', () => {
  assert.throws(() => bindProductionAsset(cached), /previously verified response body/);
  assert.throws(
    () => bindProductionAsset(cached, bindProductionAsset(cached, prior())),
    /previously verified response body/
  );
});
test('revalidation must request the exact previously verified validator', () => {
  for (const ifNoneMatch of [undefined, '', '*', 'W/"other"'])
    assert.throws(() => bindProductionAsset({ ...cached, ifNoneMatch }, prior()), /bound ETag/);
  assert.throws(() => bindProductionAsset(cached, { ...prior(), etag: null }), /no bound ETag/);
});
test('a contradictory response validator remains a failure', () => {
  assert.throws(
    () => bindProductionAsset({ ...cached, etag: 'W/"other"' }, prior()),
    /different ETag/
  );
});
test('cache evidence cannot cross URLs, paths, or changed production bytes', () => {
  assert.throws(
    () => bindProductionAsset({ ...cached, url: `${origin}/assets/other.js` }, prior()),
    /changed URL/
  );
  assert.throws(
    () => bindProductionAsset({ ...cached, path: 'assets/other.js' }, prior()),
    /changed production path/
  );
  assert.throws(
    () => bindProductionAsset({ ...cached, diskSha256: 'b'.repeat(64) }, prior()),
    /production bytes/
  );
});
test('a wrong body or a failed response is never admitted as a cache hit', () => {
  assert.throws(
    () => bindProductionAsset({ ...body, bodySha256: 'b'.repeat(64) }),
    /Served production asset differs/
  );
  for (const status of [204, 404, 500])
    assert.throws(
      () => bindProductionAsset({ ...cached, status }, prior()),
      /did not load or revalidate/
    );
});
test('both body and cached responses remain confined to the selected consumer origin', () => {
  for (const sample of [body, cached])
    assert.throws(
      () =>
        bindProductionAsset({ ...sample, url: 'https://example.test/assets/index.js' }, prior()),
      /escaped the selected consumer/
    );
});
