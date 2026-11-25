import assert from 'node:assert/strict';

// A 304 has no representation body. Bind it to the earlier response that this
// observer actually hashed, rather than claiming that a second body was read.
export function bindProductionAsset(sample, previousBody) {
  const url = new URL(sample.url);
  assert.equal(url.origin, sample.origin, 'Production asset escaped the selected consumer');
  assert.ok([200, 304].includes(sample.status), 'Production asset did not load or revalidate');
  if (sample.status === 200) {
    assert.equal(
      sample.bodySha256,
      sample.diskSha256,
      `Served production asset differs: ${sample.path}`
    );
    return {
      url: url.href,
      path: sample.path,
      sha256: sample.bodySha256,
      status: 200,
      proof: 'response-body',
      etag: sample.etag ?? null,
    };
  }
  assert.ok(
    previousBody?.status === 200 && previousBody.proof === 'response-body',
    'Revalidated asset has no previously verified response body'
  );
  assert.equal(previousBody.url, url.href, 'Revalidated asset changed URL');
  assert.equal(previousBody.path, sample.path, 'Revalidated asset changed production path');
  assert.equal(
    previousBody.sha256,
    sample.diskSha256,
    'Revalidated asset no longer matches production bytes'
  );
  assert.ok(
    typeof previousBody.etag === 'string' && previousBody.etag.length > 0,
    'Revalidated asset has no bound ETag'
  );
  assert.equal(
    sample.ifNoneMatch,
    previousBody.etag,
    'Revalidation did not request the bound ETag'
  );
  if (sample.etag !== null && sample.etag !== undefined)
    assert.equal(sample.etag, previousBody.etag, 'Revalidation returned a different ETag');
  return {
    url: url.href,
    path: sample.path,
    sha256: previousBody.sha256,
    status: 304,
    proof: 'conditional-revalidation-of-verified-body',
    etag: previousBody.etag,
    ifNoneMatch: sample.ifNoneMatch,
    responseEtag: sample.etag ?? null,
  };
}
