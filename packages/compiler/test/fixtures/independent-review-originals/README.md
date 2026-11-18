# Independent compiler review regressions

These files preserve the original inputs and hashes for the independent semantic review. The companion `reviewer-*.test.ts` files exercise source admission, serialized IR validation, demand-driven support, ordinary generated consumers, Runtime reference behavior, and owner lifetime boundaries. Their expectations were written independently of the repairs.

The original 30-file selection passed all 220 assertions at commit `4a6a892330f240b66dd2f412dfaf2b0573900477`, tree `fe11bbf308a21fd8d36819d9a67f1cfa97daacef`, before these tests were added to Git. `manifest.json` binds that original selection, its five source fixtures, and the raw local run records by SHA-256. The run records are historical evidence; the source and assertions in this repository are the reproducible deliverable.

The two `.proto.txt` files retain the exact historical input bytes. Their active `.proto.ts` copies add explicit Core capture generics, optional getter access, and the method callable type required by strict TypeScript. `type-contract-adjustments.patch.json` records every such change. The observable notification order, failure value, cancellation point, and test expectations remain unchanged. The inputs have not been silently replaced with a new oracle.

`test-type-adjustments.patch.json` separately records the three strict test repairs: explicitly narrowing a value exposure before changing its IR type in two tests, and making the lexical-initialization test callback return void. No observed expectation was weakened or removed.

## Reproduce the independent selection

Use the repository Node.js 24 and pnpm 10.32.1 toolchain. From the repository root:

```sh
corepack pnpm@10.32.1 exec vitest run packages/compiler/test/reviewer-*.test.ts packages/compiler/test/artifact-linking-consumer.test.ts packages/compiler/test/native-async-atoms.test.ts packages/compiler/test/notification-plan.test.ts packages/modules/state/test/notification-order.test.ts packages/modules/state/test/number-list.test.ts --maxWorkers=1 --minWorkers=1 --testTimeout=30000
```

This selects 25 independent test files (191 cases) and five existing test files (29 cases). All helpers and dependencies are repository-owned or declared package dependencies. Generated consumers use per-test temporary directories and are removed during cleanup. No scratch-workspace absolute path is required.

These are automated regression checks and an independent AI review, not a human review, native platform certification, or GitHub approval. The native Cargo consumers and browser acceptance have separate execution records.

## Recover and verify the original diffs

The diff containers use `{ "format": "unified", "patch": "..." }`. Decode the `patch` string as UTF-8 to recover the exact original diff bytes. The manifest records both the container hash and the recovered patch hash. JSON wrapping changes storage only; it does not remove the single-space prefixes required by blank unified-diff context lines.

The original local commit `8d6d8b69b92729acd3f226d5a16b26776323808d` failed `git diff --check` with exit code 2 on four such context lines. That failed whitespace check is retained as history; the original raw diff hashes remain unchanged in these containers.

From the repository root, verify both layers without changing any file:

```sh
node --input-type=module <<'JS'
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const directory = 'packages/compiler/test/fixtures/independent-review-originals/';
const manifest = JSON.parse(readFileSync(directory + 'manifest.json', 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
for (const entry of [manifest.typeAdjustmentPatch, manifest.testTypeAdjustmentPatch]) {
  const bytes = readFileSync(directory + entry.path);
  const container = JSON.parse(bytes.toString('utf8'));
  if (sha256(bytes) !== entry.sha256 || container.format !== 'unified' ||
      sha256(Buffer.from(container.patch, 'utf8')) !== entry.patchSha256) {
    throw new Error('Evidence hash mismatch: ' + entry.path);
  }
  console.log(entry.path + ': original patch bytes verified');
}
JS
```
